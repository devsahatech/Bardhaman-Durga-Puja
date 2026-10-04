"use client";

import React from 'react';
import Link from 'next/link';
import { MapPin, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import SectionCornerPatterns from './SectionCornerPatterns';
import SectionDivider from './SectionDivider';
import ScrollReveal from '@/components/ui/ScrollReveal';

export default function CitiesCovered({ pandalCounts = {} }) {
  const { t } = useLanguage();

  const cities = [
    {
      nameKey: 'city1_name',
      cityName: 'Bardhaman',
      statusKey: 'city1_status',
      href: '/planner?city=bardhaman',
      available: true,
    },
    {
      nameKey: 'city2_name',
      cityName: 'Katwa',
      statusKey: 'city2_status',
      href: '/planner?city=katwa',
      available: true,
    },
    {
      nameKey: 'city3_name',
      cityName: 'Kolkata',
      statusKey: 'city3_status',
      href: '#',
      available: false,
    },
  ];

  return (
    <section className="relative py-12 md:py-16 bg-[#FAF6EE] border-b border-[#E5DBC8] overflow-hidden">
      <SectionCornerPatterns />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <ScrollReveal animation="fade-up" duration={700} className="text-center max-w-2xl mx-auto mb-10 md:mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#80132F] font-serif mb-1">
            {t('city_sec_title')}
          </h2>
          <SectionDivider />
          <p className="text-sm sm:text-base text-[#6B6257] font-medium">
            {t('city_sec_sub')}
          </p>
        </ScrollReveal>

        {/* City cards with scroll snap on mobile, grid on desktop */}
        <div className="flex md:grid md:grid-cols-3 gap-6 overflow-x-auto snap-x snap-mandatory pb-4 md:pb-0 scrollbar-none">
          {cities.map((city, idx) => {
            const isAvailable = city.available;
            const CardContent = (
              <div
                className={`w-[280px] sm:w-[320px] md:w-full shrink-0 snap-center bg-white p-6 rounded-2xl border border-[#F0EAE1] shadow-[0_4px_16px_-2px_rgba(139,30,63,0.05),0_1px_3px_rgba(0,0,0,0.03)] transition-all card-hover-lift ${
                  isAvailable ? 'hover:border-[#80132F]/30 hover:shadow-md' : 'opacity-75'
                } flex flex-col justify-between h-48`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5 text-[#80132F]">
                      <div className="w-8 h-8 rounded-full bg-[#FAF0E6] border border-[#F3E5D4] flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4 text-[#80132F]" />
                      </div>
                      <h3 className="text-xl font-bold font-serif text-[#1F1B16]">
                        {t(city.nameKey)}
                      </h3>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        isAvailable
                          ? 'bg-[#2E7D50]/10 text-[#2E7D50] border border-[#2E7D50]/20'
                          : 'bg-[#D97706]/10 text-[#D97706] border border-[#D97706]/20'
                      }`}
                    >
                      {t(city.statusKey)}
                    </span>
                  </div>
                  <p className="text-[#5A524A] font-medium text-sm sm:text-base pl-1">
                    {city.available && pandalCounts[city.cityName]
                      ? t('city_pandal_count', { count: pandalCounts[city.cityName] })
                      : t(city.statusKey)}
                  </p>
                </div>

                <div className="flex items-center gap-1 text-sm font-semibold text-[#80132F]">
                  {isAvailable ? (
                    <>
                      <span>{t('hero_btn_start')}</span>
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </>
                  ) : (
                    <span className="text-[#6B6257] italic">Soon</span>
                  )}
                </div>
              </div>
            );

            return isAvailable ? (
              <ScrollReveal
                key={idx}
                animation="fade-up"
                delay={idx * 120}
                duration={750}
                className="w-full"
              >
                <Link href={city.href} className="block w-full">
                  {CardContent}
                </Link>
              </ScrollReveal>
            ) : (
              <ScrollReveal
                key={idx}
                animation="fade-up"
                delay={idx * 120}
                duration={750}
                className="w-full"
              >
                <div className="w-full">{CardContent}</div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
