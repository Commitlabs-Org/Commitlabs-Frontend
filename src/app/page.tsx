import dynamic from 'next/dynamic';
import React from 'react';
import { HeroSection } from "@/components/landing-page/sections/HeroSection";
import { Navigation } from "@/components/landing-page/Navigation";
import { Skeleton } from '@/components/Skeleton';

// Lazy-loaded sections
const ProblemSection = dynamic(() => import('@/components/landing-page/sections/ProblemSection'), {
  loading: () => <Skeleton className="w-full h-64" />,
  ssr: false,
});
const SolutionSection = dynamic(() => import('@/components/SolutionSection'), {
  loading: () => <Skeleton className="w-full h-64" />,
  ssr: false,
});
const CoreConceptsSection = dynamic(() => import('@/components/landing-page/sections/CoreConceptsSection'), {
  loading: () => <Skeleton className="w-full h-64" />,
  ssr: false,
});
const CommitmentJourney = dynamic(() => import('@/components/CommitmentJourney/CommitmentJourney'), {
  loading: () => <Skeleton className="w-full h-64" />,
  ssr: false,
});
const ImpactSection = dynamic(() => import('@/components/ImpactSection'), {
  loading: () => <Skeleton className="w-full h-64" />,
  ssr: false,
});
const ExperienceSection = dynamic(() => import('@/components/landing-page/sections/ExperienceSection'), {
  loading: () => <Skeleton className="w-full h-64" />,
  ssr: false,
});
const Footer = dynamic(() => import('@/components/landing-page/Footer'), {
  loading: () => <Skeleton className="w-full h-64" />,
  ssr: false,
});
const ModalTester = dynamic(() => import('./ModalTester'), {
  loading: () => <Skeleton className="w-full h-64" />,
  ssr: false,
});

export default function Home() {
  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] overflow-hidden">
      <Navigation />
      <main id="main-content">
        <HeroSection />
        <ProblemSection />
        <SolutionSection />
        <CoreConceptsSection />
        <CommitmentJourney />
        <ImpactSection />
        <ExperienceSection />
      </main>
      <Footer />
      <ModalTester />
    </div>
  );
}
