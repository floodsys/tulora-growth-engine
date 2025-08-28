import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import { PlaygroundVoiceDemo } from "@/components/PlaygroundVoiceDemo";
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
        
        {/* 2. Playground Voice Demo - The core demo experience */}
        <PlaygroundVoiceDemo />
      </main>
      
      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Index;
