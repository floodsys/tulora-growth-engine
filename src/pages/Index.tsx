import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import { PlaygroundVoiceDemo } from "@/components/PlaygroundVoiceDemo";
import InfoSection from "@/components/InfoSection";
import AIWorkforceHero from "@/components/AIWorkforceHero";
import FeatureCards from "@/components/FeatureCards";
import LiveDemo from "@/components/LiveDemo";
import IntegrationsGrid from "@/components/IntegrationsGrid";

import Security from "@/components/Security";
import FAQ from "@/components/FAQ";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <Navigation />
      
      {/* Main Content */}
      <main>
        {/* 1. Hero Section */}
        <Hero />
        
        {/* 2. Playground Voice Demo */}
        <PlaygroundVoiceDemo />
        
        {/* 3. AI Workforce Hero */}
        <AIWorkforceHero />
        
        {/* 3. Info Section */}
        <InfoSection />
        
        {/* 3. Outcome-First Features */}
        <FeatureCards />
        
        
        {/* 5. Integrations */}
        <IntegrationsGrid />
        
        {/* 6. Security */}
        <Security />

        {/* 7. FAQ */}
        <FAQ />
        
        {/* 8. Final CTA */}
        <FinalCTA />
      </main>
      
      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Index;
