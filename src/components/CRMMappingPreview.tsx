import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Copy, Eye, User, Building, Mail, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LeadData {
  id: string;
  inquiry_type: 'contact' | 'enterprise';
  full_name: string;
  email: string;
  phone?: string;
  company?: string;
  message?: string;
  product_interest?: string;
  product_line?: string;
  additional_requirements?: string;
  expected_volume_label?: string;
  expected_volume_value?: string;
  page_url?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  ip_country?: string;
  marketing_opt_in?: boolean;
}

interface SuiteCRMPayload {
  first_name: string;
  last_name: string;
  email1: string;
  phone_work?: string;
  account_name?: string;
  lead_source: string;
  description: string;
  product_line_c?: string;
  product_interest_c?: string;
  inquiry_type_c: string;
  expected_volume_c?: string;
  expected_volume_code_c?: string;
  utm_source_c?: string;
  utm_medium_c?: string;
  utm_campaign_c?: string;
  utm_term_c?: string;
  utm_content_c?: string;
  page_url_c?: string;
  referrer_c?: string;
  ip_country_c?: string;
  marketing_opt_in_c?: boolean;
  external_id_c: string;
}

// Client-side mapping functions (simplified versions)
function splitFullName(fullName: string): { first_name: string; last_name: string } {
  const trimmed = fullName.trim();
  const parts = trimmed.split(/\\s+/);
  
  if (parts.length === 1) {
    return { first_name: '', last_name: parts[0] };
  } else {
    return {
      first_name: parts[0],
      last_name: parts.slice(1).join(' ')
    };
  }
}

function composeDescription(lead: LeadData): string {
  const parts: string[] = [];
  
  if (lead.product_interest) {
    parts.push(`Product Interest: ${lead.product_interest}`);
  }
  if (lead.product_line) {
    parts.push(`Product Line: ${lead.product_line}`);
  }
  
  const content = lead.inquiry_type === 'contact' ? lead.message : lead.additional_requirements;
  if (content) {
    parts.push(`Details: ${content}`);
  }
  
  if (lead.expected_volume_label) {
    parts.push(`Expected Volume: ${lead.expected_volume_label}`);
  }
  
  const trackingParts: string[] = [];
  if (lead.page_url) trackingParts.push(`Page: ${lead.page_url}`);
  if (lead.referrer) trackingParts.push(`Referrer: ${lead.referrer}`);
  if (lead.utm_source) trackingParts.push(`UTM Source: ${lead.utm_source}`);
  if (lead.utm_medium) trackingParts.push(`UTM Medium: ${lead.utm_medium}`);
  if (lead.utm_campaign) trackingParts.push(`UTM Campaign: ${lead.utm_campaign}`);
  
  if (trackingParts.length > 0) {
    parts.push(`Tracking: ${trackingParts.join(', ')}`);
  }
  
  return parts.join('\\n\\n');
}

function mapLeadToSuiteCRM(lead: LeadData): SuiteCRMPayload {
  const { first_name, last_name } = splitFullName(lead.full_name);
  
  return {
    first_name,
    last_name,
    email1: lead.email,
    phone_work: lead.phone || undefined,
    account_name: lead.company || undefined,
    lead_source: lead.inquiry_type === 'contact' ? 'Website - Contact Us' : 'Website - Enterprise Sales',
    description: composeDescription(lead),
    product_line_c: lead.product_line || undefined,
    product_interest_c: lead.product_interest || undefined,
    inquiry_type_c: lead.inquiry_type,
    expected_volume_c: lead.expected_volume_label || undefined,
    expected_volume_code_c: lead.expected_volume_value || undefined,
    utm_source_c: lead.utm_source || undefined,
    utm_medium_c: lead.utm_medium || undefined,
    utm_campaign_c: lead.utm_campaign || undefined,
    utm_term_c: lead.utm_term || undefined,
    utm_content_c: lead.utm_content || undefined,
    page_url_c: lead.page_url || undefined,
    referrer_c: lead.referrer || undefined,
    ip_country_c: lead.ip_country || undefined,
    marketing_opt_in_c: lead.marketing_opt_in || undefined,
    external_id_c: lead.id
  };
}

export function CRMMappingPreview() {
  const { toast } = useToast();
  const [showPreview, setShowPreview] = useState(false);
  
  const [leadData, setLeadData] = useState<LeadData>({
    id: crypto.randomUUID(),
    inquiry_type: 'enterprise',
    full_name: 'John Smith',
    email: 'john.smith@example.com',
    phone: '+1-555-123-4567',
    company: 'Example Corp',
    product_interest: 'AI Lead Generation',
    product_line: 'leadgen',
    additional_requirements: 'Looking for a scalable solution to handle high-volume lead generation with AI-powered qualification.',
    expected_volume_label: '5,000-20,000 calls/month',
    expected_volume_value: '5k_20k',
    page_url: 'https://tulora.io/contact/sales',
    utm_source: 'google',
    utm_medium: 'cpc',
    utm_campaign: 'enterprise-leads',
    marketing_opt_in: true
  });

  const suiteCRMPayload = mapLeadToSuiteCRM(leadData);

  const handleCopyPayload = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(suiteCRMPayload, null, 2));
      toast({
        title: "Copied!",
        description: "SuiteCRM payload copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy payload",
        variant: "destructive",
      });
    }
  };

  const customFields = Object.entries(suiteCRMPayload)
    .filter(([key]) => key.endsWith('_c'))
    .filter(([, value]) => value !== undefined);

  const standardFields = Object.entries(suiteCRMPayload)
    .filter(([key]) => !key.endsWith('_c'))
    .filter(([, value]) => value !== undefined);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            SuiteCRM Lead Mapping Preview
          </CardTitle>
          <CardDescription>
            Test how lead data gets mapped to SuiteCRM Leads module fields
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={leadData.full_name}
                onChange={(e) => setLeadData({ ...leadData, full_name: e.target.value })}
                placeholder="John Smith"
              />
            </div>

            <div>
              <Label htmlFor="inquiry_type">Inquiry Type</Label>
              <Select
                value={leadData.inquiry_type}
                onValueChange={(value: 'contact' | 'enterprise') => 
                  setLeadData({ ...leadData, inquiry_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contact">Contact</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={leadData.email}
                onChange={(e) => setLeadData({ ...leadData, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>

            <div>
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={leadData.company || ''}
                onChange={(e) => setLeadData({ ...leadData, company: e.target.value })}
                placeholder="Example Corp"
              />
            </div>

            <div>
              <Label htmlFor="product_interest">Product Interest</Label>
              <Select
                value={leadData.product_interest || ''}
                onValueChange={(value) => 
                  setLeadData({ 
                    ...leadData, 
                    product_interest: value,
                    product_line: value === 'AI Lead Generation' ? 'leadgen' : 'support'
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AI Lead Generation">AI Lead Generation</SelectItem>
                  <SelectItem value="AI Customer Service">AI Customer Service</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="expected_volume">Expected Volume</Label>
              <Select
                value={leadData.expected_volume_label || ''}
                onValueChange={(value) => {
                  const mapping: { [key: string]: string } = {
                    '< 5,000 calls/month': 'lt_5k',
                    '5,000-20,000 calls/month': '5k_20k',
                    '20,000-100,000 calls/month': '20k_100k',
                    '> 100,000 calls/month': 'gt_100k',
                    'Custom/Variable': 'custom'
                  };
                  setLeadData({ 
                    ...leadData, 
                    expected_volume_label: value,
                    expected_volume_value: mapping[value]
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select volume" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="< 5,000 calls/month">&lt; 5,000 calls/month</SelectItem>
                  <SelectItem value="5,000-20,000 calls/month">5,000-20,000 calls/month</SelectItem>
                  <SelectItem value="20,000-100,000 calls/month">20,000-100,000 calls/month</SelectItem>
                  <SelectItem value="> 100,000 calls/month">&gt; 100,000 calls/month</SelectItem>
                  <SelectItem value="Custom/Variable">Custom/Variable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="requirements">Additional Requirements</Label>
            <Textarea
              id="requirements"
              value={leadData.additional_requirements || ''}
              onChange={(e) => setLeadData({ ...leadData, additional_requirements: e.target.value })}
              placeholder="Describe your specific requirements..."
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={() => setShowPreview(!showPreview)} variant="outline">
              <Eye className="h-4 w-4 mr-2" />
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </Button>
            <Button onClick={handleCopyPayload} variant="outline">
              <Copy className="h-4 w-4 mr-2" />
              Copy Payload
            </Button>
          </div>

          {showPreview && (
            <div className="space-y-4">
              <Separator />
              
              <div>
                <h3 className="text-lg font-semibold mb-3">Mapping Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p><strong>Name Split:</strong> "{suiteCRMPayload.first_name}" + "{suiteCRMPayload.last_name}"</p>
                    <p><strong>Lead Source:</strong> {suiteCRMPayload.lead_source}</p>
                    <p><strong>External ID:</strong> {suiteCRMPayload.external_id_c}</p>
                  </div>
                  <div>
                    <p><strong>Standard Fields:</strong> {standardFields.length}</p>
                    <p><strong>Custom Fields:</strong> {customFields.length}</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Standard SuiteCRM Fields</h4>
                <div className="space-y-1">
                  {standardFields.map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <Badge variant="secondary">{key}</Badge>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                        {typeof value === 'string' && value.length > 50 
                          ? `${value.substring(0, 50)}...` 
                          : String(value)
                        }
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Custom Fields (ending with _c)</h4>
                <div className="space-y-1">
                  {customFields.map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <Badge variant="outline">{key}</Badge>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                        {String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Description Block</h4>
                <div className="bg-muted p-3 rounded text-sm whitespace-pre-wrap font-mono">
                  {suiteCRMPayload.description}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}