import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, Info } from "lucide-react";

export interface OrganizationStepValues {
  organizationName: string;
  organizationSize: string;
  industry: string;
  customIndustry?: string;
}

interface OrganizationStepProps {
  initialValues?: Partial<OrganizationStepValues>;
  onSubmit: (values: OrganizationStepValues) => Promise<void>;
  onBack?: () => void;
  submitLabel: string;
  showBack: boolean;
  isLoading?: boolean;
}

const organizationSizes = [
  "1–10",
  "11–50", 
  "51–200",
  "201–500",
  "501–1,000",
  "1,001–5,000",
  "5,001+"
];

const industries = [
  "Technology",
  "Healthcare", 
  "Finance",
  "Education",
  "Retail",
  "Manufacturing",
  "Real Estate",
  "Consulting",
  "Marketing",
  "Other"
];

export const OrganizationStep = ({
  initialValues = {},
  onSubmit,
  onBack,
  submitLabel,
  showBack,
  isLoading = false
}: OrganizationStepProps) => {
  const [formData, setFormData] = useState<OrganizationStepValues>({
    organizationName: initialValues.organizationName || "",
    organizationSize: initialValues.organizationSize || "",
    industry: initialValues.industry || "",
    customIndustry: initialValues.customIndustry || ""
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const firstErrorRef = useRef<HTMLElement | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const handleSelectChange = (field: keyof OrganizationStepValues, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
    
    // Clear custom industry if industry is not "Other"
    if (field === "industry" && value !== "Other") {
      setFormData(prev => ({ ...prev, customIndustry: "" }));
      if (errors.customIndustry) {
        setErrors(prev => ({ ...prev, customIndustry: "" }));
      }
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.organizationName.trim()) {
      newErrors.organizationName = "Organization name is required";
    }

    if (!formData.organizationSize) {
      newErrors.organizationSize = "Organization size is required";
    }

    if (!formData.industry) {
      newErrors.industry = "Industry is required";
    }

    if (formData.industry === "Other" && !formData.customIndustry?.trim()) {
      newErrors.customIndustry = "Please specify your industry";
    }

    setErrors(newErrors);

    // Focus first error
    if (Object.keys(newErrors).length > 0) {
      const firstError = Object.keys(newErrors)[0];
      setTimeout(() => {
        const element = document.getElementById(firstError);
        if (element) {
          element.focus();
          firstErrorRef.current = element;
        }
      }, 100);
    }

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }

    const submissionData = {
      ...formData,
      industry: formData.industry === "Other" ? formData.customIndustry! : formData.industry
    };

    await onSubmit(submissionData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Organization Name */}
      <div className="space-y-2">
        <Label htmlFor="organizationName" className="text-sm font-medium">
          Organization name *
        </Label>
        <Input
          id="organizationName"
          name="organizationName"
          type="text"
          value={formData.organizationName}
          onChange={handleInputChange}
          className={errors.organizationName ? "border-destructive" : ""}
          placeholder="Enter your organization name"
          disabled={isLoading}
        />
        {errors.organizationName && (
          <p className="text-sm text-destructive">{errors.organizationName}</p>
        )}
      </div>

      {/* Organization Size */}
      <div className="space-y-2">
        <Label htmlFor="organizationSize" className="text-sm font-medium">
          Organization size *
        </Label>
        <Select
          value={formData.organizationSize}
          onValueChange={(value) => handleSelectChange("organizationSize", value)}
          disabled={isLoading}
        >
          <SelectTrigger 
            id="organizationSize"
            className={errors.organizationSize ? "border-destructive" : ""}
          >
            <SelectValue placeholder="Select organization size" />
          </SelectTrigger>
          <SelectContent>
            {organizationSizes.map((size) => (
              <SelectItem key={size} value={size}>
                {size} employees
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.organizationSize && (
          <p className="text-sm text-destructive">{errors.organizationSize}</p>
        )}
      </div>

      {/* Industry */}
      <div className="space-y-2">
        <Label htmlFor="industry" className="text-sm font-medium">
          Industry *
        </Label>
        <Select
          value={formData.industry}
          onValueChange={(value) => handleSelectChange("industry", value)}
          disabled={isLoading}
        >
          <SelectTrigger 
            id="industry"
            className={errors.industry ? "border-destructive" : ""}
          >
            <SelectValue placeholder="Select your industry" />
          </SelectTrigger>
          <SelectContent>
            {industries.map((industry) => (
              <SelectItem key={industry} value={industry}>
                {industry}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.industry && (
          <p className="text-sm text-destructive">{errors.industry}</p>
        )}
      </div>

      {/* Custom Industry (when "Other" is selected) */}
      {formData.industry === "Other" && (
        <div className="space-y-2">
          <Label htmlFor="customIndustry" className="text-sm font-medium">
            Specify industry *
          </Label>
          <Input
            id="customIndustry"
            name="customIndustry"
            type="text"
            value={formData.customIndustry}
            onChange={handleInputChange}
            className={errors.customIndustry ? "border-destructive" : ""}
            placeholder="Enter your industry"
            disabled={isLoading}
          />
          {errors.customIndustry && (
            <p className="text-sm text-destructive">{errors.customIndustry}</p>
          )}
        </div>
      )}

      {/* Info message */}
      <div className="flex items-start space-x-2 p-3 bg-muted/30 rounded-lg">
        <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground">
          You can change this later in Settings → Profile.
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col space-y-3">
        <Button
          type="submit"
          className="w-full"
          disabled={isLoading}
        >
          {submitLabel}
        </Button>

        {showBack && onBack && (
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={onBack}
            disabled={isLoading}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        )}
      </div>
    </form>
  );
};