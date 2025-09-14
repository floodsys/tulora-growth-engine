import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { 
  Shield, 
  Lock,
  Clock,
  Eye,
  EyeOff,
  FileText,
  Mic,
  Link2,
  Save,
  Info,
  AlertTriangle
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface PrivacySettings {
  // Data Storage
  storeTranscripts: boolean
  storeRecordings: boolean
  storeAnalysis: boolean
  dataRetentionDays: number
  
  // Security
  useSecureUrls: boolean
  urlExpirationHours: number
  requireAuthentication: boolean
  
  // GDPR/Privacy
  anonymizeData: boolean
  enableDataDeletion: boolean
  consentRequired: boolean
  
  // Webhook Settings
  webhookDataLevel: 'minimal' | 'standard' | 'full'
  includeTranscriptsInWebhook: boolean
  includeRecordingsInWebhook: boolean
}

interface AgentPrivacySettingsProps {
  agentId: string
  currentSettings?: Partial<PrivacySettings>
  onSettingsUpdated?: (settings: PrivacySettings) => void
}

export function AgentPrivacySettings({ 
  agentId, 
  currentSettings = {}, 
  onSettingsUpdated 
}: AgentPrivacySettingsProps) {
  const [settings, setSettings] = useState<PrivacySettings>({
    // Default settings
    storeTranscripts: true,
    storeRecordings: true,
    storeAnalysis: true,
    dataRetentionDays: 90,
    useSecureUrls: true,
    urlExpirationHours: 24,
    requireAuthentication: false,
    anonymizeData: false,
    enableDataDeletion: true,
    consentRequired: false,
    webhookDataLevel: 'standard',
    includeTranscriptsInWebhook: true,
    includeRecordingsInWebhook: false,
    ...currentSettings
  })

  const { toast } = useToast()

  const handleSaveSettings = () => {
    onSettingsUpdated?.(settings)
    
    toast({
      title: "Privacy Settings Saved",
      description: "Privacy and storage configuration has been updated."
    })
  }

  const updateSetting = <K extends keyof PrivacySettings>(
    key: K, 
    value: PrivacySettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const getStorageStatus = () => {
    const stored = [
      settings.storeTranscripts && 'Transcripts',
      settings.storeRecordings && 'Recordings', 
      settings.storeAnalysis && 'Analysis'
    ].filter(Boolean)
    
    return stored.length > 0 ? stored.join(', ') : 'No data stored'
  }

  return (
    <div className="space-y-6">
      {/* Data Storage Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Data Storage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              When storage is disabled, data is still sent via webhooks but not stored permanently.
              Links expire based on your security settings.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="storeTranscripts">Store Transcripts</Label>
                <p className="text-sm text-muted-foreground">
                  Save conversation transcripts for review and analysis
                </p>
              </div>
              <Switch
                id="storeTranscripts"
                checked={settings.storeTranscripts}
                onCheckedChange={(checked) => updateSetting('storeTranscripts', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="storeRecordings">Store Recordings</Label>
                <p className="text-sm text-muted-foreground">
                  Save audio recordings of conversations
                </p>
              </div>
              <Switch
                id="storeRecordings"
                checked={settings.storeRecordings}
                onCheckedChange={(checked) => updateSetting('storeRecordings', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="storeAnalysis">Store Analysis Data</Label>
                <p className="text-sm text-muted-foreground">
                  Save post-call analysis and sentiment data
                </p>
              </div>
              <Switch
                id="storeAnalysis"
                checked={settings.storeAnalysis}
                onCheckedChange={(checked) => updateSetting('storeAnalysis', checked)}
              />
            </div>
          </div>

          <Separator />

          <div>
            <Label htmlFor="retention">Data Retention Period</Label>
            <Select 
              value={settings.dataRetentionDays.toString()} 
              onValueChange={(value) => updateSetting('dataRetentionDays', parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
                <SelectItem value="180">180 days</SelectItem>
                <SelectItem value="365">1 year</SelectItem>
                <SelectItem value="0">Forever</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-muted p-3 rounded-lg">
            <div className="text-sm font-medium">Current Storage: {getStorageStatus()}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Data will be automatically deleted after {settings.dataRetentionDays} days
              {settings.dataRetentionDays === 0 && ' (disabled)'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security & Access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="secureUrls">Use Secure URLs</Label>
              <p className="text-sm text-muted-foreground">
                Generate signed URLs with expiration for recordings and logs
              </p>
            </div>
            <Switch
              id="secureUrls"
              checked={settings.useSecureUrls}
              onCheckedChange={(checked) => updateSetting('useSecureUrls', checked)}
            />
          </div>

          {settings.useSecureUrls && (
            <div>
              <Label htmlFor="urlExpiration">URL Expiration</Label>
              <Select 
                value={settings.urlExpirationHours.toString()} 
                onValueChange={(value) => updateSetting('urlExpirationHours', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hour</SelectItem>
                  <SelectItem value="6">6 hours</SelectItem>
                  <SelectItem value="24">24 hours</SelectItem>
                  <SelectItem value="72">3 days</SelectItem>
                  <SelectItem value="168">1 week</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="requireAuth">Require Authentication</Label>
              <p className="text-sm text-muted-foreground">
                Require authentication to access recordings and transcripts
              </p>
            </div>
            <Switch
              id="requireAuth"
              checked={settings.requireAuthentication}
              onCheckedChange={(checked) => updateSetting('requireAuthentication', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Privacy Compliance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Privacy Compliance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="anonymize">Anonymize Data</Label>
              <p className="text-sm text-muted-foreground">
                Remove or mask personally identifiable information (PII)
              </p>
            </div>
            <Switch
              id="anonymize"
              checked={settings.anonymizeData}
              onCheckedChange={(checked) => updateSetting('anonymizeData', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="dataDeletion">Enable Data Deletion</Label>
              <p className="text-sm text-muted-foreground">
                Allow users to request deletion of their data
              </p>
            </div>
            <Switch
              id="dataDeletion"
              checked={settings.enableDataDeletion}
              onCheckedChange={(checked) => updateSetting('enableDataDeletion', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="consent">Consent Required</Label>
              <p className="text-sm text-muted-foreground">
                Require explicit consent before recording conversations
              </p>
            </div>
            <Switch
              id="consent"
              checked={settings.consentRequired}
              onCheckedChange={(checked) => updateSetting('consentRequired', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Webhook Data Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Webhook Data Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="webhookLevel">Webhook Data Level</Label>
            <Select 
              value={settings.webhookDataLevel} 
              onValueChange={(value: 'minimal' | 'standard' | 'full') => updateSetting('webhookDataLevel', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minimal">
                  <div className="flex items-center gap-2">
                    <EyeOff className="h-4 w-4" />
                    Minimal (Call metadata only)
                  </div>
                </SelectItem>
                <SelectItem value="standard">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Standard (Metadata + analysis)
                  </div>
                </SelectItem>
                <SelectItem value="full">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Full (All data including transcripts)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="webhookTranscripts">Include Transcripts in Webhooks</Label>
              <p className="text-sm text-muted-foreground">
                Send full transcripts via webhook (even if not stored)
              </p>
            </div>
            <Switch
              id="webhookTranscripts"
              checked={settings.includeTranscriptsInWebhook}
              onCheckedChange={(checked) => updateSetting('includeTranscriptsInWebhook', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="webhookRecordings">Include Recording Links in Webhooks</Label>
              <p className="text-sm text-muted-foreground">
                Send recording URLs via webhook (with expiration if enabled)
              </p>
            </div>
            <Switch
              id="webhookRecordings"
              checked={settings.includeRecordingsInWebhook}
              onCheckedChange={(checked) => updateSetting('includeRecordingsInWebhook', checked)}
            />
          </div>

          {!settings.storeRecordings && settings.includeRecordingsInWebhook && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Recording links will expire in {settings.urlExpirationHours} hours since storage is disabled.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Summary & Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-medium mb-2">Data Storage</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={settings.storeTranscripts ? "default" : "outline"}>
                    Transcripts: {settings.storeTranscripts ? 'Stored' : 'Not Stored'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={settings.storeRecordings ? "default" : "outline"}>
                    Recordings: {settings.storeRecordings ? 'Stored' : 'Not Stored'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={settings.useSecureUrls ? "default" : "outline"}>
                    <Clock className="h-3 w-3 mr-1" />
                    URLs expire: {settings.urlExpirationHours}h
                  </Badge>
                </div>
              </div>
            </div>
            
            <div>
              <div className="font-medium mb-2">Privacy & Compliance</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={settings.anonymizeData ? "default" : "outline"}>
                    Anonymization: {settings.anonymizeData ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={settings.consentRequired ? "default" : "outline"}>
                    Consent: {settings.consentRequired ? 'Required' : 'Not Required'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    Retention: {settings.dataRetentionDays === 0 ? 'Forever' : `${settings.dataRetentionDays} days`}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} className="gap-2">
              <Save className="h-4 w-4" />
              Save Privacy Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}