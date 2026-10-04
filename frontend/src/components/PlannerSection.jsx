"use client";

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  MapPin, Play, Navigation, X, AlertCircle, List, Compass,
  Footprints, Bike, Car, Trophy, Star, Timer, Infinity as InfinityIcon,
  Clock, Eye, Ruler, Flag, ChevronRight, Moon, ChevronDown, ChevronUp,
  Settings2, Share, ExternalLink, Zap, Target, PlusCircle
} from 'lucide-react';
import {
  solveTsp, filterTopN, solveBudget, calcItinerary,
  formatDuration, TRANSPORT_MODES, haversineDistance
} from '../utils/tspSolver';
import { generateGoogleMapsUrl } from '../utils/navigationUrl';
import { APP_CONFIG } from '../config/appConfig';

function formatDurationBn(totalMinutes) {
  const rounded = Math.round(totalMinutes);
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (hours === 0) return `${mins} মি`;
  if (mins === 0) return `${hours} ঘণ্টা`;
  return `${hours} ঘণ্টা ${mins} মি`;
}

import { useLiveNavigator } from '../hooks/useLiveNavigator';
import LiveNavigationHUD from './LiveNavigationHUD';
import PandalListModal from './PandalListModal';
import { useLanguage } from '@/context/LanguageContext';
import Swal from 'sweetalert2';
import {
  getBatchProgress,
  setBatchProgress,
  clearBatchProgress,
  computeRouteSignature,
  getBatchCount
} from '../lib/batchStorage';

// Dynamically import MapView with SSR disabled
const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => {
    return (

      <div className="w-full h-full bg-stone-100 animate-pulse flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <MapPin className="w-8 h-8 text-amber-400 animate-bounce" />
          <span className="text-amber-700 font-medium">Loading map... / ম্যাপ লোড হচ্ছে...</span>
        </div>
      </div>

    );
  }
});

// --- Transport Mode pills ---
const TRANSPORT_PILLS = [
  { key: 'walking', Icon: Footprints, label: 'হেঁটে', labelEn: 'Walk', labelBng: 'Walk' },
  { key: 'car', Icon: Car, label: 'গাড়িতে', labelEn: 'Vehicle', labelBng: 'Vehicle' },
];

const TOP_N_OPTIONS = [
  { n: 5, Icon: Trophy, label: 'Top 5' },
  { n: 10, Icon: Star, label: 'Top 10' },
  { n: 15, Icon: Star, label: 'Top 15' },
  { n: -1, Icon: Flag, label: lang => lang === 'en' ? 'All' : (lang === 'bn' ? 'সব' : 'Sob') },
];

const BUDGET_OPTIONS = [
  { minutes: 120, Icon: Zap, label: '2 ঘণ্টা', labelEn: '2 hours' },
  { minutes: 240, Icon: Timer, label: '4 ঘণ্টা', labelEn: '4 hours' },
  { minutes: 360, Icon: Moon, label: '6 ঘণ্টা', labelEn: '6 hours' },
  { minutes: -1, Icon: InfinityIcon, label: 'সারা দিন', labelEn: 'All day' },
];

import { useRoutePersistence } from '../hooks/useRoutePersistence';
import { useGeolocation } from '../hooks/useGeolocation';

// Arrival time helper
function getArrivalTime(addMin, lang) {
  const d = new Date(Date.now() + addMin * 60000);
  return d.toLocaleTimeString(lang === 'en' ? 'en-IN' : 'bn-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true
  });
}

export default function PlannerSection() {
  const { lang, t } = useLanguage();
  const [pandalsData, setPandalsData] = useState([]);
  const [isMounted, setIsMounted] = useState(false);
  const [drawerState, setDrawerState] = useState('half');
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchCurrentY, setTouchCurrentY] = useState(null);
  const { position: startLocation, error: gpsError, permission: gpsPermission, retry: retryGPS } = useGeolocation({ mode: 'once' });
  const isGpsReady = gpsPermission !== 'denied' && !!startLocation;

  const [hasSelectedTime, setHasSelectedTime] = useState(false);
  const [isPickingFromMap, setIsPickingFromMap] = useState(false);
  const [uiMode, setUiMode] = useState('main'); // 'main' or 'map_pick'
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [isListModalOpen, setIsListModalOpen] = useState(false);

  const [batchState, setBatchState] = useState(null);

  const handleTouchStart = (e) => setTouchStartY(e.touches[0].clientY);
  const handleTouchMove = (e) => setTouchCurrentY(e.touches[0].clientY);
  const handleTouchEnd = () => {
    if (touchStartY === null || touchCurrentY === null) return;
    const diff = touchCurrentY - touchStartY;
    setTouchStartY(null);
    setTouchCurrentY(null);

    if (diff > 80) {
      setDrawerState(drawerState === 'expanded' ? 'half'
        : drawerState === 'half' ? 'closed'
          : 'closed');
    } else if (diff < -80) {
      setDrawerState(drawerState === 'closed' ? 'half'
        : drawerState === 'half' ? 'expanded'
          : 'expanded');
    }
  };

  // Route Persistence state
  const { routeState, updateRouteState, resetPlan } = useRoutePersistence();

  // UI State mapping to routeState
  const plannerTab = routeState.plannerTab !== undefined ? routeState.plannerTab : 'budget';
  const topN = routeState.topN !== undefined ? routeState.topN : 5;
  const budgetMin = routeState.budgetMin !== undefined ? routeState.budgetMin : 240;
  const transportMode = routeState.transportMode || 'walking';
  const manualPandals = routeState.manualPandals || [];
  const hasUserInteracted = routeState.hasUserInteracted || false;

  const [gpsLoadTimedOut, setGpsLoadTimedOut] = useState(false);

  useEffect(() => {
    if (!hasUserInteracted || startLocation) {
      setGpsLoadTimedOut(false);
      return;
    }
    const t = setTimeout(() => setGpsLoadTimedOut(true), 6000);
    return () => clearTimeout(t);
  }, [hasUserInteracted, startLocation]);

  const showGpsLoader = hasUserInteracted && !startLocation && !gpsLoadTimedOut;

  const [liveCounts, setLiveCounts] = useState({});
  const [errorPandals, setErrorPandals] = useState(null);

  useEffect(() => setIsMounted(true), []);

  const setPlannerTab = (val) => updateRouteState({ plannerTab: val });
  const setTopN = (val) => updateRouteState({ topN: val });
  const setBudgetMin = (val) => updateRouteState({ budgetMin: val });
  const setTransportMode = (val) => updateRouteState({ transportMode: val });
  const setManualPandals = (val) => updateRouteState({ manualPandals: typeof val === 'function' ? val(manualPandals) : val });

  useEffect(() => {
    fetch('/data/pandals.json')
      .then(r => {
        if (!r.ok) throw new Error('Failed to fetch');
        return r.json();
      })
      .then(d => {
        setPandalsData(d);
        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          const stopsParam = urlParams.get('stops');
          const modeParam = urlParams.get('mode');
          if (stopsParam) {
            const stopIds = stopsParam.split(',');
            const selected = d.filter(p => stopIds.includes(String(p.id)));
            if (selected.length > 0) {
              updateRouteState({
                plannerTab: 'manual',
                manualPandals: selected,
                transportMode: modeParam || 'walking'
              });
              updateRouteState({ hasUserInteracted: true });
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          }
        }
      })
      .catch(err => {
        console.error('Error loading pandals:', err);
        setErrorPandals(t('pl_load_error'));
      });
  }, [updateRouteState]);

  const { optimizedRoute, stats, trimMessage, isPreviewMode } = useMemo(() => {
    if (pandalsData.length === 0) return { optimizedRoute: [], stats: null, trimMessage: null, isPreviewMode: false };
    if (!hasUserInteracted) return { optimizedRoute: [], stats: null, trimMessage: null, isPreviewMode: false };

    let isPreview = false;

    const effectiveTopN = topN === -1 ? null : topN;
    const effectiveBudgetMin = budgetMin === -1 ? null : budgetMin;

    let selectedForCalc = [];
    if (plannerTab === 'top' && topN !== null) {
      selectedForCalc = filterTopN(pandalsData, effectiveTopN, startLocation, APP_CONFIG.planner.maxRadiusKm);
    } else if (plannerTab === 'budget' && budgetMin !== null) {
      let candidates = pandalsData;
      if (startLocation && APP_CONFIG.planner.maxRadiusKm) {
        candidates = candidates.filter(p =>
          haversineDistance(startLocation, p) <= APP_CONFIG.planner.maxRadiusKm
        );
      }
      selectedForCalc = [...candidates].sort((a, b) => (a.popularity ?? 99) - (b.popularity ?? 99));
    } else if (plannerTab === 'manual') {
      selectedForCalc = manualPandals;
    }

    if (selectedForCalc.length === 0) return { optimizedRoute: [], stats: null, trimMessage: null, isPreviewMode: false };

    let origin = startLocation;

    if (!origin) {
      origin = { lat: selectedForCalc[0].lat, lng: selectedForCalc[0].lng };
      isPreview = true;
    }

    const END_NODE = { id: 'END', name: 'Return to Start', name_bn: t('pl_start_location'), name_en: 'Return to Start', zone: 'Destination', lat: origin.lat, lng: origin.lng };

    const effectiveTransportMode = transportMode;

    const buildRoute = (pandals) => {
      if (pandals.length === 0) return { optimizedRoute: [], stats: null, trimMessage: null, isPreviewMode: isPreview };
      const nodes = isPreview ? [...pandals] : [{ id: '__START__', ...origin }, ...pandals];
      const solved = solveTsp(nodes, effectiveTransportMode).filter(p => p.id !== '__START__');
      const itin = calcItinerary(origin, solved, effectiveTransportMode);
      return { optimizedRoute: [...solved, END_NODE], stats: itin, trimMessage: null, isPreviewMode: isPreview };
    };

    if (plannerTab === 'budget' && effectiveBudgetMin) {
      const { selected, stats: itin, trimmedCount } = solveBudget(origin, pandalsData, effectiveBudgetMin, effectiveTransportMode, APP_CONFIG.planner.maxRadiusKm);
      const bLabel = BUDGET_OPTIONS.find(b => b.minutes === budgetMin);
      const trimMsg = trimmedCount > 0 ? `আপনার ${(lang === 'en' ? bLabel?.labelEn : (lang === 'bn' ? bLabel?.label : bLabel?.labelBng)) ?? 'নির্ধারিত'} বাজেটে সেরা ${selected.length}টি মণ্ডপ নির্বাচিত` : null;
      return { optimizedRoute: selected.length > 0 ? [...selected, END_NODE] : [], stats: itin, trimMessage: trimMsg, isPreviewMode: isPreview };
    }

    return buildRoute(selectedForCalc);
  }, [pandalsData, plannerTab, topN, budgetMin, transportMode, manualPandals, startLocation, hasUserInteracted]);

  const selectedCount = useMemo(
    () => optimizedRoute.filter(p => p.id !== '__START__' && p.id !== 'END').length,
    [optimizedRoute]
  );

  const liveNavState = useLiveNavigator(optimizedRoute, lang, t);

  useEffect(() => {
    if (liveNavState.liveCounts) {
      setLiveCounts(liveNavState.liveCounts);
    }
  }, [liveNavState.liveCounts]);

  useEffect(() => {
    const stops = optimizedRoute
      .filter(p => p.id !== 'END' && p.id !== '__START__')
      .map(p => p.id);

    const loadBatchState = async () => {
      if (stops.length <= 10) {
        setBatchState(null);
        return;
      }

      const sig = computeRouteSignature(stops);
      const record = await getBatchProgress(sig);
      if (record && record.currentBatchIndex < record.batches.length) {
        setBatchState(record);
      } else {
        setBatchState(null);
      }
    };

    loadBatchState();
  }, [optimizedRoute]);

  const handleAddPandal = (pandal) => {
    setPlannerTab('manual');
    updateRouteState({ hasUserInteracted: true });
    if (!manualPandals.some(p => p.id === pandal.id))
      setManualPandals(prev => [...prev, pandal]);
  };

  const handleRemovePandal = (id) => {
    if (plannerTab !== 'manual') {
      const currentPandals = optimizedRoute.filter(p => p.id !== 'END' && p.id !== '__START__' && p.id !== id);
      setManualPandals(currentPandals);
      setPlannerTab('manual');
    } else {
      setManualPandals(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleOtherTime = async () => {
    const { value } = await Swal.fire({
      title: t('pl_other_time_title'),
      input: 'number',
      inputAttributes: { min: 30, max: 720 },
      inputPlaceholder: t('pl_other_time_placeholder'),
      showCancelButton: true,
      confirmButtonText: t('pl_other_time_confirm'),
      cancelButtonText: t('pl_other_time_cancel'),
      confirmButtonColor: '#8B1E3F',
      cancelButtonColor: '#999',
    });

    if (value === undefined || value === null || value === '') return;

    const mins = parseInt(value, 10);
    if (isNaN(mins) || mins < 30 || mins > 720) {
      Swal.fire({
        icon: 'warning',
        title: t('pl_other_time_error_title'),
        text: t('pl_other_time_error_body'),
        confirmButtonColor: '#8B1E3F',
        confirmButtonText: t('pl_other_time_confirm'),
      });
      return;
    }

    setBudgetMin(null);
    setTopN(null);
    setPlannerTab(null);
    setHasSelectedTime(false);

    setBudgetMin(mins);
    setPlannerTab('budget');
    setHasSelectedTime(true);
    updateRouteState({ hasUserInteracted: true });
  };

  const buildGmapsUrlForBatch = (batchIndex, liveOrigin, startingLoc, mode, state = batchState) => {
    if (!state) return null;
    const allBatches = state.batches;
    const thisBatch = allBatches[batchIndex];
    if (!thisBatch || thisBatch.length === 0) return null;

    const batchPandals = thisBatch
      .map(id => optimizedRoute.find(p => p.id === id))
      .filter(Boolean);
    if (batchPandals.length === 0) return null;

    // Origin: prefer the LIVE user location (GPS) passed in.
    // If liveOrigin is null, fall back to the last pandal of the
    // previous batch (best guess).
    let batchOrigin = liveOrigin;
    if (!batchOrigin) {
      if (batchIndex === 0) return null;  // can't route without origin
      const prevBatch = allBatches[batchIndex - 1];
      const prevLastId = prevBatch[prevBatch.length - 1];
      const prevLastPandal = optimizedRoute.find(p => p.id === prevLastId);
      if (!prevLastPandal) return null;
      batchOrigin = { lat: prevLastPandal.lat, lng: prevLastPandal.lng };
    }

    // Destination:
    const isLastBatch = batchIndex === allBatches.length - 1;
    let batchDestination;
    if (isLastBatch) {
      // Return to the user's original starting location
      batchDestination = startingLoc || batchOrigin;
    } else {
      // End at the last pandal of this batch
      const lastPandal = batchPandals[batchPandals.length - 1];
      batchDestination = { lat: lastPandal.lat, lng: lastPandal.lng };
    }

    // Waypoints: all pandals except the destination
    const wpPandals = isLastBatch
      ? batchPandals
      : batchPandals.slice(0, batchPandals.length - 1);
    const wp = wpPandals.map(s => `${s.lat},${s.lng}`).join('|');

    return `https://www.google.com/maps/dir/?api=1&origin=${batchOrigin.lat},${batchOrigin.lng}&destination=${batchDestination.lat},${batchDestination.lng}${wp ? '&waypoints=' + wp : ''}&travelmode=${mode}`;
  };

  const handleOpenGmaps = async () => {
    const stops = optimizedRoute.filter(p => p.id !== 'END' && p.id !== '__START__');
    if (stops.length === 0) return;

    const originLoc = liveNavState?.userLocation || startLocation || { lat: stops[0].lat, lng: stops[0].lng };
    const mode = transportMode === 'car' ? 'driving' : 'walking';

    if (stops.length <= 10) {
      const wp = stops.map(s => `${s.lat},${s.lng}`).join('|');
      const url = `https://www.google.com/maps/dir/?api=1&origin=${originLoc.lat},${originLoc.lng}&destination=${originLoc.lat},${originLoc.lng}${wp ? '&waypoints=' + wp : ''}&travelmode=${mode}`;
      if (typeof window !== 'undefined') window.open(url, '_blank');
      return;
    }

    const stopIds = stops.map(s => s.id);
    const batchSize = 10;
    const batches = [];
    for (let i = 0; i < stopIds.length; i += batchSize) {
      batches.push(stopIds.slice(i, i + batchSize));
    }
    const sig = computeRouteSignature(stopIds);

    if (batchState && batchState.routeSignature === sig && batchState.currentBatchIndex < batches.length) {
      const liveOrigin = liveNavState?.userLocation || originLoc;
      const startingLoc = batchState.startingLoc || originLoc;
      const url = buildGmapsUrlForBatch(
        batchState.currentBatchIndex,
        liveOrigin,
        startingLoc,
        mode,
        batchState
      );
      if (url && typeof window !== 'undefined') window.open(url, '_blank');
      return;
    }

    const result = await Swal.fire({
      title: t('pl_more_than_10'),
      icon: 'info',
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: t('pl_open_first_10'),
      denyButtonText: t('pl_one_by_one'),
      cancelButtonText: t('pl_cancel'),
    });

    if (result.isConfirmed) {
      const record = {
        routeSignature: sig,
        batches,
        currentBatchIndex: 0,
        startingLoc: originLoc,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await setBatchProgress(sig, record);
      setBatchState(record);

      const liveOrigin = liveNavState?.userLocation || originLoc;
      const url = buildGmapsUrlForBatch(0, liveOrigin, originLoc, mode, record);
      if (url && typeof window !== 'undefined') window.open(url, '_blank');
    } else if (result.isDenied) {
      liveNavState.startTour();
    }
  };

  const handleBatchAdvance = async () => {
    if (!batchState) return;
    const nextIndex = batchState.currentBatchIndex + 1;
    if (nextIndex >= batchState.batches.length) {
      await clearBatchProgress(batchState.routeSignature);
      setBatchState(null);
      Swal.fire({
        icon: 'success',
        title: t('pl_all_pandals_visited'),
        text: t('pl_hope_enjoyed'),
        timer: 3000,
        showConfirmButton: false,
      });
    } else {
      const updated = { ...batchState, currentBatchIndex: nextIndex, updatedAt: Date.now() };
      await setBatchProgress(batchState.routeSignature, updated);
      setBatchState(updated);

      const liveOrigin = liveNavState?.userLocation || null;
      const startingLoc = batchState.startingLoc || null;
      const mode = transportMode === 'car' ? 'driving' : 'walking';

      const url = buildGmapsUrlForBatch(nextIndex, liveOrigin, startingLoc, mode, updated);
      if (url && typeof window !== 'undefined') window.open(url, '_blank');
    }
  };

  const handleBatchCancel = async () => {
    if (!batchState) return;
    await clearBatchProgress(batchState.routeSignature);
    setBatchState(null);
  };

  const handleShare = async () => {
    const stops = optimizedRoute.filter(p => p.id !== 'END' && p.id !== '__START__');
    const ids = stops.map(s => s.id).join(',');
    const url = `${window.location.origin}/planner?stops=${ids}&mode=${transportMode}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: t('share_title'),
          text: t('share_text', { n: stops.length }),
          url,
        });
      } catch (err) {
        // silently catch abort
      }
    } else {
      navigator.clipboard.writeText(url);
      Swal.fire({ toast: true, position: 'bottom', icon: 'success', title: t('share_copied'), showConfirmButton: false, timer: 2000 });
    }
  };

  if (!isMounted) return null;

  const renderSummaryAndChips = () => (
    <div className="w-full">
      {/* Summary Card */}
      <button
        onClick={() => setIsListModalOpen(true)}
        className="w-full text-left bg-white border-2 border-red-100 hover:border-red-200 rounded-2xl p-4 shadow-sm mt-4 transition-colors"
      >
        <div className="flex justify-between items-start mb-2">
          <div className="text-xs text-gray-500 font-semibold"><span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {t('pl_from_your_location')}</span></div>
          {optimizedRoute.length > 1 && (
            <div className="text-[10px] text-red-700 font-bold bg-red-50 px-2 py-0.5 rounded-full">
              {t('pl_tap_to_view_list')}
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="font-extrabold text-red-900 text-lg flex items-center gap-1.5">
            <MapPin className="w-5 h-5 text-red-700" />
            {optimizedRoute.length > 1 ? (lang === 'en' ? `${optimizedRoute.length - 1} pandals` : `${optimizedRoute.length - 1}টি মণ্ডপ`) : (lang === 'en' ? '0 pandals' : '0টি মণ্ডপ')}
          </div>
          {optimizedRoute.length > 1 && stats && (
            <div className="font-extrabold text-amber-600 text-lg flex items-center gap-1.5">
              <Clock className="w-5 h-5" />
              ~{lang === 'bn' ? formatDurationBn(stats.totalMin) : formatDuration(stats.totalMin, lang)}
            </div>
          )}
        </div>
      </button>

      {/* Clear all */}
      <div className="flex flex-col gap-1 pt-2">
        {optimizedRoute.length > 0 && (
          <div className="flex justify-end">
            <button
              onClick={() => {
                setManualPandals([]);
                setBudgetMin(null);
                setTopN(null);
                setHasSelectedTime(false);
                updateRouteState({ hasUserInteracted: false });
                setPlannerTab('top');
              }}
              className="text-xs font-bold text-red-700 hover:text-red-900 underline"
            >
              {t('pl_clear_all')}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const showGpsPrompt = () => {
    Swal.fire({
      title: t('gps_required_title'),
      text: t('gps_required_body'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#8B1E3F',
      cancelButtonColor: '#999',
      confirmButtonText: t('gps_required_ok'),
      cancelButtonText: t('gps_required_cancel'),
    }).then((result) => {
      if (result.isConfirmed) {
        retryGPS();
        setTimeout(() => {
          if (!navigator.geolocation) return;
          navigator.geolocation.getCurrentPosition(
            () => { },
            () => {
              Swal.fire({
                title: t('gps_blocked_title'),
                html: t('gps_blocked_body'),
                icon: 'info',
                confirmButtonColor: '#8B1E3F',
                confirmButtonText: t('gps_required_ok'),
              });
            },
            { timeout: 3000 }
          );
        }, 2500);
      }
    });
  };

  return (
    <section className="relative h-full w-full bg-stone-100 overflow-hidden">
      {(gpsPermission === 'denied' || (gpsError && gpsError.includes('denied'))) && (
        <div className="absolute top-0 left-0 right-0 z-[60] bg-red-600 text-white px-4 py-3 text-center text-sm shadow-md font-medium pt-6">
          Location access denied. Enable it in your browser to plan a route from your position.
        </div>
      )}

      {errorPandals && (
        <div className="absolute top-0 left-0 right-0 z-[60] bg-orange-600 text-white px-4 py-3 text-center text-sm shadow-md font-medium pt-6">
          {errorPandals}
        </div>
      )}

      {/* MAP */}
      <div className="absolute inset-0 z-10">
        <MapView
          mode={
            liveNavState.isNavigating ? 'navigate'
              : (hasSelectedTime || isPickingFromMap || manualPandals.length > 0) ? 'plan'
                : 'discover'
          }
          pandalsData={pandalsData}
          selectedRoute={optimizedRoute}
          onAddPandal={handleAddPandal}
          onRemovePandal={handleRemovePandal}
          isRouteMode={plannerTab === 'manual'}
          isNavigating={liveNavState.isNavigating}
          userLocation={liveNavState.userLocation || startLocation}
          routeData={liveNavState.routeData}
          activeRouteLine={liveNavState.activeRouteLine}
          activePandal={liveNavState.activePandal}
          liveCounts={liveCounts}
          isGpsReady={isGpsReady}
          onRequestGps={showGpsPrompt}
          onOpenPlanner={() => { setDrawerState('half'); setUiMode('main'); }}
          drawerOpen={drawerState !== 'closed'}
          drawerState={drawerState}
        />
        {showGpsLoader && (
          <div className="absolute inset-0 z-[500] bg-white/40 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
            <div className="w-10 h-10 rounded-full border-[3px] border-[#8B1E3F]/20 border-t-[#8B1E3F] animate-spin" />
          </div>
        )}
        {liveNavState.isNavigating && (
          <LiveNavigationHUD navState={liveNavState} totalStops={optimizedRoute.length} />
        )}
      </div>

      {/* PLANNER DRAWER */}
      {!liveNavState.isNavigating && (
        <div
          id="planner-drawer"
          className={`absolute bottom-0 left-0 right-0 md:absolute md:top-20 md:bottom-0 md:w-[420px] md:h-auto bg-white/97 backdrop-blur-2xl shadow-[0_-12px_48px_rgba(0,0,0,0.12)] z-10 flex flex-col rounded-t-[2rem] md:rounded-none transition-transform duration-300 ease-in-out ${drawerState === 'closed' ? 'translate-y-full' : 'translate-y-0'
            } ${drawerState === 'expanded' ? 'h-[85vh]' : drawerState === 'half' ? 'h-[45vh]' : 'h-[45vh]'
            }`}
        >

          {/* Mobile drag handle */}
          <div
            className="w-full flex justify-center pt-3 pb-4 md:hidden cursor-pointer touch-none"
            onClick={() => setDrawerState('closed')}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
          </div>

          <button
            onClick={() => {
              setDrawerState(drawerState === 'closed' ? 'half'
                : drawerState === 'half' ? 'expanded'
                  : 'closed');
            }}
            className="absolute top-3 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 md:hidden"
            aria-label="Expand drawer"
          >
            {drawerState === 'expanded' ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </button>

          {/* Batch Banner */}
          {batchState && drawerState !== 'closed' && (
            <div className="mx-5 mt-3 mb-2">
              <div
                onClick={() => {
                  if (batchState.currentBatchIndex < batchState.batches.length - 1) {
                    handleBatchAdvance();
                  }
                }}
                className={`rounded-2xl p-3 flex items-start gap-3 ${batchState.currentBatchIndex >= batchState.batches.length - 1
                    ? 'bg-blue-50 border border-blue-200'
                    : 'bg-amber-50 border border-amber-200'
                  } ${batchState.currentBatchIndex < batchState.batches.length - 1 ? 'cursor-pointer hover:bg-amber-100' : ''}`}
              >
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-900 leading-tight">
                    {batchState.currentBatchIndex < batchState.batches.length - 1
                      ? (t('pl_batch_first_done', { n: batchState.batches[batchState.currentBatchIndex].length }))
                      : (t('pl_batch_almost', { n: batchState.batches[batchState.currentBatchIndex].length }))
                    }
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    {t('pl_batch_counter', { current: batchState.currentBatchIndex + 1, total: batchState.batches.length })}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBatchCancel();
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-white/60 hover:bg-white text-gray-600 shrink-0"
                  aria-label="Cancel batch"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-2 space-y-4">

            {/* Header */}
            <div>
              <h2 className="text-2xl font-extrabold text-red-900 leading-tight">{t('route_planner')}</h2>
            </div>

            {/* Time Budget */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {BUDGET_OPTIONS.map(({ minutes, Icon, label, labelEn }) => (
                <button
                  key={String(minutes)}
                  onClick={() => {
                    if (!isGpsReady) {
                      showGpsPrompt();
                      return;
                    }
                    if (plannerTab === 'budget' && budgetMin === minutes) {
                      setBudgetMin(null);
                      setHasSelectedTime(false);
                      if (manualPandals.length === 0) {
                        updateRouteState({ hasUserInteracted: false });
                        setPlannerTab(null);
                      }
                    } else {
                      setBudgetMin(minutes);
                      setPlannerTab('budget');
                      setHasSelectedTime(true);
                      updateRouteState({ hasUserInteracted: true });
                    }
                  }}
                  className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-bold transition-all duration-200 ${!isGpsReady
                      ? 'opacity-50 grayscale cursor-not-allowed bg-red-50 text-red-700 border border-red-100'
                      : plannerTab === 'budget' && budgetMin === minutes
                        ? 'bg-red-700 text-white shadow-md shadow-red-200'
                        : 'bg-red-50 text-red-700 border border-red-100 hover:bg-red-100'
                    }`}
                >
                  <Icon className="w-5 h-5" />
                  {lang === 'en' ? labelEn : (lang === 'bn' ? label : labelBng)}
                </button>
              ))}
              <button
                onClick={() => {
                  if (!isGpsReady) {
                    showGpsPrompt();
                    return;
                  }
                  handleOtherTime();
                }}
                className={`col-span-2 md:col-span-4 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-white border-2 border-gray-200 text-gray-700 transition-colors ${!isGpsReady
                    ? 'opacity-50 grayscale cursor-not-allowed'
                    : 'hover:border-red-300 hover:bg-red-50 hover:text-red-700'
                  }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>{t('pl_time_other')}</span>
              </button>
            </div>

            {/* More Options */}
            <div className="bg-transparent mt-2">
              <button
                onClick={() => setShowMoreOptions(!showMoreOptions)}
                className="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-bold text-gray-700">
                    {t('pl_more_options')}
                  </span>
                </div>
                {showMoreOptions ? <ChevronUp className="w-4 h-4 text-gray-700" /> : <ChevronDown className="w-4 h-4 text-gray-700" />}
              </button>

              {showMoreOptions && (
                <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Top N</p>
                    <div className="flex gap-2">
                      {TOP_N_OPTIONS.map(({ n, Icon, label }) => (
                        <button
                          key={String(n)}
                          onClick={() => {
                            if (!isGpsReady) {
                              showGpsPrompt();
                              return;
                            }
                            if (plannerTab === 'top' && topN === n) {
                              setTopN(null);
                              setHasSelectedTime(false);
                              if (manualPandals.length === 0) {
                                updateRouteState({ hasUserInteracted: false });
                                setPlannerTab(null);
                              }
                            } else {
                              setTopN(n);
                              setPlannerTab('top');
                              setHasSelectedTime(true);
                              updateRouteState({ hasUserInteracted: true });
                            }
                          }}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${!isGpsReady
                              ? 'opacity-50 grayscale cursor-not-allowed bg-white border border-gray-200 text-gray-600'
                              : plannerTab === 'top' && topN === n
                                ? 'bg-amber-500 text-white shadow-md'
                                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {typeof label === 'function' ? label(lang) : label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{t('transport_mode')}</p>
                    <div className="flex gap-2">
                      {TRANSPORT_PILLS.map(({ key, Icon, label, labelEn }) => (
                        <button
                          key={key}
                          onClick={() => {
                            if (!isGpsReady) {
                              showGpsPrompt();
                              return;
                            }
                            setTransportMode(key);
                          }}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${!isGpsReady
                              ? 'opacity-50 grayscale cursor-not-allowed bg-white border border-gray-200 text-gray-600'
                              : transportMode === key
                                ? 'bg-red-700 text-white shadow-md'
                                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                          <Icon className="w-4 h-4" />
                          {lang === 'en' ? labelEn : (lang === 'bn' ? label : labelBng)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (!isGpsReady) {
                        showGpsPrompt();
                        return;
                      }
                      if (plannerTab === 'top' || plannerTab === 'budget') {
                        setManualPandals([]);
                        setTopN(null);
                        setBudgetMin(null);
                        setHasSelectedTime(false);
                      }
                      setUiMode('map_pick');
                      setPlannerTab('manual');
                      setDrawerState('closed');
                      setIsPickingFromMap(true);
                      updateRouteState({ hasUserInteracted: true });
                    }}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold shadow-md transition-colors ${!isGpsReady
                        ? 'opacity-50 grayscale cursor-not-allowed bg-gray-800 text-white'
                        : 'bg-gray-800 text-white hover:bg-gray-900'
                      }`}
                  >
                    <MapPin className="w-4 h-4" />
                    {t('pl_select_from_map')} →
                  </button>
                </div>
              )}
            </div>

            {/* Summary Card & Actions Gated by Selection */}
            {!(hasSelectedTime || manualPandals.length > 0 || optimizedRoute.length > 0) ? (
              <div className="mt-4 p-6 border-2 border-dashed border-gray-200 rounded-2xl text-center bg-gray-50 flex items-center justify-center h-48">
                <p className="text-gray-500 font-medium text-sm">{t('pl_time_pick_hint')}</p>
              </div>
            ) : (
              <>
                {renderSummaryAndChips()}

                {/* Primary Actions */}
                <div className="space-y-3 pt-2">
                  <button
                    onClick={() => {
                      if (!isGpsReady) {
                        showGpsPrompt();
                        return;
                      }
                      if (typeof navigator === 'undefined' || !navigator.geolocation) {
                        Swal.fire({ icon: 'error', title: t('pl_device_error_title'), text: t('pl_device_error_text') });
                        return;
                      }
                      if (optimizedRoute.length > 0) {
                        if (window.speechSynthesis) window.speechSynthesis.speak(new SpeechSynthesisUtterance(''));
                        liveNavState.startTour();
                      }
                    }}
                    className={`w-full py-4 rounded-2xl font-extrabold flex items-center justify-center gap-2 transition-all ${!isGpsReady
                        ? 'bg-gradient-to-r from-gray-400 to-gray-500 text-white opacity-60 cursor-not-allowed'
                        : optimizedRoute.length <= 1
                          ? 'bg-gradient-to-r from-gray-400 to-gray-500 text-white opacity-60 cursor-not-allowed'
                          : 'bg-gradient-to-r from-red-700 to-red-900 text-white shadow-lg shadow-red-900/20 hover:scale-[1.02] active:scale-[0.98]'
                      }`}
                  >
                    {startLocation === null ? (
                      <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {lang === 'en' ? 'Enable GPS' : 'জিপিএস অন করুন'}</span>
                    ) : (
                      <><Play className="w-5 h-5 fill-white" /> {t('pl_start_tour')}</>
                    )}
                  </button>

                  {optimizedRoute.length > 1 && (
                    <button
                      onClick={handleOpenGmaps}
                      className="w-full py-3 bg-white text-blue-600 border-2 border-blue-100 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-50 transition-all"
                    >
                      <ExternalLink className="w-5 h-5" />
                      {t('pl_open_gmaps')}
                    </button>
                  )}
                </div>

                {/* Share */}
                {optimizedRoute.length > 1 && (
                  <button
                    onClick={handleShare}
                    className="w-full py-2 bg-transparent text-gray-500 font-bold flex items-center justify-center gap-2 hover:text-gray-700 transition-colors mt-2"
                  >
                    <Share className="w-4 h-4" />
                    {t('pl_share')}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {isPickingFromMap && (
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-white rounded-t-2xl shadow-2xl p-4 md:max-w-md md:left-1/2 md:-translate-x-1/2">
          {/* Count row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-red-800">
              <Target className="w-4 h-4" />
              <span className="font-bold text-sm">
                {t('pl_selected_count', { n: selectedCount })}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setManualPandals([]);
                setIsPickingFromMap(false);
                setDrawerState('half');
              }}
              className="flex-1 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-bold text-sm"
            >
              {t('pl_cancel')}
            </button>
            <button
              onClick={() => {
                setIsPickingFromMap(false);
                setDrawerState('half');
              }}
              disabled={manualPandals.length === 0}
              className="flex-1 py-3 bg-red-700 text-white rounded-xl font-bold text-sm disabled:opacity-50"
            >
              {t('pl_confirm')}
            </button>
          </div>
        </div>
      )}

      <PandalListModal
        isOpen={isListModalOpen}
        onClose={() => setIsListModalOpen(false)}
        pandals={optimizedRoute.filter(p => p.id !== 'END' && p.id !== '__START__')}
        lang={lang}
        onRemove={handleRemovePandal}
        onClearAll={() => {
          setManualPandals([]);
          setBudgetMin(null);
          setTopN(null);
          setHasSelectedTime(false);
          updateRouteState({ hasUserInteracted: false });
          setPlannerTab(null);
          setIsListModalOpen(false);
        }}
        onNavigate={(pandal) => {
          const originLoc = liveNavState?.userLocation || startLocation;
          const originParam = originLoc ? `&origin=${originLoc.lat},${originLoc.lng}` : '';
          const mode = transportMode === 'car' ? 'driving' : 'walking';
          window.open(
            `https://www.google.com/maps/dir/?api=1${originParam}&destination=${pandal.lat},${pandal.lng}&travelmode=${mode}`,
            '_blank'
          );
        }}
      />
    </section>
  );
}
