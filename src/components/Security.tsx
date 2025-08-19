import securityImage from "@/assets/security.svg";
import { Shield, FileCheck, Server, Users, Lock, Eye } from 'lucide-react';
const Security = () => {
  const securityFeatures = [{
    title: "No Training on your Data",
    description: "Your data remains private and is never utilized for model training purposes.",
    icon: Shield
  }, {
    title: "SOC 2 (Type II) & GDPR Compliant",
    description: "We are SOC 2 (Type II) certified and GDPR compliant, ensuring top-tier data security and privacy.",
    icon: FileCheck
  }, {
    title: "Dedicated Infrastructure",
    description: "AI models run with the highest levels of privacy and security with GCP Vertex AI.",
    icon: Server
  }, {
    title: "Role based access control",
    description: "Fine-grained access controls to manage your team's permissions securely and efficiently.",
    icon: Users
  }, {
    title: "Data Encryption",
    description: "Robust secure encryption (AES-256) for data at rest and TLS for data in transit.",
    icon: Lock
  }, {
    title: "Security first",
    description: "We never store anything we don't need to. The inputs or outputs of your tools are never stored.",
    icon: Eye
  }];
  return <section className="py-20 px-4 bg-background">
      <div className="container mx-auto max-w-6xl">
        {/* Header with image */}
        <div className="text-center mb-16">
          <div className="flex justify-center mb-8">
            <img src={securityImage} alt="Security illustration" className="w-48 h-28" />
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Manage and monitor your 
            <br />
            AI workers in one secure place.
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            We ensure security and compliance, are GDPR-ready, hold a SOC 2 (Type 2) certification,
            and give you control over your data storage.
          </p>
        </div>

        {/* Security Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {securityFeatures.map((feature, index) => {
          const IconComponent = feature.icon;
          return <div key={index} className="bg-card rounded-lg p-6 border border-border/50 hover:border-primary/20 transition-colors hover:shadow-lg">
                <div className="mb-4 text-center">
                  <div className="w-12 h-12 mb-4 rounded-lg bg-gradient-to-br from-[#6056FF] to-[#FE7587] flex items-center justify-center mx-auto">
                    <IconComponent className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">
                    {feature.title}
                  </h3>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>;
        })}
        </div>
      </div>
    </section>;
};
export default Security;