import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Shield, Phone, MessageSquare, Clock, Ban } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function AbusePreventionSettings() {
  const { toast } = useToast()
  const [settings, setSettings] = useState({
    recaptchaEnabled: true,
    recaptchaSiteKey: "6LdyC2cqAAAAAHh8yt_H8R5A5b7TfZZ_7xnwHKFD",
    recaptchaSecretKey: "6LdyC2cqAAAAAFz4o8b7TfZZ_7xnwHKFD_H8yt_H",
    rateLimit: {
      enabled: true,
      callsPerMinute: 5,
      callsPerHour: 50,
      callsPerDay: 200
    },
    callPatternDetection: {
      enabled: true,
      maxSequentialCallFailures: 3,
      suspiciousCallDurationThreshold: 30,
      rapidDialingThreshold: 10
    },
    ipBlocking: {
      enabled: true,
      blockedCountries: ["CN", "RU", "VN"],
      allowedCountries: [],
      vpnDetection: true
    },
    contentFiltering: {
      enabled: true,
      spamKeywords: ["viagra", "casino", "crypto", "investment"],
      profanityFilter: true,
      urlBlocking: true
    }
  })

  const saveSettings = () => {
    toast({
      title: "Settings saved",
      description: "Abuse prevention settings have been updated successfully",
    })
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Abuse Prevention</h1>
        <p className="text-muted-foreground">Configure security measures to prevent spam and abuse</p>
      </div>

      <div className="grid gap-6">
        {/* CAPTCHA Protection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              CAPTCHA Protection
            </CardTitle>
            <CardDescription>
              Prevent automated attacks and bot traffic
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center space-x-2">
              <Switch
                id="recaptchaEnabled"
                checked={settings.recaptchaEnabled}
                onCheckedChange={(checked) => setSettings(prev => ({ 
                  ...prev, 
                  recaptchaEnabled: checked 
                }))}
              />
              <Label htmlFor="recaptchaEnabled">Enable reCAPTCHA v3</Label>
              <Badge variant={settings.recaptchaEnabled ? "default" : "secondary"}>
                {settings.recaptchaEnabled ? "Active" : "Disabled"}
              </Badge>
            </div>

            {settings.recaptchaEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                <div className="space-y-2">
                  <Label htmlFor="recaptchaSiteKey">Site Key (Public)</Label>
                  <Input
                    id="recaptchaSiteKey"
                    value={settings.recaptchaSiteKey}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      recaptchaSiteKey: e.target.value 
                    }))}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recaptchaSecretKey">Secret Key</Label>
                  <Input
                    id="recaptchaSecretKey"
                    type="password"
                    value={settings.recaptchaSecretKey}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      recaptchaSecretKey: e.target.value 
                    }))}
                    className="font-mono"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rate Limiting */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Rate Limiting
            </CardTitle>
            <CardDescription>
              Limit the number of calls and actions per time period
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center space-x-2">
              <Switch
                id="rateLimitEnabled"
                checked={settings.rateLimit.enabled}
                onCheckedChange={(checked) => setSettings(prev => ({ 
                  ...prev, 
                  rateLimit: { ...prev.rateLimit, enabled: checked }
                }))}
              />
              <Label htmlFor="rateLimitEnabled">Enable rate limiting</Label>
            </div>

            {settings.rateLimit.enabled && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-6">
                <div className="space-y-2">
                  <Label htmlFor="callsPerMinute">Calls per minute</Label>
                  <Input
                    id="callsPerMinute"
                    type="number"
                    value={settings.rateLimit.callsPerMinute}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      rateLimit: { ...prev.rateLimit, callsPerMinute: parseInt(e.target.value) }
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="callsPerHour">Calls per hour</Label>
                  <Input
                    id="callsPerHour"
                    type="number"
                    value={settings.rateLimit.callsPerHour}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      rateLimit: { ...prev.rateLimit, callsPerHour: parseInt(e.target.value) }
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="callsPerDay">Calls per day</Label>
                  <Input
                    id="callsPerDay"
                    type="number"
                    value={settings.rateLimit.callsPerDay}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      rateLimit: { ...prev.rateLimit, callsPerDay: parseInt(e.target.value) }
                    }))}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Call Pattern Detection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Call Pattern Detection
            </CardTitle>
            <CardDescription>
              Detect and prevent suspicious calling patterns
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center space-x-2">
              <Switch
                id="callPatternEnabled"
                checked={settings.callPatternDetection.enabled}
                onCheckedChange={(checked) => setSettings(prev => ({ 
                  ...prev, 
                  callPatternDetection: { ...prev.callPatternDetection, enabled: checked }
                }))}
              />
              <Label htmlFor="callPatternEnabled">Enable call pattern detection</Label>
            </div>

            {settings.callPatternDetection.enabled && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-6">
                <div className="space-y-2">
                  <Label htmlFor="maxFailures">Max sequential failures</Label>
                  <Input
                    id="maxFailures"
                    type="number"
                    value={settings.callPatternDetection.maxSequentialCallFailures}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      callPatternDetection: { 
                        ...prev.callPatternDetection, 
                        maxSequentialCallFailures: parseInt(e.target.value) 
                      }
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="durationThreshold">Suspicious duration (seconds)</Label>
                  <Input
                    id="durationThreshold"
                    type="number"
                    value={settings.callPatternDetection.suspiciousCallDurationThreshold}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      callPatternDetection: { 
                        ...prev.callPatternDetection, 
                        suspiciousCallDurationThreshold: parseInt(e.target.value) 
                      }
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rapidDialing">Rapid dialing threshold</Label>
                  <Input
                    id="rapidDialing"
                    type="number"
                    value={settings.callPatternDetection.rapidDialingThreshold}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      callPatternDetection: { 
                        ...prev.callPatternDetection, 
                        rapidDialingThreshold: parseInt(e.target.value) 
                      }
                    }))}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* IP & Geographic Blocking */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5" />
              IP & Geographic Blocking
            </CardTitle>
            <CardDescription>
              Block traffic from specific countries or IP ranges
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center space-x-2">
              <Switch
                id="ipBlockingEnabled"
                checked={settings.ipBlocking.enabled}
                onCheckedChange={(checked) => setSettings(prev => ({ 
                  ...prev, 
                  ipBlocking: { ...prev.ipBlocking, enabled: checked }
                }))}
              />
              <Label htmlFor="ipBlockingEnabled">Enable IP and geographic blocking</Label>
            </div>

            {settings.ipBlocking.enabled && (
              <div className="space-y-4 pl-6">
                <div className="space-y-2">
                  <Label>Blocked Countries</Label>
                  <div className="flex flex-wrap gap-2">
                    {settings.ipBlocking.blockedCountries.map((country) => (
                      <Badge key={country} variant="destructive" className="flex items-center gap-1">
                        {country}
                        <button 
                          onClick={() => setSettings(prev => ({
                            ...prev,
                            ipBlocking: {
                              ...prev.ipBlocking,
                              blockedCountries: prev.ipBlocking.blockedCountries.filter(c => c !== country)
                            }
                          }))}
                          className="ml-1 hover:bg-red-700 rounded-full p-0.5"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="vpnDetection"
                    checked={settings.ipBlocking.vpnDetection}
                    onCheckedChange={(checked) => setSettings(prev => ({ 
                      ...prev, 
                      ipBlocking: { ...prev.ipBlocking, vpnDetection: checked }
                    }))}
                  />
                  <Label htmlFor="vpnDetection">Block known VPN/proxy IPs</Label>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Content Filtering */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Content Filtering
            </CardTitle>
            <CardDescription>
              Filter spam keywords and malicious content
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center space-x-2">
              <Switch
                id="contentFilteringEnabled"
                checked={settings.contentFiltering.enabled}
                onCheckedChange={(checked) => setSettings(prev => ({ 
                  ...prev, 
                  contentFiltering: { ...prev.contentFiltering, enabled: checked }
                }))}
              />
              <Label htmlFor="contentFilteringEnabled">Enable content filtering</Label>
            </div>

            {settings.contentFiltering.enabled && (
              <div className="space-y-4 pl-6">
                <div className="space-y-2">
                  <Label>Spam Keywords</Label>
                  <div className="flex flex-wrap gap-2">
                    {settings.contentFiltering.spamKeywords.map((keyword) => (
                      <Badge key={keyword} variant="outline" className="flex items-center gap-1">
                        {keyword}
                        <button 
                          onClick={() => setSettings(prev => ({
                            ...prev,
                            contentFiltering: {
                              ...prev.contentFiltering,
                              spamKeywords: prev.contentFiltering.spamKeywords.filter(k => k !== keyword)
                            }
                          }))}
                          className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="profanityFilter"
                      checked={settings.contentFiltering.profanityFilter}
                      onCheckedChange={(checked) => setSettings(prev => ({ 
                        ...prev, 
                        contentFiltering: { ...prev.contentFiltering, profanityFilter: checked }
                      }))}
                    />
                    <Label htmlFor="profanityFilter">Profanity filter</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="urlBlocking"
                      checked={settings.contentFiltering.urlBlocking}
                      onCheckedChange={(checked) => setSettings(prev => ({ 
                        ...prev, 
                        contentFiltering: { ...prev.contentFiltering, urlBlocking: checked }
                      }))}
                    />
                    <Label htmlFor="urlBlocking">Block suspicious URLs</Label>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security Alert */}
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-orange-900">Security Recommendations</h4>
                <p className="text-sm text-orange-800 mt-1">
                  These settings help protect your service from abuse, but legitimate users might occasionally be affected. 
                  Monitor your logs and adjust thresholds as needed. Consider implementing a whitelist for known good users.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={saveSettings} className="px-8">
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  )
}