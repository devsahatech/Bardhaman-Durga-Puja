import { APP_CONFIG } from '../config/appConfig';
import * as turf from '@turf/turf';
import { getCachedRoute, setCachedRoute, ROUTE_CACHE_VERSION } from '../lib/routeCache';

const OSRM_BASE_URL = 'https://puja-osrm-proxy.devsahatech.workers.dev';

// Calculate Haversine distance in km
export function haversineDistance(point1, point2) {
  const from = turf.point([point1.lng, point1.lat]);
  const to = turf.point([point2.lng, point2.lat]);
  return turf.distance(from, to, { units: 'kilometers' });
}

function getDistanceFallback(point1, point2) {
  return haversineDistance(point1, point2);
}

// Fetch real route from OSRM (or fallback)
export async function fetchOSRMRoute(startLng, startLat, endLng, endLat, mode = 'walking') {
  // OSRM profiles: driving, walking, cycling
  const profile = mode === 'bike' ? 'cycling' : mode === 'car' ? 'driving' : 'walking';
  
  const rnd = (val) => Number(val).toFixed(5);
  const cacheKey = `${ROUTE_CACHE_VERSION}:${rnd(startLng)},${rnd(startLat)}->${rnd(endLng)},${rnd(endLat)}:${profile}`;

  const cached = await getCachedRoute(cacheKey);
  if (cached) return cached;
  
  try {
    const url = `${OSRM_BASE_URL}/route/v1/${profile}/${rnd(startLng)},${rnd(startLat)};${rnd(endLng)},${rnd(endLat)}?overview=full&geometries=geojson&steps=true`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`OSRM API error: ${response.status}`);
    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      if (!route.legs || route.legs.length === 0) {
        console.warn('OSRM returned a route with no legs');
        throw new Error('INVALID_ROUTE');
      }
      const result = {
        distanceKm: route.distance / 1000,
        durationMin: route.duration / 60,
        geometry: route.geometry,
        steps: route.legs[0].steps
      };
      setCachedRoute(cacheKey, result); // Do not await
      return result;
    }
  } catch (err) {
    console.warn("OSRM routing failed, falling back to straight-line", err);
  }

  // Do not return fake straight-line geometry for navigation.
  return {
    distanceKm: distKm,
    durationMin: durationMin,
    geometry: null,
    steps: [],
    error: 'unavailable'
  };
}

// Simple 2-Opt TSP approximation using Fallback Distances for speed
// To avoid hitting OSRM too many times during optimization, we use straight-line for the TSP order
export function optimizeRouteTSP(points) {
  if (points.length <= 2) return points;

  let current = points[0];
  let unvisited = points.slice(1);
  let route = [current];

  while (unvisited.length > 0) {
    let closestIdx = -1;
    let minDist = Infinity;
    for (let i = 0; i < unvisited.length; i++) {
      const d = getDistanceFallback(current, unvisited[i]);
      if (d < minDist) {
        minDist = d;
        closestIdx = i;
      }
    }
    current = unvisited[closestIdx];
    route.push(current);
    unvisited.splice(closestIdx, 1);
  }

  let improved = true;
  let iterations = 0;
  
  while (improved && iterations < 100) {
    improved = false;
    iterations++;
    for (let i = 1; i < route.length - 1; i++) {
      for (let k = i + 1; k < route.length; k++) {
        const d_i_prev = getDistanceFallback(route[i - 1], route[i]);
        const next_k = (k + 1 < route.length) ? route[k + 1] : route[0];
        const d_k_next = getDistanceFallback(route[k], next_k);
        
        const d_i_prev_new = getDistanceFallback(route[i - 1], route[k]);
        const next_i = (k + 1 < route.length) ? route[k + 1] : route[0];
        const d_k_next_new = getDistanceFallback(route[i], next_i);

        const oldDist = d_i_prev + d_k_next;
        const newDist = d_i_prev_new + d_k_next_new;

        if (newDist < oldDist - 0.0001) {
          const reversed = route.slice(i, k + 1).reverse();
          route.splice(i, reversed.length, ...reversed);
          improved = true;
        }
      }
    }
  }
  // First-hop lock preserves walking UX — user should never walk past a nearby pandal to visit a farther one first.
  let nearestIdx = -1;
  let minD = Infinity;
  for (let i = 1; i < route.length; i++) {
    const d = getDistanceFallback(route[0], route[i]);
    if (d < minD) {
      minD = d;
      nearestIdx = i;
    }
  }

  if (nearestIdx > 1) {
    let distBefore = 0;
    for (let i = 0; i < route.length; i++) {
      distBefore += getDistanceFallback(route[i], route[(i + 1) % route.length]);
    }

    const backupRoute = [...route];
    const beforeNearest = route.slice(1, nearestIdx);
    const nearest = route[nearestIdx];
    // Delete nearestIdx elements starting from index 1, and insert nearest followed by beforeNearest
    route.splice(1, nearestIdx, nearest, ...beforeNearest);

    let distAfter = 0;
    for (let i = 0; i < route.length; i++) {
      distAfter += getDistanceFallback(route[i], route[(i + 1) % route.length]);
    }

    if (distAfter > distBefore * 1.15) {
      route = backupRoute;
    }
  }

  return route;
}

export function calculateTimeBudget(routeParams) {
  const { route, mode, roadCrowdMultiplier = 1.0 } = routeParams;
  
  let totalTravelTime = 0;
  let totalDwellTime = 0;

  for (let i = 0; i < route.length - 1; i++) {
    const dist = getDistanceFallback(route[i], route[i+1]);
    const travelMin = (dist / (APP_CONFIG.speeds[mode] || APP_CONFIG.speeds.walking)) * 60;
    totalTravelTime += travelMin * roadCrowdMultiplier;
  }

  route.forEach(p => {
    totalDwellTime += (p.dwellMinutes || 20);
  });

  return {
    totalTravelTime,
    totalDwellTime,
    totalTime: totalTravelTime + totalDwellTime
  };
}

export const TRANSPORT_MODES = {
  walking: 'walking',
  cycling: 'bike',
  driving: 'car'
};

export function solveTsp(nodes, mode) {
  return optimizeRouteTSP(nodes);
}


export function filterTopN(pandals, n, userLocation, maxRadiusKm = null) {
  let validPandals = pandals.filter(p => typeof p.rank === 'number');

  // Radius filter: only keep pandals within maxRadiusKm of the user
  if (userLocation && maxRadiusKm) {
    validPandals = validPandals.filter(p =>
      haversineDistance(userLocation, p) <= maxRadiusKm
    );
  }

  validPandals.sort((a, b) => a.rank - b.rank);
  return n ? validPandals.slice(0, n) : validPandals;
}

export function solveBudget(startNode, pandals, budgetMin, mode, maxRadiusKm = null) {
  const speedMode = mode === 'cycling' ? 'bike' : mode === 'driving' ? 'car' : 'walking';
  const speed = APP_CONFIG.speeds[speedMode] || 5;

  // Radius filter: only consider pandals within maxRadiusKm of the start node
  let candidates = pandals;
  if (startNode && maxRadiusKm) {
    candidates = pandals.filter(p =>
      haversineDistance(startNode, p) <= maxRadiusKm
    );
  }

  let unvisited = filterTopN(candidates, null, null, null); // rank only, no radius re-filter
  const selected = [];
  let currentPos = startNode;
  
  let totalMin = 0;
  
  while (unvisited.length > 0) {
    let closestIdx = -1;
    let minDist = Infinity;
    
    for (let i = 0; i < unvisited.length; i++) {
      const d = getDistanceFallback(currentPos, unvisited[i]);
      if (d < minDist) {
        minDist = d;
        closestIdx = i;
      }
    }
    
    const candidate = unvisited[closestIdx];
    const distToCand = minDist;
    const travelMin = (distToCand / speed) * 60 * (1 + APP_CONFIG.planner.trafficBuffer);
    const dwellMin = candidate.visit?.dwellMinutes || candidate.dwellMinutes || 20;
    
    const distToHome = getDistanceFallback(candidate, startNode);
    const returnTravelMin = (distToHome / speed) * 60 * (1 + APP_CONFIG.planner.trafficBuffer);
    
    if (totalMin + travelMin + dwellMin + returnTravelMin <= budgetMin) {
      selected.push(candidate);
      totalMin += travelMin + dwellMin;
      currentPos = candidate;
      unvisited.splice(closestIdx, 1);
    } else {
      unvisited.splice(closestIdx, 1);
    }
  }

  console.log('[solveBudget] budget:', budgetMin,
              'selected:', selected.length,
              'totalMin:', Math.round(totalMin),
              'dwells:', selected.slice(0, 5).map(p =>
                p.visit?.dwellMinutes || p.dwellMinutes || 20
              ));

  const optimizedNodes = optimizeRouteTSP([startNode, ...selected]);
  const finalSelected = optimizedNodes.slice(1);
  
  return { 
    selected: finalSelected, 
    stats: calcItinerary(startNode, finalSelected, mode), 
    trimmedCount: pandals.length - finalSelected.length 
  };
}

export function calcItinerary(startNode, route, mode) {
  let totalTravelMin = 0;
  let totalDwellMin = 0;
  let totalDistKm = 0;
  let cumMinutes = 0;
  const legs = [];

  const speedMode = mode === 'cycling' ? 'bike' : mode === 'driving' ? 'car' : 'walking';
  const speed = APP_CONFIG.speeds[speedMode] || 5;

  let current = startNode;
  for (const p of route) {
    if (p.id === 'END' || p.id === '__START__') continue;
    const dist = getDistanceFallback(current, p);
    const travelMin = (dist / speed) * 60 * (1 + APP_CONFIG.planner.trafficBuffer);
    const dwellMin = p.visit?.dwellMinutes || p.dwellMinutes || 20;
    
    totalDistKm += dist;
    totalTravelMin += travelMin;
    totalDwellMin += dwellMin;
    cumMinutes += travelMin + dwellMin;
    
    legs.push({
      pandal: p,
      distKm: dist.toFixed(2),
      travelMin: Math.round(travelMin),
      dwellMin: dwellMin,
      cumMinutes: Math.round(cumMinutes)
    });
    
    current = p;
  }

  if (route.length > 0) {
    const returnDist = getDistanceFallback(current, startNode);
    const returnTravelMin = (returnDist / speed) * 60 * (1 + APP_CONFIG.planner.trafficBuffer);
    
    totalDistKm += returnDist;
    totalTravelMin += returnTravelMin;
    cumMinutes += returnTravelMin;
    
    legs.push({
      pandal: { id: '__START__', name: 'Return to Start', name_bn: 'Return to Start', name_en: 'Return to Start', lat: startNode.lat, lng: startNode.lng },
      distKm: returnDist.toFixed(2),
      travelMin: Math.round(returnTravelMin),
      dwellMin: 0,
      cumMinutes: Math.round(cumMinutes)
    });
  }

  return {
    totalMin: totalTravelMin + totalDwellMin,
    totalTravelMin: Math.round(totalTravelMin),
    totalDwellMin: Math.round(totalDwellMin),
    totalDistKm: totalDistKm.toFixed(2),
    legs
  };
}

export function formatDuration(minutes, lang) {
  if (!minutes) return '0 min';
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (lang === 'en') {
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  }
  return hrs > 0 ? `${hrs} ঘণ্টা ${mins} মি` : `${mins} মি`;
}


