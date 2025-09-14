import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Shield, Plus, Trash2, Globe, Lock } from 'lucide-react'
import { useUserOrganization } from '@/hooks/useUserOrganization'
import { useToast } from '@/hooks/use-toast'

export const SecuritySettings = () => {
  const { organization } = useUserOrganization()
  const { toast } = useToast()

  const [dataStorageOptOut, setDataStorageOptOut] = useState(false)
  const [secureUrls, setSecureUrls] = useState(true)
  const [allowedDomains, setAllowedDomains] = useState<string[]>(['example.com'])
  const [newDomain, setNewDomain] = useState('')
  const [addDomainOpen, setAddDomainOpen] = useState(false)
  const [recaptchaEnabled, setRecaptchaEnabled] = useState(false)
  const [recaptchaSiteKey, setRecaptchaSiteKey] = useState('')

  const handleAddDomain = () => {
    if (newDomain.trim() && !allowedDomains.includes(newDomain.trim())) {
      setAllowedDomains([...allowedDomains, newDomain.trim()])
      setNewDomain('')
      setAddDomainOpen(false)
      toast({
        title: "Domain added",
        description: "Domain has been added to the allowed list.",
      })
    }
  }

  const handleRemoveDomain = (domain: string) => {
    setAllowedDomains(allowedDomains.filter(d => d !== domain))
    toast({
      title: "Domain removed",
      description: "Domain has been removed from the allowed list.",
    })
  }

  const handleSaveSettings = () => {
    // TODO: Save settings to backend
    toast({
      title: "Settings saved",
      description: "Security settings have been updated successfully.",
    })
  }

  return (
    <div className="space-y-6">
      {/* Data Storage Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Data Storage & Privacy
          </CardTitle>
          <CardDescription>
            Configure how your data is stored and processed by Retell AI.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base">Data Storage Opt-out</Label>
              <p className="text-sm text-muted-foreground">
                Prevent Retell from storing call recordings and transcripts
              </p>
            </div>
            <Switch
              checked={dataStorageOptOut}
              onCheckedChange={setDataStorageOptOut}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base">Secure URLs</Label>
              <p className="text-sm text-muted-foreground">
                Use expiring URLs for recordings and sensitive data
              </p>
            </div>
            <Switch
              checked={secureUrls}
              onCheckedChange={setSecureUrls}
            />
          </div>

          {dataStorageOptOut && (
            <div className="bg-yellow-50 p-4 rounded-md">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> Opting out of data storage may limit some features like call analytics and conversation history.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Domain Restrictions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Domain Restrictions
          </CardTitle>
          <CardDescription>
            Control which domains can embed your chat widget and make web calls.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Allowed Domains</Label>
            <Dialog open={addDomainOpen} onOpenChange={setAddDomainOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Domain
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Allowed Domain</DialogTitle>
                  <DialogDescription>
                    Enter a domain that will be allowed to use your widgets and make web calls.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="domain">Domain</Label>
                    <Input
                      id="domain"
                      placeholder="example.com"
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleAddDomain} disabled={!newDomain.trim()}>
                    Add Domain
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allowedDomains.map((domain) => (
                <TableRow key={domain}>
                  <TableCell className="font-mono">{domain}</TableCell>
                  <TableCell>
                    <Badge variant="default">Active</Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveDomain(domain)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* reCAPTCHA Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            reCAPTCHA Protection
          </CardTitle>
          <CardDescription>
            Enable reCAPTCHA to protect your widgets from abuse and spam.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base">Enable reCAPTCHA</Label>
              <p className="text-sm text-muted-foreground">
                Require reCAPTCHA verification for widget interactions
              </p>
            </div>
            <Switch
              checked={recaptchaEnabled}
              onCheckedChange={setRecaptchaEnabled}
            />
          </div>

          {recaptchaEnabled && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recaptcha-key">reCAPTCHA Site Key</Label>
                <Input
                  id="recaptcha-key"
                  placeholder="6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"
                  value={recaptchaSiteKey}
                  onChange={(e) => setRecaptchaSiteKey(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Get your site key from the{' '}
                  <a
                    href="https://www.google.com/recaptcha/admin"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Google reCAPTCHA console
                  </a>
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSaveSettings} className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Save Security Settings
        </Button>
      </div>
    </div>
  )
}