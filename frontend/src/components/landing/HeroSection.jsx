"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, ArrowDown, Landmark, MapPin, Mic } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import ScrollReveal from '@/components/ui/ScrollReveal';

export default function HeroSection({ totalPandals = 23 }) {
  const { t, lang } = useLanguage();

  return (
    <>
      <section className="relative w-full min-h-[calc(100vh-5rem)] bg-[#FAF6EE] pt-15 pb-10 sm:pt-6 md:pt-12 md:pb-14 overflow-hidden border-b border-[#E5DBC8] flex items-start md:items-center">
        {/* Background Graphic Canvas (hero4.jpg on desktop, hero-mobile.jpg on mobile) */}
      <div className="absolute inset-0 z-0 pointer-events-none select-none">
        {/* Desktop Canvas Background */}
        <div className="hidden md:block relative w-full h-full">
          <Image
            src="/hero.jpg"
            alt="Durga Idol Background"
            fill
            priority
            className="object-cover object-[center_28%] opacity-90"
            sizes="(min-width: 768px) 100vw, 1px"
          />
        </div>
        {/* Mobile Canvas Background - Full visual vibrancy as per poster reference */}
        <div className="block md:hidden relative w-full h-full">
          <Image
            src="/hero-mobile.jpg"
            alt="Durga Idol Poster"
            fill
            priority
            className="object-cover object-top sm:object-center opacity-100"
            sizes="(max-width: 767px) 100vw, 1px"
          />
          {/* Subtle soft gradient highlight on top-left to guarantee text legibility */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#FAF6EE]/85 via-[#FAF6EE]/40 to-transparent pointer-events-none" />
        </div>
      </div>

      {/* Main Hero Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">

          {/* Left Column: Text & Content (Positioned in upper parchment area on mobile) */}
          <div className="lg:col-span-7 flex flex-col items-start text-left pt-0 sm:pt-6 lg:pt-4 sm:pl-4 lg:pl-10 max-w-[86%] sm:max-w-lg lg:max-w-2xl">

            {/* Small pill badge */}
            <ScrollReveal animation="fade-down" delay={100} duration={600}>
              <div className="inline-flex items-center gap-2 bg-[#FFFEFA]/95 md:bg-[#EFE8DC]/90 border border-[#E5DBC8] text-[#8B1E3F] text-xs sm:text-sm font-semibold px-3.5 sm:px-4 py-1.5 rounded-full shadow-2xs mb-2.5 sm:mb-5 backdrop-blur-xs">
                <span>{t('hero_pill')}</span>
              </div>
            </ScrollReveal>

            {/* H1 Main Title */}
            <ScrollReveal animation="fade-up" delay={200} duration={700} className="w-full">
              <h1 className="text-[12.5vw] xs:text-[3.5rem] sm:text-5xl md:text-6xl lg:text-7xl font-bold text-[#8B1E3F] font-serif leading-[1.15] tracking-tight mb-3 sm:mb-4 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">
                <span className="block">{t('hero_title_p1')}</span>
                <span className="block whitespace-nowrap">{t('hero_title_p2')}</span>
              </h1>
            </ScrollReveal>

            {/* Subheading Motto & Floral Divider */}
            <ScrollReveal animation="fade-up" delay={300} duration={700}>
              <div className="flex flex-col items-start gap-1 mb-4 sm:mb-5">
                <p className="text-lg sm:text-2xl font-bold text-[#1F1B16] font-serif leading-snug">
                  {t('hero_motto')}
                </p>
                {/* Floral ornament */}
                <div className="flex items-center gap-2 text-[#E8A33D] my-0.5">
                  <span className="w-8 sm:w-10 h-[1.5px] bg-[#E5DBC8]"></span>
                  <span className="text-sm sm:text-base font-serif">🪷</span>
                  <span className="w-8 sm:w-10 h-[1.5px] bg-[#E5DBC8]"></span>
                </div>
              </div>
            </ScrollReveal>

            {/* One-line description */}
            <ScrollReveal animation="fade-up" delay={400} duration={700}>
              <p className="text-sm sm:text-lg text-[#524B42] sm:text-[#6B6257] font-sans leading-relaxed mb-10 sm:mb-7 max-w-xs sm:max-w-lg font-medium">
                {lang === 'bn' ? (
                  <>
                    <span className="block sm:inline">সবচেয়ে কম সময়ে, কম জ্যামে,</span>{' '}
                    <span className="block sm:inline">সেরা পণ্ডেলগুলো ঘুরে দেখুন।</span>{' '}
                    <span className="block sm:inline">ফ্রি,</span>{' '}
                    <span className="block sm:inline">লগইন ছাড়াই।</span>
                  </>
                ) : lang === 'bng' ? (
                  <>
                    <span className="block sm:inline">Sobcheye kom shomoye, kom jam-e,</span>{' '}
                    <span className="block sm:inline">shera pandal gulo ghure dekhun.</span>{' '}
                    <span className="block sm:inline">Free,</span>{' '}
                    <span className="block sm:inline">login charai.</span>
                  </>
                ) : (
                  <>
                    <span className="block sm:inline">Visit the best pandals</span>{' '}
                    <span className="block sm:inline">in the shortest time</span>{' '}
                    <span className="block sm:inline">with minimal traffic.</span>{' '}
                    <span className="block sm:inline">Free,</span>{' '}
                    <span className="block sm:inline">no login required.</span>
                  </>
                )}
              </p>
            </ScrollReveal>

            {/* CTA Buttons: Stacked on mobile, side-by-side on desktop */}
            <ScrollReveal animation="fade-up" delay={500} duration={700} className="w-full sm:w-auto">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6 sm:mb-7 w-full sm:w-auto max-w-[280px] sm:max-w-none">
                <Link
                  href="/planner"
                  className="group inline-flex items-center justify-center gap-2.5 bg-[#8B1E3F] text-[#FFFEFA] border-2 border-[#8B1E3F] hover:bg-[#FFFEFA] hover:text-[#8B1E3F] font-bold text-sm sm:text-base px-6 sm:px-7 py-3 sm:py-3.5 rounded-full shadow-md hover:shadow-xl transform transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-[#8B1E3F] focus:ring-offset-2 focus:ring-offset-[#FAF6EE] hover:scale-105 active:scale-95 text-center cursor-pointer"
                >
                  <span>{t('hero_btn_start')}</span>
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-300 group-hover:translate-x-1.5" />
                </Link>
                <a
                  href="#how-it-works"
                  className="group inline-flex items-center justify-center gap-2.5 bg-[#FFFEFA]/90 text-[#8B1E3F] border-2 border-[#8B1E3F] hover:bg-[#8B1E3F] hover:text-[#FFFEFA] font-bold text-sm sm:text-base px-6 sm:px-7 py-3 sm:py-3.5 rounded-full shadow-sm hover:shadow-xl backdrop-blur-xs transform transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-[#8B1E3F] focus:ring-offset-2 focus:ring-offset-[#FAF6EE] hover:scale-105 active:scale-95 text-center cursor-pointer"
                >
                  <span>{t('hero_btn_hiw')}</span>
                  <ArrowDown className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-300 group-hover:translate-y-1" />
                </a>
              </div>
            </ScrollReveal>

            {/* Bottom Stats / Feature Row: Responsive on both Mobile & Desktop */}
            <ScrollReveal animation="fade-up" delay={600} duration={700} className="w-full sm:w-fit mt-3 sm:mt-0">
              <div className="w-full sm:w-fit max-w-[340px] sm:max-w-none grid grid-cols-3 divide-x divide-[#E5DBC8] sm:divide-x-0 sm:flex sm:items-center sm:gap-4 bg-[#FFFEFA]/95 backdrop-blur-sm border border-[#E5DBC8] py-2 px-1 sm:px-5 sm:py-2.5 rounded-2xl sm:rounded-full shadow-sm mx-auto sm:mx-0">
                
                {/* Pandals */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-1 text-center">
                  <Landmark className="w-4 h-4 text-[#8B1E3F] shrink-0" />
                  <span className="text-[10px] xs:text-[11px] sm:text-sm font-bold sm:font-semibold text-[#1F1B16] leading-tight">
                    {t('hero_stat_pandals', { count: totalPandals })}
                  </span>
                </div>
                
                {/* Hairline Divider (Desktop) */}
                <div className="hidden sm:block h-4 w-[1px] bg-[#E5DBC8] shrink-0" aria-hidden="true" />
                
                {/* Cities */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-1 text-center">
                  <MapPin className="w-4 h-4 text-[#8B1E3F] shrink-0" />
                  <span className="text-[10px] xs:text-[11px] sm:text-sm font-bold sm:font-semibold text-[#1F1B16] leading-tight">
                    {t('hero_stat_cities')}
                  </span>
                </div>
                
                {/* Hairline Divider (Desktop) */}
                <div className="hidden sm:block h-4 w-[1px] bg-[#E5DBC8] shrink-0" aria-hidden="true" />
                
                {/* Voice Guide */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-1 text-center">
                  <Mic className="w-4 h-4 text-[#8B1E3F] shrink-0" />
                  <span className="text-[10px] xs:text-[11px] sm:text-sm font-bold sm:font-semibold text-[#1F1B16] leading-tight">
                    {t('hero_stat_voice')}
                  </span>
                </div>
                
              </div>
            </ScrollReveal>

          </div>

        </div>
      </div>
    </section>
      
      <div className="max-w-3xl mx-auto px-4 py-8 text-center">
        <p className="text-sm text-[#6B6257]">
          {t('hero_intro_text')}
        </p>
      </div>
    </>
  );
}
