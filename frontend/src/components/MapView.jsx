"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, Tooltip, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapPin, Navigation, Star, Zap, Users, CheckCircle, MessageSquarePlus, AlertTriangle, Route, Search, ChevronUp } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import ReviewModal from './ReviewModal';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { safeStorage } from '@/utils/storage';
import { haversineDistance } from '../utils/tspSolver';
import { getPandalPinIcon } from './PandalPin';

// Fix for default Leaflet icon paths in Next.js
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Orange Icon for Trending Pandals
// eslint-disable-next-line no-unused-vars
const trendingIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Pulse effect for Live Navigation GPS Location (with directional arrow)
const getLivePulseIcon = (heading = 0) => L.divIcon({
  className: 'live-pulse-marker',
  html: `<div class="relative flex items-center justify-center w-24 h-24" style="transform: rotate(${heading}deg); transition: transform 0.5s ease-out;">
           <!-- Directional Cone (Google Maps Style) -->
           <div class="absolute w-24 h-24 bg-gradient-to-t from-blue-500/0 via-blue-400/20 to-blue-400/60 rounded-full" style="clip-path: polygon(50% 50%, 15% 0%, 85% 0%);"></div>
           <!-- Center Dot (Google Maps Style) -->
           <div class="relative w-5 h-5 bg-[#4285F4] rounded-full border-[3.5px] border-white shadow-[0_0_8px_rgba(0,0,0,0.4)] z-10"></div>
         </div>`,
  iconSize: [96, 96],
  iconAnchor: [48, 48]
});

// eslint-disable-next-line no-unused-vars
const routeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Zoom Tracker Component
function ZoomTracker({ onZoom }) {
  useMapEvents({
    zoomend: (e) => onZoom(e.target.getZoom()),
  });
  return null;
}

// Fly To Component
function FlyToController({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo(target, 17);
    }
  }, [target, map]);
  return null;
}

// Auto-Pan Component
function AutoCenterMap({ position, isNavigating, userLocation, selectedRoute, isUserPanning, setIsUserPanning }) {
  const map = useMap();

  useEffect(() => {
    const handlePanStart = () => setIsUserPanning(true);
    map.on('dragstart', handlePanStart);
    map.on('zoomstart', handlePanStart);
    
    return () => {
      map.off('dragstart', handlePanStart);
      map.off('zoomstart', handlePanStart);
    };
  }, [map, setIsUserPanning]);

  useEffect(() => {
    if (isUserPanning) return; // Guard for fix 1

    if (isNavigating && position) {
      const zoom = map.getZoom() > 16 ? map.getZoom() : 18;
      
      // Calculate drawer height
      let drawerHeight = 220; // Fallback
      if (typeof document !== 'undefined') {
        const hudElement = document.getElementById('planner-drawer');
        if (hudElement) {
          drawerHeight = hudElement.getBoundingClientRect().height + 32;
        }
      }

      // Offset camera to keep user pin above the drawer
      const latLng = L.latLng(position[0], position[1]);
      const targetPoint = map.project(latLng, zoom);
      targetPoint.y += drawerHeight / 2;
      const offsetLatLng = map.unproject(targetPoint, zoom);

      map.setView(offsetLatLng, zoom, {
        animate: true,
        duration: 0.5,
      });
    } else if (selectedRoute && selectedRoute.length > 0) {
      const points = userLocation ? [{ lat: userLocation.lat, lng: userLocation.lng }, ...selectedRoute] : selectedRoute;
      const bounds = L.latLngBounds(points.map(p => [p.lat || p[0], p.lng || p[1]]));
      map.fitBounds(bounds, { padding: [50, 50], animate: true, duration: 0.5 });
    } else if (userLocation) {
      map.setView([userLocation?.lat, userLocation?.lng], 16, { animate: true });
    }
  }, [position, isNavigating, userLocation, selectedRoute, map, isUserPanning]);

  return null;
}

export default function MapView({ 
  pandalsData = [], 
  selectedRoute = [], 
  onAddPandal, 
  onRemovePandal,
  isRouteMode,
  isNavigating = false,
  userLocation = null,
  routeData = null,
  activeRouteLine = null,
  activePandal = null,
  liveCounts = {},
  onOpenPlanner,
  drawerOpen = false,
  drawerState = 'closed',
  mode = 'discover',
  isGpsReady = true,
  onRequestGps
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [flyToTarget, setFlyToTarget] = useState(null);

  const computeResults = (query) => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    return pandalsData
      .filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.name_en || '').toLowerCase().includes(q) ||
        (p.name_bn || '').toLowerCase().includes(q)
      )
      .slice(0, 5);
  };
  const userLat = userLocation?.lat;
  const userLng = userLocation?.lng;

  const { lang, t } = useLanguage();
  const [reviewPandal, setReviewPandal] = useState(null);
  const [osrmError, setOsrmError] = useState(false);
  const [isUserPanning, setIsUserPanning] = useState(false);
  const [hudHeight, setHudHeight] = useState(0);
  
  const getMapCenterAndZoom = () => {
    if (userLocation) return { center: [userLocation.lat, userLocation.lng], zoom: 14 };
    if (!pandalsData || pandalsData.length === 0) return { center: [23.2324, 87.8615], zoom: 11 };
    
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    pandalsData.forEach(p => {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    });
    const midLat = (minLat + maxLat) / 2;
    const midLng = (minLng + maxLng) / 2;
    return { center: [midLat, midLng], zoom: 12 };
  };

  const { center: mapCenter, zoom: mapZoom } = getMapCenterAndZoom();

  // State to track zoom level for marker tooltips
  const [currentZoom, setCurrentZoom] = useState(mapZoom);

  const osrmPolyline = activeRouteLine 
    ? activeRouteLine.map(c => [c[1], c[0]])
    : routeData?.geometry?.coordinates?.map(c => [c[1], c[0]]) || [];

  const previewPolyline = useMemo(() => {
    if (isNavigating) return null;
    if (!selectedRoute || selectedRoute.length < 2) return null;

    const coords = [];

    // Start at user location
    if (userLocation) {
      coords.push([userLocation.lat, userLocation.lng]);
    }

    // Add each pandal in order
    selectedRoute.forEach(p => {
      if (p && p.id !== '__START__' && p.id !== 'END' && p.lat !== undefined && p.lng !== undefined) {
        coords.push([p.lat, p.lng]);
      }
    });

    // Return to start
    if (userLocation) {
      coords.push([userLocation.lat, userLocation.lng]);
    }

    return coords.length >= 2 ? coords : null;
  }, [isNavigating, mode, selectedRoute, userLocation]);

  const handleCheckIn = useCallback(async (pandal) => {
    // Geofence check
    if (!userLocation) {
      alert(t('map_no_location'));
      return;
    }
    const distMeters = haversineDistance(userLocation, pandal) * 1000;
    if (distMeters > 120) {
      alert(t('map_too_far', { dist: Math.round(distMeters) }));
      return;
    }

    const lastCheckIn = safeStorage.get(`last_checkin_${pandal.id}`);
    const now = Date.now();
    // 2 hours cooldown
    if (lastCheckIn && (now - parseInt(lastCheckIn)) < 2 * 60 * 60 * 1000) {
      alert(t('map_already_checked_in'));
      return;
    }

    try {
      if (isSupabaseConfigured) {
        await supabase.from('pandal_visits').insert([{ pandal_id: String(pandal.id) }]);
      }
      safeStorage.set(`last_checkin_${pandal.id}`, now.toString());
      alert(t('map_checkin_success'));
    } catch (err) {
      console.error(err);
      alert(t('map_checkin_error'));
    }
  }, [userLocation]);

  // Determine which polyline to show during navigation
  const stablePosition = useMemo(() => {
    if (isNavigating && userLat && userLng) {
      return [userLat, userLng];
    }
    return null;
  }, [isNavigating, userLat, userLng]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isNavigating) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHudHeight(0);
      return;
    }
    const el = document.getElementById('navigation-hud');
    if (!el) return;

    const updateHeight = () => {
      setHudHeight(el.getBoundingClientRect().height);
    };
    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isNavigating]);

  return (
    <div className="relative w-full h-[100dvh] bg-gray-50 overflow-hidden">
      {!isNavigating && (
        <div className="absolute top-4 left-16 right-4 z-[999] max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchResults(computeResults(e.target.value));
              }}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              placeholder={t('search_pandals')}
              className="w-full h-[44px] pl-10 pr-4 bg-white rounded-[12px] shadow-md text-[15px] outline-none border border-gray-100 text-gray-900 placeholder:text-gray-500"
            />
          </div>
          {searchResults.length > 0 && isSearchFocused && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-[12px] shadow-md overflow-hidden max-h-60 overflow-y-auto">
              {searchResults.map((pandal) => (
                <button
                  key={pandal.id}
                  onClick={() => {
                    setFlyToTarget([pandal.lat, pandal.lng]);
                    setSearchQuery('');
                    setSearchResults([]);
                    setIsSearchFocused(false);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 flex flex-col"
                >
                  <span className="font-semibold text-gray-800 text-[15px]">{pandal.name}</span>
                  {pandal.zone && <span className="text-xs text-gray-500">{pandal.zone}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <MapContainer 
        center={mapCenter} 
        zoom={mapZoom} 
        maxZoom={19}
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          url="https://puja-tiles-proxy.devsahatech.workers.dev/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a>'
          maxNativeZoom={19}
          maxZoom={22}
        />
        
        {/* Helper Components */}
        <ZoomTracker onZoom={setCurrentZoom} />
        <FlyToController target={flyToTarget} />

        <AutoCenterMap 
          position={stablePosition} 
          isNavigating={isNavigating} 
          userLocation={userLocation}
          selectedRoute={selectedRoute} 
          isUserPanning={isUserPanning}
          setIsUserPanning={setIsUserPanning}
        />


        {userLocation && (
          <Marker 
            position={[userLocation.lat, userLocation.lng]} 
            icon={getLivePulseIcon(userLocation.heading || 0)}
            zIndexOffset={1000}
          >
            {!isNavigating && (
              <Popup>
                <div className="text-center font-bold text-gray-800">Your Location</div>
              </Popup>
            )}
          </Marker>
        )}


        {isNavigating && activePandal && (
          <>
            {/* OSRM Route (primary) */}
            {osrmPolyline.length > 0 && !osrmError && (
              <Polyline 
                positions={osrmPolyline} 
                pathOptions={{ color: '#4285F4', weight: 7, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }} 
              />
            )}
            
            {/* Fallback indicator */}
            {osrmError && (
              <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                OSRM লিমিট পৌঁছেছে, সরাসরি রুট দেখানো হচ্ছে
              </div>
            )}
          </>
        )}

        {previewPolyline && (
          <Polyline
            positions={previewPolyline}
            pathOptions={{
              color: '#8B1E3F',
              weight: 3,
              opacity: 0.5,
              dashArray: '6, 8',
              lineCap: 'round',
              lineJoin: 'round',
              interactive: false,
            }}
          />
        )}

        {pandalsData.map((pandal) => {
          const isAdded = selectedRoute.some(p => p.id === pandal.id);
          const routeIndex = selectedRoute.findIndex(p => p.id === pandal.id);
          const count = liveCounts[pandal.id] || 0;
          const distMeters = userLocation ? haversineDistance(userLocation, pandal) * 1000 : Infinity;
          const checkInText = (distMeters >= 75 && distMeters <= 120) ? (lang === 'en' ? 'I am near the pandal (Check-in)' : t('map_checkin')) : t('map_checkin');

          return (
            <Marker 
              key={pandal.id} 
              position={[pandal.lat, pandal.lng]}
              icon={getPandalPinIcon({
                state: isAdded ? 'selected' : (pandal.trending === true ? 'trending' : 'default'),
                index: isAdded ? routeIndex + 1 : 0,
                zoom: currentZoom
              })}
            >
              {currentZoom >= 15 && (
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -36]}
                  className="pandal-name-label"
                  opacity={0.95}
                >
                  {lang === 'en' ? pandal.name_en || pandal.name : pandal.name_bn || pandal.name}
                </Tooltip>
              )}
              {!isNavigating && (
                <Popup className="custom-popup" minWidth={250}>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-2">
                      <div>
                        <h3 className="font-bold text-gray-900 text-[15px] m-0 leading-tight">
                          {isAdded && <span className="inline-block bg-blue-600 text-white rounded-full w-5 h-5 text-center text-xs leading-5 mr-1 font-sans">{routeIndex + 1}</span>}
                          {lang === 'en' ? pandal.name_en || pandal.name : pandal.name_bn || pandal.name}
                        </h3>
                        <div className="flex flex-col gap-1 mt-1">
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <MapPin className="w-3 h-3" /> {pandal.zone}
                          </div>
                          {count > 0 && (
                            <div className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full w-max mt-1">
                              <Users className="w-3 h-3" /> ● {count} {t('map_visitors_present')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-gray-100">
                      {mode === 'discover' && (
                        <button 
                          onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${pandal.lat},${pandal.lng}`, '_blank')}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md font-bold flex items-center justify-center gap-1 transition-colors shadow-sm"
                        >
                          <span className="flex items-center gap-1"><Navigation className="w-4 h-4" /> এখানে যান</span>
                        </button>
                      )}
                      
                      {mode === 'plan' && (
                        <>
                          <button 
                            onClick={() => {
                              if (isAdded && onRemovePandal) {
                                onRemovePandal(pandal.id);
                                return;
                              }
                              if (!isGpsReady) {
                                onRequestGps && onRequestGps();
                                return;
                              }
                              onAddPandal && onAddPandal(pandal);
                            }}
                            className={`w-full py-2 rounded-md font-bold flex items-center justify-center gap-1 transition-all shadow-sm ${
                              !isGpsReady
                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                : isAdded 
                                  ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100' 
                                  : 'bg-red-800 hover:bg-red-900 text-white'
                            }`}
                          >
                            {isAdded ? t('map_remove_from_route') : t('map_add_to_route')}
                          </button>
                          <button 
                            onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${pandal.lat},${pandal.lng}`, '_blank')}
                            className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 py-1.5 rounded-md font-semibold flex items-center justify-center gap-1 transition-colors"
                          >
                            <span className="flex items-center gap-1"><Navigation className="w-4 h-4" /> এখানে যান</span>
                          </button>
                        </>
                      )}

                      {mode === 'navigate' && (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <button 
                              onClick={() => handleCheckIn(pandal)}
                              disabled={distMeters > 120}
                              className={`py-1.5 rounded-md font-semibold flex items-center justify-center gap-1 transition-colors ${
                                distMeters > 120 
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed text-[10px] leading-tight px-1' 
                                  : 'bg-stone-100 hover:bg-green-50 hover:text-green-700 text-stone-700 border border-stone-200 text-xs'
                              }`}
                            >
                              <CheckCircle className="w-3.5 h-3.5 shrink-0" /> {distMeters > 120 ? t('map_checkin_near') : t('map_checkin')}
                            </button>
                            <button 
                              onClick={() => setReviewPandal(pandal)}
                              className="bg-stone-100 hover:bg-amber-50 hover:text-amber-700 text-stone-700 border border-stone-200 py-1.5 rounded-md font-semibold flex items-center justify-center gap-1 transition-colors text-xs"
                            >
                              <MessageSquarePlus className="w-3.5 h-3.5" /> {t('map_give_tips')}
                            </button>
                          </div>
                          <button 
                            onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${pandal.lat},${pandal.lng}`, '_blank')}
                            className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 py-1.5 rounded-md font-semibold flex items-center justify-center gap-1 transition-colors mt-1"
                          >
                            <span className="flex items-center gap-1"><Navigation className="w-4 h-4" /> এখানে যান</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </Popup>
              )}
            </Marker>
          );
        })}

      </MapContainer>

      {isUserPanning && userLocation && (
        <button
          onClick={() => {
            setIsUserPanning(false);
            if (!isNavigating) {
              setFlyToTarget([userLocation.lat, userLocation.lng]);
            }
          }}
          className="absolute right-4 z-[1000] flex items-center justify-center bg-[#8B1E3F] hover:bg-[#701830] text-white rounded-full shadow-[0_4px_12px_rgba(139,30,63,0.35)] w-12 h-12 transition-all duration-300"
          style={{
            bottom: isNavigating
              ? (hudHeight > 0 ? `${hudHeight + 16}px` : '50vh')
              : (drawerOpen ? 'calc(45vh + 16px)' : '96px')
          }}
          aria-label="Re-centre"
          title="Re-centre"
        >
          <Navigation className="w-5 h-5" />
        </button>
      )}

      {reviewPandal && (
        <ReviewModal 
          pandalId={reviewPandal.id}
          pandalName={lang === 'en' ? reviewPandal.name_en || reviewPandal.name : reviewPandal.name_bn || reviewPandal.name}
          onClose={() => setReviewPandal(null)} 
        />
      )}

      {!isNavigating && !drawerOpen && onOpenPlanner && (
        <button
          onClick={onOpenPlanner}
          className="absolute left-1/2 -translate-x-1/2 z-[1000] flex items-center justify-center bg-[#8B1E3F] hover:bg-[#701830] text-white rounded-full shadow-[0_4px_12px_rgba(139,30,63,0.35)] w-12 h-12 transition-all duration-300 pointer-events-auto"
          style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
          aria-label={t('pl_open_planner') || "Open planner"}
        >
          <ChevronUp className="w-6 h-6 text-white" />
        </button>
      )}
    </div>
  );
}

