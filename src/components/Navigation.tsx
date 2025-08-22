import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/logo.svg";
const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  return <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <img src={logo} alt="Your Logo" className="h-8 w-auto object-contain" />
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center justify-between flex-1 ml-8">
            {/* Main Navigation Links - Centered */}
            <div className="flex items-center space-x-8 mx-auto">
              <a href="#features" className="text-foreground hover:text-brand transition-colors duration-200">
                Features
              </a>
              <a href="#pricing" className="text-foreground hover:text-brand transition-colors duration-200">
                Pricing
              </a>
              <Link to="/talk-to-us" className="text-foreground hover:text-brand transition-colors duration-200">
                Talk to Us
              </Link>
            </div>
            
            {/* Auth Links - Far Right */}
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <Link to="/dashboard" className="text-foreground hover:text-brand transition-colors duration-200">
                    Dashboard
                  </Link>
                  <Link to="/billing" className="text-foreground hover:text-brand transition-colors duration-200">
                    Billing
                  </Link>
                  <Button variant="outline" onClick={signOut}>
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/signin" className="text-foreground hover:text-brand transition-colors duration-200">
                    Login
                  </Link>
                  <Button className="btn-primary px-6" asChild>
                    <Link to="/signup">Sign Up</Link>
                  </Button>
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
              <a href="#pricing" className="block px-3 py-2 text-foreground hover:text-brand transition-colors duration-200" onClick={() => setIsMenuOpen(false)}>
                Pricing
              </a>
              <Link to="/talk-to-us" className="block px-3 py-2 text-foreground hover:text-brand transition-colors duration-200" onClick={() => setIsMenuOpen(false)}>
                Talk to Us
              </Link>
              {user ? (
                <>
                  <Link to="/dashboard" className="block px-3 py-2 text-foreground hover:text-brand transition-colors duration-200" onClick={() => setIsMenuOpen(false)}>
                    Dashboard
                  </Link>
                  <Link to="/billing" className="block px-3 py-2 text-foreground hover:text-brand transition-colors duration-200" onClick={() => setIsMenuOpen(false)}>
                    Billing
                  </Link>
                  <div className="px-3 py-2">
                    <Button variant="outline" className="w-full" onClick={() => { signOut(); setIsMenuOpen(false); }}>
                      Sign Out
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Link to="/signin" className="block px-3 py-2 text-foreground hover:text-brand transition-colors duration-200" onClick={() => setIsMenuOpen(false)}>
                    Login
                  </Link>
                  <div className="px-3 py-2">
                    <Button className="btn-primary w-full" asChild>
                      <Link to="/signup" onClick={() => setIsMenuOpen(false)}>Sign Up</Link>
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>}
      </div>
    </nav>;
};
export default Navigation;