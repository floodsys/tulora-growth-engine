import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-2xl font-bold bg-gradient-brand bg-clip-text text-transparent">
                Tulora
              </span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center justify-between flex-1 ml-8">
            {/* Main Navigation Links - Centered */}
            <div className="flex items-center space-x-8 mx-auto">
              <a
                href="#features"
                className="text-foreground hover:text-brand transition-colors duration-200"
              >
                Features
              </a>
              <a
                href="#pricing"
                className="text-foreground hover:text-brand transition-colors duration-200"
              >
                Pricing
              </a>
              <a
                href="#docs"
                className="text-foreground hover:text-brand transition-colors duration-200"
              >
                Docs
              </a>
              <a
                href="#blog"
                className="text-foreground hover:text-brand transition-colors duration-200"
              >
                Blog
              </a>
            </div>
            
            {/* Auth Links - Far Right */}
            <div className="flex items-center space-x-4">
              <a
                href="/signin"
                className="text-foreground hover:text-brand transition-colors duration-200"
              >
                Login
              </a>
              <Button 
                className="btn-primary px-6" 
                onClick={() => window.location.href = '/signup'}
              >
                Sign Up
              </Button>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-foreground hover:text-brand p-2"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-card border border-border rounded-lg mt-2">
              <a
                href="#features"
                className="block px-3 py-2 text-foreground hover:text-brand transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                Features
              </a>
              <a
                href="#pricing"
                className="block px-3 py-2 text-foreground hover:text-brand transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                Pricing
              </a>
              <a
                href="#docs"
                className="block px-3 py-2 text-foreground hover:text-brand transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                Docs
              </a>
              <a
                href="#blog"
                className="block px-3 py-2 text-foreground hover:text-brand transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                Blog
              </a>
              <a
                href="/signin"
                className="block px-3 py-2 text-foreground hover:text-brand transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                Login
              </a>
              <div className="px-3 py-2">
                <Button 
                  className="btn-primary w-full" 
                  onClick={() => window.location.href = '/signup'}
                >
                  Sign Up
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;