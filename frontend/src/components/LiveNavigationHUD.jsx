import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, ArrowUp, ArrowLeft, ArrowRight, CornerUpLeft, CornerUpRight, MapPin, X, FastForward, CheckCircle, ExternalLink } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import CheckInModal from './CheckInModal';
import { safeStorage } from '@/utils/storage';
import { APP_CONFIG } from '../config/appConfig';

// Map icon strings from navigationEngine to actual lucide components
const IconMap = {
  ArrowUp: ArrowUp,
  ArrowLeft: ArrowLeft,
  ArrowRight: ArrowRight,
  CornerUpLeft: CornerUpLeft,
  CornerUpRight: CornerUpRight,
  MapPin: MapPin,
};

export default function LiveNavigationHUD({ navState, totalStops }) {
  const { 
    activePandal, 
    nextPandal,
    currentManeuver, 
    distanceToTarget, 
    distanceMeters,
    liveRemainingMeters,
    etaMinutes,
    currentStopIndex, 
    isVoiceMuted, 
    setIsVoiceMuted, 
    isSpeaking,
    endTour, 
    skipToNext,
    userLocation
  } = navState;
  
  const { lang, t } = useLanguage();
  const [modalDismissedFor, setModalDismissedFor] = useState(null);

  const CHECKIN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

  const hasCheckedIn = (() => {
    if (!activePandal) return false;
    const stored = safeStorage.get(`last_checkin_${activePandal.id}`);
    if (!stored) return false;
    const age = Date.now() - parseInt(stored);
    return age < CHECKIN_TTL_MS;
  })();

  const isReturnToStart = activePandal?.id === 'END';
  const isArrived = activePandal && distanceToTarget !== null && distanceToTarget <= 50;
  const showModal = isArrived && !isReturnToStart && modalDismissedFor !== activePandal?.id && !hasCheckedIn;

  useEffect(() => {
    // Clean up expired check-ins
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('last_checkin_')) {
        const val = localStorage.getItem(key);
        if (val && (Date.now() - parseInt(val)) >= CHECKIN_TTL_MS) {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  }, []);

  const arrivedVoiceRef = useRef(null);

  useEffect(() => {
    if (activePandal && isArrived && arrivedVoiceRef.current !== activePandal.id) {
      const getPandalName = (p) => lang === 'en' ? (p.name_en || p.name) : (p.name_bn || p.name);
      arrivedVoiceRef.current = activePandal.id;
      let text = '';
      if (isReturnToStart) {
        text = lang === 'bn'
          ? "আপনি শুরুর স্থানে পৌঁছে গেছেন। চলো পূজো ব্যবহার করার জন্য ধন্যবাদ!"
          : "You've returned to your starting point. Thank you for using Cholo Pujo!";
      } else {
        text = lang === 'bn' 
          ? `${getPandalName(activePandal)}-এ পৌঁছে গেছেন। এখন ঠাকুর উপভোগ করুন!`
          : `You have arrived at ${getPandalName(activePandal)}. Enjoy the Puja!`;
      }
      if (navState.speakPrompt) navState.speakPrompt(text);
    }
  }, [isArrived, activePandal?.id, lang, navState, activePandal, isReturnToStart]);

  // Auto-mute when checked in to prevent spamming instructions while user is inside pandal
  useEffect(() => {
    if (hasCheckedIn && !isVoiceMuted) {
      setIsVoiceMuted(true);
    }
  }, [hasCheckedIn, isVoiceMuted, setIsVoiceMuted]);

  if (!activePandal) return null;

  // Resolve icon component
  const ManeuverIcon = currentManeuver && IconMap[currentManeuver.icon] ? IconMap[currentManeuver.icon] : ArrowUp;

  return (
    <>
      {showModal && (
        <CheckInModal 
          pandal={activePandal} 
          onDismiss={() => {
            setModalDismissedFor(activePandal.id);
          }} 
        />
      )}
      {/* Top Banner - Turn Instruction */}
      <div className="absolute top-4 left-4 right-4 z-[999] flex justify-center pointer-events-none">
        <div className="bg-gray-900/95 backdrop-blur-md shadow-2xl rounded-3xl p-4 flex items-center justify-between gap-4 w-full max-w-md pointer-events-auto border border-gray-700">
          
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-inner ${isArrived ? 'bg-green-500' : 'bg-red-600'}`}>
              {isArrived ? <CheckCircle className="w-8 h-8 text-white" /> : <ManeuverIcon className="w-8 h-8 text-white" />}
            </div>
            <div className="flex flex-col">
              <span className="text-gray-400 font-bold text-xs">
                {currentManeuver && liveRemainingMeters > 0 ? `${lang === 'bn' ? String(liveRemainingMeters).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]) : liveRemainingMeters} ${t('meters_after')}` : ''}
              </span>
              <span className="text-white font-bold text-lg leading-tight">
                {currentManeuver?.text || t('straight')}
              </span>
            </div>
          </div>

          <button 
            onClick={() => setIsVoiceMuted(!isVoiceMuted)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isSpeaking && !isVoiceMuted ? 'bg-amber-500 text-white animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'bg-gray-800 text-gray-300 hover:text-white'}`}
          >
            {isVoiceMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Bottom Drawer - Tour Status */}
      <div id="navigation-hud" className="absolute bottom-4 left-4 right-4 z-[999] flex justify-center pointer-events-none">
        <div id="planner-drawer" className="bg-white/95 backdrop-blur-md shadow-2xl shadow-gray-900/20 rounded-[2rem] p-5 w-full max-w-md pointer-events-auto border border-gray-200">
          
          {isReturnToStart ? (
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-3">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-extrabold text-gray-900 mb-2">
                {lang === 'bn' ? "শুরুর স্থানে পৌঁছেছেন!" : "You've returned to your starting point!"}
              </h2>
              <p className="text-gray-600 mb-6 font-medium">
                {lang === 'bn' ? "চলো পূজো ব্যবহার করার জন্য ধন্যবাদ!" : "Thank you for using Cholo Pujo!"}
              </p>
              <button 
                onClick={endTour}
                className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-900/20 transition-all hover:scale-[1.02]"
              >
                <X className="w-5 h-5" /> {t('end')}
              </button>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-4">
                <div className="flex flex-col">
                  <span className="text-red-700 font-bold text-xs uppercase tracking-wider mb-1">
                    {t('stop')} {currentStopIndex + 1} / {totalStops}
                  </span>
                  <h2 className="text-2xl font-extrabold text-gray-900">
                    {lang === 'en' ? activePandal.name_en || activePandal.name : activePandal.name_bn || activePandal.name}
                  </h2>
                  {hasCheckedIn && (
                    <span className="inline-flex items-center gap-1 mt-1 text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full w-fit">
                      <CheckCircle className="w-3 h-3" /> {t('checkin_complete')}
                    </span>
                  )}
                  <span className="text-gray-500 text-sm flex items-center gap-1 mt-1">
                    <MapPin className="w-4 h-4" /> {activePandal.zone}
                  </span>
                </div>
                <div className="text-right">
                   <span className="block text-2xl font-bold text-gray-900">
                     {distanceToTarget !== null ? (distanceToTarget > 1000 ? (distanceToTarget/1000).toFixed(1) + 'km' : distanceToTarget + 'm') : '--'}
                   </span>
                   <span className="block text-xs font-semibold text-gray-500">{t('distance')} &bull; ETA: {etaMinutes !== null ? etaMinutes + ' min' : '--'}</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 bg-gray-100 rounded-full mb-6 overflow-hidden">
                 <div 
                   className="h-full bg-red-600 rounded-full transition-all duration-500"
                   style={{ width: `${((currentStopIndex) / totalStops) * 100}%` }}
                 ></div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={endTour}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <X className="w-5 h-5" /> {t('end')}
                </button>
                {hasCheckedIn ? (
                  <button 
                    onClick={() => {
                      setIsVoiceMuted(false);
                      skipToNext();
                    }}
                    className="flex-[2] py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-900/20 transition-all hover:scale-[1.02]"
                  >
                    {currentStopIndex === totalStops - 1 ? t('tour_complete') : t('next_pandal')}
                  </button>
                ) : (
                  <button 
                    onClick={skipToNext}
                    className="flex-[2] py-3 bg-gradient-to-r from-red-700 to-red-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-red-900/20 transition-all hover:scale-[1.02]"
                  >
                    {currentStopIndex === totalStops - 1 ? t('tour_complete') : t('skip')} <FastForward className="w-5 h-5" />
                  </button>
                )}
              </div>
              
              <button 
                onClick={() => {
                  if (userLocation) {
                    window.open(`https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${nextPandal.lat},${nextPandal.lng}&travelmode=${APP_CONFIG.planner.defaultMode}`, '_blank');
                  }
                }}
                className="w-full mt-3 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                Google Maps-এ চলুন <ExternalLink className="w-4 h-4" />
              </button>
            </>
          )}

        </div>
      </div>
    </>
  );
}

