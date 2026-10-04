import { useState, useEffect, useCallback } from 'react';
import { safeStorage } from '../utils/storage';

const STORAGE_KEY = 'puja_active_plan';

export function useRoutePersistence(initialState = null) {
  const [routeState, setRouteState] = useState(() => {
    const stored = safeStorage.get(STORAGE_KEY);
    if (stored) return stored;
    return initialState || {
      activePlan: null,
      selectedPandals: [],
      transportMode: 'walking',
      currentStopIndex: 0,
      plannerTab: null,
      hasUserInteracted: false
    };
  });

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (routeState) {
      safeStorage.set(STORAGE_KEY, routeState);
    }
  }, [routeState]);

  const updateRouteState = useCallback((updates) => {
    setRouteState(prev => ({ ...prev, ...updates }));
  }, []);

  const resetPlan = useCallback(() => {
    setRouteState({
      activePlan: null,
      selectedPandals: [],
      transportMode: 'walking',
      currentStopIndex: 0,
      hasUserInteracted: false
    });
    safeStorage.remove(STORAGE_KEY);
  }, []);

  return { routeState, updateRouteState, resetPlan };
}
