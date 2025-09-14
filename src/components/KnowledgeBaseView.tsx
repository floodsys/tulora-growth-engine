import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ArrowLeft, Plus, FileText, Globe, Database, Upload, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface KnowledgeBaseViewProps {
  agent: {
    slug: string;
    name: string;
    category: string;
    subtitle: string;
    description: string;
    tags: string[];
  };
}

const knowledgeBaseData = {
  paul: {
    title: "Real Estate Assistant",
    description: "This agent can answer questions using trusted internal documents or URLs.",
    uploadedFiles: [
      {
        name: "PROPERTY_LISTINGS_FAQ.PDF",
        type: "pdf",
        content: [
          "What's the average price per square foot? → Currently $150-200 in this market",
          "Do you work with first-time buyers? → Yes, we specialize in first-time buyer programs",
          "What areas do you serve? → Metro area including downtown, suburbs, and surrounding counties"
        ]
      }
    ]
  },
  laura: {
    title: "Restaurant Support",
    description: "This agent can answer questions using trusted internal documents or URLs.",
    uploadedFiles: [
      {
        name: "RESTAURANT_FAQ.PDF",
        type: "pdf",
        content: [
          "Can I change my time later? → Yes, just call us in advance",
          "Do you allow walk-ins? → Limited availability—reservations preferred",
          "Do you offer private dining? → Yes, available upon request"
        ]
      }
    ]
  },
  jessica: {
    title: "Healthcare Support",
    description: "This agent can answer questions using trusted internal documents or URLs.",
    uploadedFiles: [
      {
        name: "HEALTHCARE_FAQ.PDF",
        type: "pdf",
        content: [
          "Do I need a referral for specialists? → No referral required for internal specialists",
          "What insurance do you accept? → Aetna, Cigna, Blue Cross, UnitedHealthcare, Medicare",
          "Do you offer telehealth? → Yes, for consultations and follow-ups (not physical exams)"
        ]
      }
    ]
  }
};

export function KnowledgeBaseView({ agent }: KnowledgeBaseViewProps) {
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const knowledgeData = knowledgeBaseData[agent.slug as keyof typeof knowledgeBaseData];

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar - Knowledge Base Controls */}
        <div className="lg:col-span-1">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">KNOWLEDGE BASE</h3>
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-sm mb-2">{knowledgeData.title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {knowledgeData.description}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">UPLOAD FILES</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 rounded-md border border-primary/20 bg-primary/5">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="text-sm text-primary">Attached PDF</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-md text-muted-foreground">
                  <Globe className="w-4 h-4" />
                  <span className="text-sm">Web Content Import</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-md text-muted-foreground">
                  <Database className="w-4 h-4" />
                  <span className="text-sm">Integrated Help Center</span>
                </div>
              </div>
            </div>

            <DropdownMenu open={showAddDropdown} onOpenChange={setShowAddDropdown}>
              <DropdownMenuTrigger asChild>
                <Button className="w-full justify-between">
                  <div className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Add Content
                  </div>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-full">
                <DropdownMenuItem className="cursor-not-allowed opacity-60">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload File
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-not-allowed opacity-60">
                  <Globe className="w-4 h-4 mr-2" />
                  Import from Website
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-not-allowed opacity-60">
                  <Database className="w-4 h-4 mr-2" />
                  Connect CRM
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded-md">
              Only available in full platform
            </div>
          </div>
        </div>

        {/* Right Content Area - Uploaded Files */}
        <div className="lg:col-span-3">
          <div className="space-y-4">
            {knowledgeData.uploadedFiles.map((file, index) => (
              <Card key={index} className="border border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    <span className="font-medium text-sm text-primary">{file.name}</span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {file.content.map((item, itemIndex) => (
                      <div key={itemIndex} className="text-sm text-muted-foreground">
                        {item}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}