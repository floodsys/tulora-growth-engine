import { Github, Twitter, Linkedin } from "lucide-react";

const Footer = () => {
  const footerSections = [
    {
      title: "Product",
      links: [
        { label: "Features", href: "#features" },
        { label: "Pricing", href: "#pricing" },
        { label: "Integrations", href: "/integrations" },
        { label: "API", href: "/api" },
        { label: "Changelog", href: "/changelog" }
      ]
    },
    {
      title: "Company", 
      links: [
        { label: "About", href: "/about" },
        { label: "Blog", href: "/blog" },
        { label: "Careers", href: "/careers" },
        { label: "Contact", href: "/contact" },
        { label: "Press", href: "/press" }
      ]
    },
    {
      title: "Resources",
      links: [
        { label: "Documentation", href: "/docs" },
        { label: "Help Center", href: "/help" },
        { label: "Community", href: "/community" },
        { label: "Templates", href: "/templates" },
        { label: "Best Practices", href: "/best-practices" }
      ]
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms of Service", href: "/terms" },
        { label: "Security", href: "/security" },
        { label: "GDPR", href: "/gdpr" },
        { label: "Data Processing", href: "/dpa" }
      ]
    }
  ];

  return (
    <footer className="bg-background border-t border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
          {/* Brand Column */}
          <div className="col-span-2">
            <div className="mb-6">
              <span className="text-2xl font-bold bg-gradient-brand bg-clip-text text-transparent">
                Tulora
              </span>
            </div>
            <p className="text-muted-foreground mb-6 max-w-sm">
              AI-powered scheduling that turns prospects into booked meetings. 
              Automate your outreach and focus on closing deals.
            </p>
            
            {/* Social Links */}
            <div className="flex space-x-4">
              <a
                href="https://twitter.com/tulora"
                className="text-muted-foreground hover:text-brand transition-colors duration-200"
                aria-label="Twitter"
              >
                <Twitter className="h-5 w-5" />
              </a>
              <a
                href="https://linkedin.com/company/tulora"
                className="text-muted-foreground hover:text-brand transition-colors duration-200"
                aria-label="LinkedIn"
              >
                <Linkedin className="h-5 w-5" />
              </a>
              <a
                href="https://github.com/tulora"
                className="text-muted-foreground hover:text-brand transition-colors duration-200"
                aria-label="GitHub"
              >
                <Github className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Footer Sections */}
          {footerSections.map((section, index) => (
            <div key={index}>
              <h3 className="font-semibold text-foreground mb-4">{section.title}</h3>
              <ul className="space-y-3">
                {section.links.map((link, linkIndex) => (
                  <li key={linkIndex}>
                    <a
                      href={link.href}
                      className="text-muted-foreground hover:text-brand transition-colors duration-200"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Section */}
        <div className="border-t border-border mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-6">
              <p className="text-sm text-muted-foreground">
                © 2024 Tulora. All rights reserved.
              </p>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-success rounded-full"></div>
                <span className="text-xs text-muted-foreground">
                  SOC 2 Type II (In Progress)
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
    </footer>
  );
};

export default Footer;