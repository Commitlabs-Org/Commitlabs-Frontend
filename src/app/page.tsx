import SolutionSection from '@/components/SolutionSection'
import CommitmentJourney from '@/components/CommitmentJourney/CommitmentJourney'
import ImpactSection from '@/components/ImpactSection'
import { HeroSection } from '@/components/landing-page/sections/HeroSection'
import { ProblemSection } from '@/components/landing-page/sections/ProblemSection'
import Footer from '@/components/landing-page/Footer'
import React from 'react'

export default function Home() {
  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] flex flex-col items-center justify-center overflow-hidden">
      <HeroSection />
      <ProblemSection />
      <CommitmentJourney />
      <ImpactSection />
      <SolutionSection />
      <Footer />
    </div>
  )
}
