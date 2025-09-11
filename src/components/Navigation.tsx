import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/logo.svg";
const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, loading } = useAuth();
  return <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Link to="/">
                <img src={logo} alt="Your Logo" className="h-8 w-auto object-contain" />
              </Link>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center justify-between flex-1 ml-8">
            {/* Main Navigation Links - Centered */}
            <div className="flex items-center space-x-8 mx-auto">
              <a href="#features" className="text-foreground hover:text-brand transition-colors duration-200">
                Features
              </a>
              <a href="#voice-demo" className="text-foreground hover:text-brand transition-colors duration-200">
                Voice Demo
              </a>
              <a href="#pricing" className="text-foreground hover:text-brand transition-colors duration-200">
                Pricing
              </a>
              <Link to="/talk-to-us" className="text-foreground hover:text-brand transition-colors duration-200">
                Talk to Us
              </Link>
            </div>
            
            {/* Auth Links - Far Right */}
            <div className="flex items-center space-x-4" aria-live="polite">
              {loading ? (
                // Placeholder to prevent layout shift
                <div className="w-20 h-6"></div>
              ) : user ? (
                // Signed in: show Dashboard
                <Link to="/dashboard" className="text-foreground hover:text-brand transition-colors duration-200">
                  Dashboard
                </Link>
              ) : (
                // Signed out: show Login and Sign Up
                <>
                  <Link to="/auth" className="text-foreground hover:text-brand transition-colors duration-200">
                    Sign in
                  </Link>
                  <Link to="/talk-to-us">
                    <Button className="btn-primary px-6">
                      Contact Us
                    </Button>
                  </Link>
                  {/* Temporary test link */}
                  <Link to="/profile-test" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Profile Test
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-foreground hover:text-brand p-2">
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-card border border-border rounded-lg mt-2">
              <a href="#features" className="block px-3 py-2 text-foreground hover:text-brand transition-colors duration-200" onClick={() => setIsMenuOpen(false)}>
                Features
              </a>
              <a href="#voice-demo" className="block px-3 py-2 text-foreground hover:text-brand transition-colors duration-200" onClick={() => setIsMenuOpen(false)}>
                Voice Demo
              </a>
              <a href="#pricing" className="block px-3 py-2 text-foreground hover:text-brand transition-colors duration-200" onClick={() => setIsMenuOpen(false)}>
                Pricing
              </a>
              <Link to="/talk-to-us" className="block px-3 py-2 text-foreground hover:text-brand transition-colors duration-200" onClick={() => setIsMenuOpen(false)}>
                Talk to Us
              </Link>
              {loading ? (
                <div className="px-3 py-2">
                  <div className="w-20 h-6"></div>
                </div>
              ) : user ? (
                <Link to="/dashboard" className="block px-3 py-2 text-foreground hover:text-brand transition-colors duration-200" onClick={() => setIsMenuOpen(false)}>
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link to="/auth" className="block px-3 py-2 text-foreground hover:text-brand transition-colors duration-200" onClick={() => setIsMenuOpen(false)}>
                    Sign in
                  </Link>
                  <div className="px-3 py-2">
                    <Link to="/talk-to-us">
                      <Button className="btn-primary w-full" onClick={() => setIsMenuOpen(false)}>
                        Contact Us
                      </Button>
                    </Link>
                  </div>
                  {/* Temporary test link */}
                  <Link to="/profile-test" className="block px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={() => setIsMenuOpen(false)}>
                    Profile Test
                  </Link>
                </>
              )}
            </div>
          </div>}
      </div>
    </nav>;
};
export default Navigation;