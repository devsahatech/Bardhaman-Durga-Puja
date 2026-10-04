"use client";

import React, { useState, useMemo } from 'react';
import { Heart, QrCode, IndianRupee } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useLanguage } from '@/context/LanguageContext';

import SectionCornerPatterns from './SectionCornerPatterns';
import ScrollReveal from '@/components/ui/ScrollReveal';

export default function SupportProject() {
  const { t } = useLanguage();
  const [selectedAmount, setSelectedAmount] = useState("20");
  const [customAmount, setCustomAmount] = useState("");
  const [isCustom, setIsCustom] = useState(false);

  const finalAmount = useMemo(() => {
    if (isCustom) {
      const parsed = parseFloat(customAmount);
      if (!isNaN(parsed) && parsed > 0) return customAmount;
    } else if (selectedAmount) {
      return selectedAmount;
    }
    return "1";
  }, [isCustom, customAmount, selectedAmount]);

  const upiIntent = `upi://pay?pa=6295111477@superyes&pn=CholoPujo&am=${finalAmount}&tn=Cholo%20Pujo%20Contribution&mam=1&cu=INR`;
  const presets = [20, 50, 100, 500];

  return (
    <section className="relative py-12 md:py-16 bg-[#FAF6EE] border-b border-[#E5DBC8] overflow-hidden">
      <SectionCornerPatterns />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <ScrollReveal animation="scale-up" duration={800}>
          <div className="bg-[#FFFEFA] p-8 md:p-12 rounded-3xl border border-[#E5DBC8] shadow-sm text-center relative overflow-hidden card-hover-lift">
            <div className="w-12 h-12 rounded-full bg-[#8B1E3F]/10 text-[#8B1E3F] flex items-center justify-center mx-auto mb-6">
              <Heart className="w-6 h-6 fill-[#8B1E3F]/20" />
            </div>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#1F1B16] font-serif mb-3">
              {t('supp_sec_title')}
            </h2>
            <p className="text-sm md:text-base font-semibold text-[#8B1E3F] mb-6">
              {t('supp_sec_sub')}
            </p>

            <p className="text-[#6B6257] text-base md:text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
              {t('supp_body')}
            </p>

            {/* Amount Selector */}
            <div className="bg-[#FAF6EE] p-6 rounded-2xl border border-[#E5DBC8] max-w-sm mx-auto flex flex-col items-center mb-6">
              <p className="text-[#1F1B16] font-semibold mb-4">{t('supp_amt_label')}</p>
              <div className="grid grid-cols-4 gap-2 mb-4 w-full">
                {presets.map(amt => (
                  <button
                    key={amt}
                    onClick={() => {
                      setSelectedAmount(amt.toString());
                      setIsCustom(false);
                    }}
                    className={`py-2 px-1 rounded-xl text-sm font-bold transition-colors ${!isCustom && selectedAmount === amt.toString() ? 'bg-[#8B1E3F] text-white shadow-md' : 'bg-white border border-[#E5DBC8] text-[#6B6257] hover:bg-[#E5DBC8]/30'}`}
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>
              
              <div className="w-full text-left mb-2">
                <label className="flex items-center gap-2 text-sm text-[#6B6257] font-medium mb-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={isCustom} 
                    onChange={(e) => setIsCustom(e.target.checked)}
                    className="rounded text-[#8B1E3F] focus:ring-[#8B1E3F]"
                  />
                  {t('supp_custom_amt')}
                </label>
                
                {isCustom && (
                  <div className="relative w-full">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <IndianRupee className="h-4 w-4 text-[#6B6257]" />
                    </div>
                    <input
                      type="number"
                      min="1"
                      placeholder={t('supp_amt_placeholder')}
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      className="block w-full pl-9 pr-3 py-2 border border-[#E5DBC8] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#8B1E3F] focus:border-[#8B1E3F] bg-white text-[#1F1B16] sm:text-sm transition-colors"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Desktop QR */}
            <div className="hidden md:flex flex-col items-center bg-[#FAF6EE] p-6 rounded-2xl border border-[#E5DBC8] max-w-sm mx-auto shadow-sm">
              <div className="bg-white p-4 rounded-xl border border-[#E5DBC8] mb-4 shadow-inner">
                <QRCodeSVG value={upiIntent} size={240} level="H" bgColor="#ffffff" fgColor="#000000" />
              </div>
              <p className="font-bold text-[#1F1B16] text-lg mb-2">
                {t('supp_scan_pay', { amt: finalAmount })}
              </p>
              <p className="text-xs text-[#6B6257] font-medium text-center">
                {t('supp_upi_note')}
              </p>
            </div>

            {/* Mobile Pay Button + Small QR */}
            <div className="md:hidden flex flex-col items-center max-w-sm mx-auto w-full">
              <a 
                href={upiIntent}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#8B1E3F] text-white rounded-xl text-base font-bold shadow-md hover:bg-[#721833] transition-colors mb-3"
              >
                {t('supp_pay_button', { amt: finalAmount })}
              </a>
              <p className="text-xs text-[#6B6257] font-medium text-center mb-5">
                {t('supp_upi_note')}
              </p>

              <div className="bg-white p-3 rounded-xl border border-[#E5DBC8] shadow-sm">
                <QRCodeSVG
                  value={upiIntent}
                  size={180}
                  level="H"
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
              </div>
              <p className="font-semibold text-[#1F1B16] text-sm mt-3">
                {t('supp_scan_pay', { amt: finalAmount })}
              </p>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
