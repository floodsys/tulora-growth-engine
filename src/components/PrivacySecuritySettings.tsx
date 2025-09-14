import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Shield, Lock, Globe, Clock, AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface PrivacySecuritySettingsProps {
  agent: {
    id: string
    data_storage_setting: string
    opt_in_signed_url: boolean
    webhook_url?: string
  }
  onUpdate: (updates: any) => void
}

export function PrivacySecuritySettings({ agent, onUpdate }: PrivacySecuritySettingsProps) {
  const [settings, setSettings] = useState({
    data_storage_setting: agent.data_storage_setting,
    opt_in_signed_url: agent.opt_in_signed_url,
    webhook_url: agent.webhook_url || '',
    allowed_domains: '',
    require_recaptcha: false,
    data_retention_days: 90,
    encryption_enabled: true,
  })
  const { toast } = useToast()

  const handleSettingChange = (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    onUpdate({ [key]: value })
  }

  const getDataStorageDescription = (setting: string) => {
    switch (setting) {
      case 'standard':
        return 'Standard retention with Retell hosting'
      case 'reduced':
        return 'Reduced data collection and shorter retention'
      case 'minimal':
        return 'Minimal data collection, immediate deletion'
      default:
        return 'Standard retention policy'
    }
  }

  const getSecurityLevel = () => {
    let score = 0
    if (settings.data_storage_setting === 'minimal') score += 3
    else if (settings.data_storage_setting === 'reduced') score += 2
    else score += 1
    
    if (settings.opt_in_signed_url) score += 2
    if (settings.require_recaptcha) score += 1
    if (settings.encryption_enabled) score += 2
    if (settings.allowed_domains) score += 1

    if (score >= 7) return { level: 'High', color: 'text-green-600' }
    if (score >= 5) return { level: 'Medium', color: 'text-yellow-600' }
    return { level: 'Basic', color: 'text-red-600' }
  }

  const securityLevel = getSecurityLevel()

  return (
    <div className="space-y-6">
      {/* Security Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Level
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">
                <span className={securityLevel.color}>{securityLevel.level}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Current privacy and security configuration
              </p>
            </div>
            <Badge variant={securityLevel.level === 'High' ? 'default' : 'secondary'}>
              <Shield className="h-3 w-3 mr-1" />
              {securityLevel.level}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Data Storage Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Data Storage & Privacy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="data_storage_setting">Data Storage Setting</Label>
            <Select
              value={settings.data_storage_setting}
              onValueChange={(value) => handleSettingChange('data_storage_setting', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">
                  <div>
                    <div className="font-medium">Standard</div>
                    <div className="text-sm text-muted-foreground">Full logging and retention</div>
                  </div>
                </SelectItem>
                <SelectItem value="reduced">
                  <div>
                    <div className="font-medium">Reduced</div>
                    <div className="text-sm text-muted-foreground">Limited data collection</div>
                  </div>
                </SelectItem>
                <SelectItem value="minimal">
                  <div>
                    <div className="font-medium">Minimal</div>
                    <div className="text-sm text-muted-foreground">Minimum data, immediate deletion</div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {getDataStorageDescription(settings.data_storage_setting)}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="signed_urls">Secure URLs</Label>
              <p className="text-sm text-muted-foreground">
                Use expiring signed URLs for recordings and transcripts
              </p>
            </div>
            <Switch
              id="signed_urls"
              checked={settings.opt_in_signed_url}
              onCheckedChange={(checked) => handleSettingChange('opt_in_signed_url', checked)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="retention_days">Data Retention (Days)</Label>
            <Select
              value={settings.data_retention_days.toString()}
              onValueChange={(value) => handleSettingChange('data_retention_days', parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
                <SelectItem value="365">1 year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Access Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Access Control
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="allowed_domains">Allowed Domains</Label>
            <Input
              id="allowed_domains"
              placeholder="example.com, app.example.com"
              value={settings.allowed_domains}
              onChange={(e) => handleSettingChange('allowed_domains', e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Comma-separated list of domains allowed to embed this agent
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="recaptcha">Require reCAPTCHA</Label>
              <p className="text-sm text-muted-foreground">
                Enable reCAPTCHA verification for widget access
              </p>
            </div>
            <Switch
              id="recaptcha"
              checked={settings.require_recaptcha}
              onCheckedChange={(checked) => handleSettingChange('require_recaptcha', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Security Recommendations */}
      {securityLevel.level !== 'High' && (
        <Card className="border-warning">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" />
              Security Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {settings.data_storage_setting === 'standard' && (
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-warning"></div>
                  Consider using "Reduced" or "Minimal" data storage for enhanced privacy
                </li>
              )}
              {!settings.opt_in_signed_url && (
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-warning"></div>
                  Enable secure URLs for better data protection
                </li>
              )}
              {!settings.allowed_domains && (
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-warning"></div>
                  Specify allowed domains to restrict widget usage
                </li>
              )}
              {!settings.require_recaptcha && (
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-warning"></div>
                  Enable reCAPTCHA to prevent automated abuse
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}