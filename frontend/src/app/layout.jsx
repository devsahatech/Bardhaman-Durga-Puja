import { Noto_Serif_Bengali, Noto_Sans_Bengali, Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { LanguageProvider } from '@/context/LanguageContext';
import SiteTracker from '@/components/SiteTracker';
import FeedbackMount from '@/components/FeedbackMount';
import { Analytics } from '@vercel/analytics/next';

const notoSerifBengali = Noto_Serif_Bengali({
  subsets: ["bengali"],
  variable: "--font-bengali-serif",
  display: "swap",
});

const notoSansBengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  variable: "--font-bengali-sans",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata = {
  metadataBase: new URL('https://cholopujo.devsaha.tech'),
  title: "Cholo Pujo — Bardhaman Durga Puja 2026 Route Planner",
  description: "বর্ধমান ও কাটোয়ার দুর্গাপূজার পণ্ডেলগুলো সবচেয়ে কম সময়ে ঘুরে দেখুন। বাংলায় ভয়েস গাইড, রুট প্ল্যানার — সম্পূর্ণ ফ্রি, লগইন ছাড়াই।",
  keywords: ["durga puja bardhaman", "katwa durga puja", "pandal hopping", "puja route planner", "bengali navigation"],
  alternates: {
    canonical: 'https://cholopujo.devsaha.tech',
  },
  openGraph: {
    title: "Cholo Pujo — Bardhaman Durga Puja Route Planner",
    description: "Plan your pandal hopping route in Bardhaman & Katwa. Free, no login.",
    url: "https://cholopujo.devsaha.tech",
    siteName: "Cholo Pujo",
    images: [
      {
        url: "/hero.png",
        width: 1200,
        height: 630,
        alt: "Cholo Pujo — Durga Puja Route Planner",
      },
    ],
    locale: "bn_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cholo Pujo — Bardhaman Durga Puja Route Planner",
    description: "Plan your pandal hopping route in Bardhaman & Katwa. Free, no login.",
    images: ["/hero.png"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Cholo Pujo",
  "url": "https://cholopujo.devsaha.tech",
  "description": "Smart route planner for Durga Puja pandal hopping in Bardhaman and Katwa",
  "applicationCategory": "NavigationApplication",
  "operatingSystem": "Web",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "INR"
  }
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="bn"
      suppressHydrationWarning
      className={`${notoSerifBengali.variable} ${notoSansBengali.variable} ${playfair.variable} ${inter.variable} h-full antialiased`}
    >
      <head>
        <script
          id="json-ld"
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body suppressHydrationWarning className="min-h-full flex flex-col bg-[#FAF6EE] text-[#1F1B16]">
        <LanguageProvider>
          <SiteTracker />
          {children}
          <Analytics />
          <FeedbackMount />
        </LanguageProvider>
      </body>
    </html>
  );
}
