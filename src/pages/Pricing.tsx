import { Helmet } from "react-helmet-async";
import Navigation from "@/components/Navigation";
import PricingTable from "@/components/PricingTable";
import Footer from "@/components/Footer";

const Pricing = () => {
  return (
    <>
      <Helmet>
        <title>Pricing - AI Lead Gen & Customer Service Solutions</title>
        <meta 
          name="description" 
          content="Choose from our AI Lead Gen and Customer Service plans. Starter plans from $1,500/mo, Business plans from $3,500/mo, or Contact Sales for Enterprise solutions." 
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