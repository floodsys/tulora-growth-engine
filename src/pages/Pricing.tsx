import { Helmet } from "react-helmet-async";
import Navigation from "@/components/Navigation";
import PricingTable from "@/components/PricingTable";
import Footer from "@/components/Footer";

const Pricing = () => {
  return (
    <>
      <Helmet>
        <title>Pricing - AI Lead Gen & Phone Support Solutions</title>
        <meta 
          name="description" 
          content="Choose from our AI Lead Gen and Phone Support plans. Starter plans from $1,500/mo, Business plans from $3,500/mo, or Contact Sales for Enterprise solutions." 
        />
      </Helmet>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main>
          <PricingTable />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Pricing;