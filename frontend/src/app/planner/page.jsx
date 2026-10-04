import Navbar from '@/components/Navbar';
import PlannerSection from '@/components/PlannerSection';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Plan Your Puja Route',
  description: 'Pick your pandals and get the shortest route in Bardhaman or Katwa. Free, no login.',
  alternates: {
    canonical: 'https://cholopujo.devsaha.tech/planner',
    languages: {
      'bn-IN': 'https://cholopujo.devsaha.tech/planner',
      'en-IN': 'https://cholopujo.devsaha.tech/planner',
      'x-default': 'https://cholopujo.devsaha.tech/planner',
    },
  },
  openGraph: {
    type: 'website',
    url: 'https://cholopujo.devsaha.tech/planner',
    title: 'Plan Your Puja Route | Cholo Pujo',
    description: 'Pick your pandals and get the shortest route.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function PlannerPage() {
  return (
    <div className="flex flex-col h-[100dvh] bg-[#FAF8F5] overflow-hidden">
      {/* Hide standard navbar on mobile to maximize map space */}
      <div className="hidden md:block">
        <Navbar />
      </div>

      {/* Floating Back Button for Mobile */}
      <a href="/" className="md:hidden absolute top-4 left-4 z-50 bg-white/90 backdrop-blur shadow-lg p-2.5 rounded-full text-gray-800 border border-gray-200 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </a>

      <main className="flex-grow relative h-full">
        <PlannerSection />
      </main>
    </div>
  );
}
