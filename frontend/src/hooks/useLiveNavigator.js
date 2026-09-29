"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useGeolocation } from './useGeolocation';
import * as turf from '@turf/turf';
import { fetchOSRMRoute, parseManeuver, snapToRoute, clearRouteCache } from '../utils/navigationEngine';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { APP_CONFIG } from '../config/appConfig';
import { useVoice } from './useVoice';

const ARRIVAL_RADIUS_METERS = 35;

export function useLiveNavigator(optimizedRoute, lang, t) {
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const { position: userLocation } = useGeolocation({ mode: 'watch' });
  const [routeData, setRouteData] = useState(null); // Full original OSRM route
  const [activeRouteLine, setActiveRouteLine] = useState(null); // Sliced line for rendering
  const [currentManeuver, setCurrentManeuver] = useState(null);
  const [distanceToTarget, setDistanceToTarget] = useState(null);
  const [osrmError, setOsrmError] = useState(false);
  const [gpsPermissionDenied, setGpsPermissionDenied] = useState(false);

  // New states for step advancement
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentStepInitialDist, setCurrentStepInitialDist] = useState(0);
  const [liveRemainingMeters, setLiveRemainingMeters] = useState(0);
  const lastSpokenStepIndexRef = useRef(-1);
  const nextManeuverNotifiedRef = useRef(false);
  const nextManeuverWarningNotifiedRef = useRef(false);

  const { speak: speakPrompt, isVoiceMuted, setIsVoiceMuted, isSpeaking } = useVoice({ lang });

  const langRef = useRef(lang);
  useEffect(() => { langRef.current = lang; }, [lang]);

  const wakeLockRef = useRef(null);
  const watchIdRef = useRef(null);
  const socketRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const [liveCounts, setLiveCounts] = useState({});
  const lastOsrmFailTimeRef = useRef(0);
  const consecutiveArrivalsRef = useRef(0);
  const lastArrivalTimeRef = useRef(0);

  const activePandal = optimizedRoute[currentStopIndex] || null;

  // Polling fallback for live visitor counts
  useEffect(() => {
    const pollCounts = async () => {
      try {
        if (isSupabaseConfigured) {
          const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
          const { data, error } = await supabase
            .from('pandal_visits')
            .select('pandal_id')
            .gte('visited_at', since);
            
          if (!error && data) {
            const counts = {};
            data.forEach(row => {
              counts[row.pandal_id] = (counts[row.pandal_id] || 0) + 1;
            });
            setLiveCounts(counts);
          }
        }
      } catch (err) {
        console.warn('Polling failed:', err);
      }
    };

    pollCounts();
    
    pollingIntervalRef.current = setInterval(pollCounts, 60000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Request Wake Lock
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch (err) {
      console.warn('Wake Lock error:', err);
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current !== null) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  };

  const startTour = () => {
    if (optimizedRoute.length === 0) return;
    if (gpsPermissionDenied || !userLocation) {
      console.warn('Cannot start live navigation: GPS denied or user location unavailable.');
      return;
    }
    setIsNavigating(true);
    setCurrentStopIndex(0);
    setOsrmError(false);
    setCurrentStepIndex(0);
    lastSpokenStepIndexRef.current = -1;
    nextManeuverNotifiedRef.current = false;
    nextManeuverWarningNotifiedRef.current = false;
    requestWakeLock();

    // Silent utterance to unlock iOS/browser speech restrictions
    if (window.speechSynthesis) {
      const silent = new SpeechSynthesisUtterance('');
      window.speechSynthesis.speak(silent);
    }

    speakPrompt(t('start_tour'));
  };

  const endTour = () => {
    setIsNavigating(false);
    setRouteData(null);
    setCurrentManeuver(null);
    setOsrmError(false);
    releaseWakeLock();
    if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    speakPrompt(t('tour_complete'));
  };

  const getPandalName = useCallback((pandal) => {
    if (!pandal) return 'মণ্ডপ';
    if (lang === 'en') return pandal.name_en || pandal.name || 'মণ্ডপ';
    return pandal.name_bn || pandal.name || pandal.name_en || 'মণ্ডপ';
  }, [lang]);

  const sanitizeName = useCallback((p) => {
    let name = getPandalName(p);
    // Remove test prefix and pure digits, keep bengali words
    name = name.replace(/^Test\s*[\d.]+/i, '');
    name = name.replace(/^[A-Z\d-]+\s*/i, '');
    if (/^[\d.\s]+$/.test(name)) return 'মণ্ডপ';
    return name.trim() || 'মণ্ডপ';
  }, [getPandalName]);

  const skipToNext = () => {
    if (currentStopIndex < optimizedRoute.length - 1) {
      setCurrentStopIndex(prev => prev + 1);
      lastArrivalTimeRef.current = Date.now();
      const nextPandalName = sanitizeName(optimizedRoute[currentStopIndex + 1]);
      speakPrompt(`${t('skip')} ${nextPandalName}`);
    } else {
      endTour();
    }
  };

  const routeDataRef  = useRef(null);
  const isFetchingRef  = useRef(false);
  const lastAcceptedLocationRef = useRef(null);
  const lastProcessedRef = useRef(0);

  useEffect(() => {
    routeDataRef.current = routeData;
  }, [routeData]);

  // Setup GPS Watcher and Route Fetching
  useEffect(() => {
    if (!isNavigating || !activePandal || !userLocation) return;
    const processGPS = async () => {
      const now = Date.now();
      if (now - lastProcessedRef.current < 3000) return;
      lastProcessedRef.current = now;

      // 1. Ignore inaccurate GPS readings (Bounce Protection)
      if (userLocation.accuracy && userLocation.accuracy > 50) {
        console.warn('GPS reading ignored due to low accuracy:', userLocation.accuracy);
        return;
      }

      const rawLat = userLocation.lat;
      const rawLng = userLocation.lng;

      // Guard against GPS jumps > 100m
      if (lastAcceptedLocationRef.current) {
        const distJump = turf.distance(
          turf.point([lastAcceptedLocationRef.current[0], lastAcceptedLocationRef.current[1]]),
          turf.point([rawLng, rawLat])
        ) * 1000;
        
        if (distJump > 100 && (now - lastAcceptedLocationRef.current.time < 3000)) {
          console.warn('GPS glitch detected! Jumped', Math.round(distJump), 'meters in < 3s');
          return;
        }
      }
      lastAcceptedLocationRef.current = { 0: rawLng, 1: rawLat, time: now };
      const heading = userLocation.heading || 0;

      const rawUserPoint = turf.point([rawLng, rawLat]);
      const targetPoint = turf.point([activePandal.lng, activePandal.lat]);
      
      const distKm = turf.distance(rawUserPoint, targetPoint);
      const distMeters = Math.round(distKm * 1000);
      setDistanceToTarget(distMeters);

      // 2. Ghost Arrival Protection (<= ARRIVAL_RADIUS_METERS for 2 consecutive ticks)
      const nowMs = Date.now();
      const timeSinceLastArrival = nowMs - lastArrivalTimeRef.current;
      const ARRIVAL_GRACE_MS = 8000;

      if (distMeters <= ARRIVAL_RADIUS_METERS && timeSinceLastArrival > ARRIVAL_GRACE_MS) {
        consecutiveArrivalsRef.current += 1;
        if (consecutiveArrivalsRef.current >= 2) {
          // speakPrompt removed per fix 3
          consecutiveArrivalsRef.current = 0;
          lastArrivalTimeRef.current = nowMs;
          return;
        }
      } else {
        consecutiveArrivalsRef.current = 0;
      }

      // Fetch OSRM route once
      let currentRouteData = routeDataRef.current;

      if (!currentRouteData && !isFetchingRef.current) {
        if (Date.now() - lastOsrmFailTimeRef.current < 30000) {
          setOsrmError(true);
        } else {
          isFetchingRef.current = true;
          const route = await fetchOSRMRoute([rawLng, rawLat], [activePandal.lng, activePandal.lat]);
          isFetchingRef.current = false;
          
          if (route) {
            setRouteData(route);
            currentRouteData = route;
            routeDataRef.current = route;
            setOsrmError(false);
            if (route.legs && route.legs[0].steps.length > 0) {
              setCurrentStepIndex(0);
              const step = route.legs[0].steps[0];
              setCurrentStepInitialDist(step.distance || 0);
              const parsed = parseManeuver(step, t);
              setCurrentManeuver(parsed);
              const stepDist = step.distance || 0;
              const fallbackDist = Math.round(turf.distance(
                turf.point([rawLng, rawLat]),
                turf.point([activePandal.lng, activePandal.lat])
              ) * 1000);
              setLiveRemainingMeters(stepDist > 20 ? Math.round(stepDist) : fallbackDist);
              lastSpokenStepIndexRef.current = -1;
              nextManeuverNotifiedRef.current = false;
              nextManeuverWarningNotifiedRef.current = false;
            }
          } else {
            setOsrmError(true);
            lastOsrmFailTimeRef.current = Date.now();
          }
        }
      }

      if (currentRouteData && currentRouteData.legs && currentRouteData.legs[0].steps.length > 0) {
        const steps = currentRouteData.legs[0].steps;
        const step = steps[currentStepIndex];
        if (step) {
          let endLng, endLat;
          if (step.maneuver && step.maneuver.location) {
            [endLng, endLat] = step.maneuver.location;
          } else if (step.geometry && step.geometry.coordinates) {
            const coords = step.geometry.coordinates;
            [endLng, endLat] = coords[coords.length - 1];
          }

          if (endLng !== undefined && endLat !== undefined) {
            const stepEndLocation = turf.point([endLng, endLat]);
            const distToStepEndMeters = Math.round(turf.distance(rawUserPoint, stepEndLocation) * 1000);

            if (currentStepIndex < steps.length - 1) {
              const nextManeuverStep = steps[currentStepIndex + 1];
              const parsedNext = parseManeuver(nextManeuverStep, t);

              if (!parsedNext.skipVoice) {
                if (distToStepEndMeters >= 80 && distToStepEndMeters <= 120 && !nextManeuverWarningNotifiedRef.current) {
                  nextManeuverWarningNotifiedRef.current = true;
                  const toBn = (n) => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
                  const spokenDist = langRef.current === 'bn' ? toBn(distToStepEndMeters) : distToStepEndMeters;
                  
                  if (langRef.current === 'bn') {
                    speakPrompt(`${spokenDist} মিটার পর ${parsedNext.text}`);
                  } else {
                    speakPrompt(`In ${spokenDist} meters, ${parsedNext.text}`);
                  }
                } else if (distToStepEndMeters >= 15 && distToStepEndMeters <= 30 && !nextManeuverNotifiedRef.current) {
                  nextManeuverNotifiedRef.current = true;
                  speakPrompt(parsedNext.text);
                }
              }
            }

            if (distToStepEndMeters < ARRIVAL_RADIUS_METERS && currentStepIndex < steps.length - 1) {
              const nextIdx = currentStepIndex + 1;
              setCurrentStepIndex(nextIdx);
              nextManeuverNotifiedRef.current = false;
              nextManeuverWarningNotifiedRef.current = false;
              const nextStep = steps[nextIdx];
              setCurrentStepInitialDist(nextStep.distance || 0);
              const parsed = parseManeuver(nextStep, t);
              setCurrentManeuver(parsed);

              // Compute live distance to the new step end
              let nextEndLng, nextEndLat;
              if (nextStep.maneuver && nextStep.maneuver.location) {
                [nextEndLng, nextEndLat] = nextStep.maneuver.location;
              } else if (nextStep.geometry && nextStep.geometry.coordinates) {
                const c = nextStep.geometry.coordinates;
                [nextEndLng, nextEndLat] = c[c.length - 1];
              }

              if (nextEndLng !== undefined && nextEndLat !== undefined) {
                const nextEndPoint = turf.point([nextEndLng, nextEndLat]);
                const distToNewEnd = Math.round(
                  turf.distance(rawUserPoint, nextEndPoint) * 1000
                );
                setLiveRemainingMeters(distToNewEnd);
              } else {
                setLiveRemainingMeters(Math.round(nextStep.distance || 0));
              }

              if (lastSpokenStepIndexRef.current !== nextIdx && parsed) {
                lastSpokenStepIndexRef.current = nextIdx;
                const turnDist = Math.round(nextStep.distance || 0);
                
                if (!parsed.skipVoice && turnDist > 0) {
                  const toBn = (n) => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
                  const spokenDist = langRef.current === 'bn' ? toBn(turnDist) : turnDist;
                  
                  if (langRef.current === 'bn') {
                    speakPrompt(`${spokenDist} মিটার পর ${parsed.text}`);
                  } else {
                    speakPrompt(`In ${spokenDist} meters, ${parsed.text}`);
                  }
                }
              }
            } else {
              setLiveRemainingMeters(prev => {
                if (prev > 0 && distToStepEndMeters > 1.2 * prev) {
                  console.warn('Blocked jump in liveRemainingMeters from', prev, 'to', distToStepEndMeters);
                  return prev;
                }
                return distToStepEndMeters;
              });
            }
          }
        }
      }

      if (currentRouteData && currentRouteData.geometry) {
        try {
           const line = turf.lineString(currentRouteData.geometry.coordinates);
           const rawPoint = turf.point([rawLng, rawLat]);
           const snappedPoint = turf.nearestPointOnLine(line, rawPoint);
           const snappedCoords = snappedPoint.geometry.coordinates;
           
           const distFromRoute = turf.distance(rawPoint, snappedPoint) * 1000;
           if (distFromRoute > 40 && !isFetchingRef.current) {
             console.warn('Off-route detected:', distFromRoute, 'meters');
             clearRouteCache();
             setRouteData(null);
             routeDataRef.current = null;
             return;
           }

           const targetPoint = turf.point([activePandal.lng, activePandal.lat]);
           const slicedLine = turf.lineSlice(snappedPoint, targetPoint, line);
           setActiveRouteLine(slicedLine.geometry.coordinates);
        } catch(e) {
           console.error('Turf slicing error:', e);
        }
      }
    };
    processGPS();
  }, [userLocation, isNavigating, activePandal]);

  // Clear route cache when target pandal changes
  useEffect(() => {
    if (activePandal) {
      setRouteData(null);
      setActiveRouteLine(null);
      routeDataRef.current  = null;
      isFetchingRef.current = false;
      setOsrmError(false);
      clearRouteCache();
    }
  }, [activePandal?.id]);

  useEffect(() => {
    setRouteData(null);
    setCurrentManeuver(null);
  }, [currentStopIndex]);

  const speedKmH = APP_CONFIG.speeds[APP_CONFIG.planner.defaultMode] || 5;
  const etaMinutes = distanceToTarget !== null ? Math.ceil(((distanceToTarget / 1000) / speedKmH) * 60) : null;

  const announcedPandalRef = useRef(null);
  useEffect(() => {
    if (activePandal && distanceToTarget !== null && isNavigating) {
      if (announcedPandalRef.current !== activePandal.id) {
        announcedPandalRef.current = activePandal.id;
        const name = sanitizeName(activePandal);
        if (lang === 'en') {
          speakPrompt(`Next pandal ${name}, ${distanceToTarget} meters ahead`);
        } else {
          speakPrompt(`পরবর্তী মণ্ডপ ${name}, আর ${distanceToTarget} মিটার`);
        }
      }
    }
  }, [activePandal, distanceToTarget, isNavigating, lang, speakPrompt, sanitizeName]);

  return {
    isNavigating,
    currentStopIndex,
    activePandal,
    nextPandal: activePandal,
    currentManeuver,
    direction: currentManeuver,
    userLocation,
    distanceToTarget,
    distanceMeters: distanceToTarget,
    liveRemainingMeters,
    etaMinutes,
    routeData,
    activeRouteLine,
    startTour,
    endTour,
    skipToNext,
    isVoiceMuted,
    setIsVoiceMuted,
    isSpeaking,
    osrmError,
    gpsPermissionDenied,
    liveCounts,
    speakPrompt
  };
}
