"use client";

import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import SectionCornerPatterns from './SectionCornerPatterns';
import SectionDivider from './SectionDivider';
import ScrollReveal from '@/components/ui/ScrollReveal';

import { Trophy, Clock, Search, Map, Share2, Mic } from 'lucide-react';

export default function FeatureCards() {
  const { t } = useLanguage();

  const features = [
    {
      Icon: Trophy,
      titleKey: 'feat1_card_t',
      descKey: 'feat1_card_d',
    },
    {
      Icon: Clock,
      titleKey: 'feat2_card_t',
      descKey: 'feat2_card_d',
    },
    {
      Icon: Search,
      titleKey: 'feat3_card_t',
      descKey: 'feat3_card_d',
    },
    {
      Icon: Map,
      titleKey: 'feat4_card_t',
      descKey: 'feat4_card_d',
    },
    {
      Icon: Share2,
      titleKey: 'feat5_card_t',
      descKey: 'feat5_card_d',
    },
    {
      Icon: Mic,
      titleKey: 'feat6_card_t',
      descKey: 'feat6_card_d',
    },
  ];

  return (
    <section className="relative py-12 md:py-16 bg-[#FAF6EE] border-b border-[#E5DBC8] overflow-hidden">
      <SectionCornerPatterns />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Heading with decorative Lotus Divider */}
        <ScrollReveal animation="fade-up" duration={700} className="text-center max-w-2xl mx-auto mb-10 md:mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#80132F] font-serif mb-1">
            {t('feat_sec_title')}
          </h2>
          <SectionDivider />
          <p className="text-sm sm:text-base text-[#6B6257] font-medium">
            {t('feat_sec_sub')}
          </p>
        </ScrollReveal>

        {/* Feature Cards Grid - Option A Adaptive proportions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6 items-stretch">
          {features.map((feat, idx) => {
            const IconComp = feat.Icon;
            return (
              <ScrollReveal
                key={idx}
                animation="fade-up"
                delay={idx * 120}
                duration={750}
                className="h-full"
              >
                <div className="bg-white p-4 sm:p-5 md:p-6 rounded-2xl border border-[#F0EAE1] shadow-[0_4px_20px_-2px_rgba(139,30,63,0.05),0_1px_3px_rgba(0,0,0,0.03)] card-hover-lift hover:border-[#80132F]/20 hover:shadow-md transition-all duration-300 flex flex-row items-start gap-3.5 sm:gap-4 md:gap-5 h-full">
                  {/* Pale circular icon container with responsive scaling */}
                  <div className="w-13 h-13 sm:w-15 sm:h-15 md:w-17 md:h-17 w-[52px] h-[52px] sm:w-[60px] sm:h-[60px] md:w-[68px] md:h-[68px] rounded-full bg-[#FAF0E6] border border-[#F3E5D4] flex items-center justify-center shrink-0 mt-0.5">
                    <IconComp className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-[#80132F]" />
                  </div>
                  {/* Card Content with ample reading room */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-bold text-[#80132F] font-serif mb-1 leading-snug tracking-tight">
                      {t(feat.titleKey)}
                    </h3>
                    <p className="text-[#5A524A] text-xs sm:text-[13.5px] leading-relaxed">
                      {t(feat.descKey)}
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
