import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import TypewriterHero from "@/components/TypewriterHero";
import InfoSection from "@/components/InfoSection";
import AIWorkforceHero from "@/components/AIWorkforceHero";
import ProofStrip from "@/components/ProofStrip";
import FeatureCards from "@/components/FeatureCards";
import LiveDemo from "@/components/LiveDemo";
import IntegrationsGrid from "@/components/IntegrationsGrid";
import PricingTable from "@/components/PricingTable";
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
        
        {/* 2. Typewriter Hero */}
        <TypewriterHero />
        
        {/* 3. Info Section */}
        <InfoSection />
        
        {/* 4. AI Workforce Hero */}
        <AIWorkforceHero />
        
        {/* 3. Proof Strip */}
        <ProofStrip />
        
        {/* 3. Outcome-First Features */}
        <FeatureCards />
        
        {/* 4. Live Demo / Interactive */}
        <LiveDemo />
        
        {/* 5. Integrations */}
        <IntegrationsGrid />
        
        {/* 6. Pricing */}
        <PricingTable />
        
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
