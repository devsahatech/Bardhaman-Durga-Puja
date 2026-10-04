import Navbar from '@/components/Navbar';
import HeroSection from '@/components/landing/HeroSection';
import FeatureCards from '@/components/landing/FeatureCards';
import HowItWorksSection from '@/components/landing/HowItWorksSection';
import WhyCholoPujo from '@/components/landing/WhyCholoPujo';
import CitiesCovered from '@/components/landing/CitiesCovered';
import LocalBusinesses from '@/components/landing/LocalBusinesses';
import SupportProject from '@/components/landing/SupportProject';
import EmergencyNumbers from '@/components/landing/EmergencyNumbers';
import LandingFooter from '@/components/landing/LandingFooter';

export const metadata = {
  title: 'Cholo Pujo, Bardhaman Durga Puja 2026 Route Planner',
  description: 'Plan your Durga Puja pandal hopping in Bardhaman & Katwa. Free route planner with Bengali voice guidance. No login required.',
  alternates: {
    canonical: 'https://cholopujo.devsaha.tech',
    languages: {
      'bn-IN': 'https://cholopujo.devsaha.tech',
      'en-IN': 'https://cholopujo.devsaha.tech',
      'x-default': 'https://cholopujo.devsaha.tech',
    },
  },
  openGraph: {
    type: 'website',
    url: 'https://cholopujo.devsaha.tech',
    title: 'Cholo Pujo, Bardhaman Durga Puja 2026 Route Planner',
    description: 'Plan your Durga Puja pandal hopping in Bardhaman & Katwa. Free, no login.',
    siteName: 'Cholo Pujo',
  },
};

import { getPandalCounts } from '@/lib/getPandalCounts';

export default function Home() {
  const pandalCounts = getPandalCounts();
  return (
    <main className="min-h-screen bg-[#FAF6EE] text-[#1F1B16] font-sans antialiased">
      {/* Navigation Bar */}
      <Navbar />

      {/* Main Landing Sections (Strict Order 1-8) */}
      <div className="pt-16 md:pt-20">
        <HeroSection />
        <FeatureCards />
        <HowItWorksSection />
        <WhyCholoPujo />
        <CitiesCovered pandalCounts={pandalCounts} />
        <LocalBusinesses />
        <SupportProject />
        <EmergencyNumbers />
      </div>

      {/* Footer */}
      <LandingFooter />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": "Cholo Pujo",
            "alternateName": "চলো পূজো",
            "url": "https://cholopujo.devsaha.tech",
            "description": "Route planner for Durga Puja pandal hopping in Bardhaman and Katwa, West Bengal.",
            "applicationCategory": "TravelApplication",
            "operatingSystem": "Web",
            "inLanguage": ["bn-IN", "en-IN"],
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "INR"
            },
            "author": {
              "@type": "Organization",
              "name": "DevSaha Tech",
              "url": "https://devsaha.tech"
            },
            "areaServed": [
              {
                "@type": "City",
                "name": "Bardhaman",
                "address": {
                  "@type": "PostalAddress",
                  "addressLocality": "Bardhaman",
                  "addressRegion": "West Bengal",
                  "addressCountry": "IN"
                }
              },
              {
                "@type": "City",
                "name": "Katwa",
                "address": {
                  "@type": "PostalAddress",
                  "addressLocality": "Katwa",
                  "addressRegion": "West Bengal",
                  "addressCountry": "IN"
                }
              }
            ]
          })
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Event",
            "name": "Durga Puja 2026, Bardhaman",
            "startDate": "2026-10-16",
            "endDate": "2026-10-21",
            "eventStatus": "https://schema.org/EventScheduled",
            "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
            "location": {
              "@type": "Place",
              "name": "Bardhaman",
              "address": {
                "@type": "PostalAddress",
                "addressLocality": "Bardhaman",
                "addressRegion": "West Bengal",
                "addressCountry": "IN"
              }
            },
            "image": "https://cholopujo.devsaha.tech/logo.png",
            "description": "Durga Puja 2026 in Bardhaman. Plan your pandal hopping with Cholo Pujo.",
            "organizer": {
              "@type": "Organization",
              "name": "DevSaha Tech",
              "url": "https://devsaha.tech"
            }
          })
        }}
      />
    </main>
  );
}
