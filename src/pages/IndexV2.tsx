import Navigation from "@/components/Navigation";
import HeroV2 from "@/components/v2/HeroV2";
import FeaturesV2 from "@/components/v2/FeaturesV2";
import AIWorkforceV2 from "@/components/v2/AIWorkforceV2";
import LiveDemo from "@/components/LiveDemo";
import PricingTable from "@/components/PricingTable";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";

const IndexV2 = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main>
        <HeroV2 />
        <FeaturesV2 />
        <AIWorkforceV2 />
        <LiveDemo />
        <PricingTable />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
};

export default IndexV2;