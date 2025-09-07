import { X, Linkedin, Youtube, Instagram } from "lucide-react";
import { Link } from "react-router-dom";
import iconLogo from "@/assets/icon_logo.svg";
const Footer = () => {
  const footerSections = [{
    title: "Product",
    links: [{
      label: "Features",
      href: "#features"
    }, {
      label: "Pricing",
      href: "#pricing"
    }]
  }, {
    title: "Company",
    links: [{
      label: "About",
      href: "/about"
    }, {
      label: "Blog (coming soon)",
      href: "/blog"
    }, {
      label: "Contact",
      href: "/talk-to-us"
    }]
  }, {
    title: "Legal",
    links: [{
      label: "Privacy Policy",
      href: "/privacy"
    }, {
      label: "Terms of Service",
      href: "/terms"
    }, {
      label: "Security",
      href: "/security"
    }, {
      label: "GDPR",
      href: "/gdpr"
    }, {
      label: "Data Processing",
      href: "/dpa"
    }]
  }];
  return <footer className="bg-background border-t border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8">
          {/* Brand Column */}
          <div className="col-span-2">
            <div className="mb-6">
              <Link to="/">
                <img src={iconLogo} alt="Tulora" className="h-8 w-auto" />
              </Link>
            </div>
            <p className="text-muted-foreground mb-6 max-w-sm">Tulora — Always present. Always by your side</p>
            
            {/* Social Links */}
            <div className="flex space-x-4">
              <a href="https://x.com/tulora" className="text-muted-foreground hover:text-brand transition-colors duration-200" aria-label="X">
                <X className="h-5 w-5" />
              </a>
              <a href="https://linkedin.com/company/tulora" className="text-muted-foreground hover:text-brand transition-colors duration-200" aria-label="LinkedIn">
                <Linkedin className="h-5 w-5" />
              </a>
              <a href="https://youtube.com/@tulora" className="text-muted-foreground hover:text-brand transition-colors duration-200" aria-label="YouTube">
                <Youtube className="h-5 w-5" />
              </a>
              <a href="https://instagram.com/tulora" className="text-muted-foreground hover:text-brand transition-colors duration-200" aria-label="Instagram">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="https://tiktok.com/@tulora" className="text-muted-foreground hover:text-brand transition-colors duration-200" aria-label="TikTok">
                <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Footer Sections */}
          {footerSections.map((section, index) => <div key={index}>
              <h3 className="font-semibold text-foreground mb-4">{section.title}</h3>
              <ul className="space-y-3">
                {section.links.map((link, linkIndex) => <li key={linkIndex}>
                    <a href={link.href} className="text-muted-foreground hover:text-brand transition-colors duration-200">
                      {link.label}
                    </a>
                  </li>)}
              </ul>
            </div>)}
        </div>

        {/* Bottom Section */}
        <div className="border-t border-border mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-6">
              <p className="text-sm text-muted-foreground">
                © 2025 Tulora. All rights reserved.
              </p>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-success rounded-full"></div>
                <span className="text-xs text-muted-foreground">
                  SOC 2 Type II
                </span>
              </div>
            </div>
            
            <div className="flex items-center space-x-6 text-sm text-muted-foreground">
              <span>🌍 Remote-first company</span>
              <span>🔒 Enterprise-grade security</span>
            </div>
          </div>
        </div>
      </div>
    </footer>;
};
export default Footer;