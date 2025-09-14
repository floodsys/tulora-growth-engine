import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Info, ExternalLink } from 'lucide-react'

interface BYOCImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (data: any) => Promise<boolean>
  loading: boolean
}

export const BYOCImportDialog = ({ open, onOpenChange, onImport, loading }: BYOCImportDialogProps) => {
  const [activeTab, setActiveTab] = useState('basic')
  const [importForm, setImportForm] = useState({
    e164: '',
    country: 'US',
    byoc_provider: '',
    sms_enabled: false,
    sip_config: {
      sip_domain: '',
      sip_username: '',
      auth_username: '',
      auth_password: '',
      trunk_name: '',
      caller_id_name: '',
      caller_id_number: '',
      codec_preferences: ['PCMU', 'PCMA', 'G729'],
      dtmf_mode: 'rfc2833' as 'rfc2833' | 'inband' | 'info',
      registration_required: true,
      outbound_proxy: '',
      custom_headers: {}
    },
    network_config: {
      ip_whitelist: [] as string[],
      port_range: '5060-5070',
      protocol: 'udp' as 'udp' | 'tcp' | 'tls',
      nat_traversal: true
    }
  })
  const [ipInput, setIpInput] = useState('')

  const handleImport = async () => {
    const result = await onImport(importForm)
    if (result) {
      onOpenChange(false)
      setImportForm({
        e164: '',
        country: 'US',
        byoc_provider: '',
        sms_enabled: false,
        sip_config: {
          sip_domain: '',
          sip_username: '',
          auth_username: '',
          auth_password: '',
          trunk_name: '',
          caller_id_name: '',
          caller_id_number: '',
          codec_preferences: ['PCMU', 'PCMA', 'G729'],
          dtmf_mode: 'rfc2833' as 'rfc2833' | 'inband' | 'info',
          registration_required: true,
          outbound_proxy: '',
          custom_headers: {}
        },
        network_config: {
          ip_whitelist: [],
          port_range: '5060-5070',
          protocol: 'udp' as 'udp' | 'tcp' | 'tls',
          nat_traversal: true
        }
      })
      setIpInput('')
    }
  }

  const addIpAddress = () => {
    if (ipInput.trim() && !importForm.network_config.ip_whitelist.includes(ipInput.trim())) {
      setImportForm({
        ...importForm,
        network_config: {
          ...importForm.network_config,
          ip_whitelist: [...importForm.network_config.ip_whitelist, ipInput.trim()]
        }
      })
      setIpInput('')
    }
  }

  const removeIpAddress = (ip: string) => {
    setImportForm({
      ...importForm,
      network_config: {
        ...importForm.network_config,
        ip_whitelist: importForm.network_config.ip_whitelist.filter(addr => addr !== ip)
      }
    })
  }

  const isFormValid = importForm.e164 && importForm.byoc_provider && importForm.sip_config.sip_domain

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Enterprise BYOC Number</DialogTitle>
          <DialogDescription>
            Configure your Bring Your Own Carrier number with SIP and network settings
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="sip">SIP Configuration</TabsTrigger>
            <TabsTrigger value="network">Network & Security</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="e164">Phone Number (E.164 format) *</Label>
                <Input
                  id="e164"
                  placeholder="+15551234567"
                  value={importForm.e164}
                  onChange={(e) => setImportForm({ ...importForm, e164: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="byoc_provider">BYOC Provider *</Label>
                <Input
                  id="byoc_provider"
                  placeholder="Twilio, Vonage, etc."
                  value={importForm.byoc_provider}
                  onChange={(e) => setImportForm({ ...importForm, byoc_provider: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Select value={importForm.country} onValueChange={(value) => setImportForm({ ...importForm, country: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">United States</SelectItem>
                    <SelectItem value="CA">Canada</SelectItem>
                    <SelectItem value="GB">United Kingdom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="sms_enabled"
                  checked={importForm.sms_enabled}
                  onCheckedChange={(checked) => setImportForm({ ...importForm, sms_enabled: checked })}
                />
                <Label htmlFor="sms_enabled">SMS Enabled</Label>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="sip" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="sip_domain">SIP Domain *</Label>
                <Input
                  id="sip_domain"
                  placeholder="sip.yourprovider.com"
                  value={importForm.sip_config.sip_domain}
                  onChange={(e) => setImportForm({
                    ...importForm,
                    sip_config: { ...importForm.sip_config, sip_domain: e.target.value }
                  })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sip_username">SIP Username</Label>
                  <Input
                    id="sip_username"
                    placeholder="username"
                    value={importForm.sip_config.sip_username}
                    onChange={(e) => setImportForm({
                      ...importForm,
                      sip_config: { ...importForm.sip_config, sip_username: e.target.value }
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="auth_username">Auth Username</Label>
                  <Input
                    id="auth_username"
                    placeholder="auth_user"
                    value={importForm.sip_config.auth_username}
                    onChange={(e) => setImportForm({
                      ...importForm,
                      sip_config: { ...importForm.sip_config, auth_username: e.target.value }
                    })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="auth_password">Auth Password</Label>
                <Input
                  id="auth_password"
                  type="password"
                  placeholder="password"
                  value={importForm.sip_config.auth_password}
                  onChange={(e) => setImportForm({
                    ...importForm,
                    sip_config: { ...importForm.sip_config, auth_password: e.target.value }
                  })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="caller_id_name">Caller ID Name</Label>
                  <Input
                    id="caller_id_name"
                    placeholder="Company Name"
                    value={importForm.sip_config.caller_id_name}
                    onChange={(e) => setImportForm({
                      ...importForm,
                      sip_config: { ...importForm.sip_config, caller_id_name: e.target.value }
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="caller_id_number">Caller ID Number</Label>
                  <Input
                    id="caller_id_number"
                    placeholder="+15551234567"
                    value={importForm.sip_config.caller_id_number}
                    onChange={(e) => setImportForm({
                      ...importForm,
                      sip_config: { ...importForm.sip_config, caller_id_number: e.target.value }
                    })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dtmf_mode">DTMF Mode</Label>
                  <Select 
                    value={importForm.sip_config.dtmf_mode} 
                    onValueChange={(value: 'rfc2833' | 'inband' | 'info') => 
                      setImportForm({
                        ...importForm,
                        sip_config: { ...importForm.sip_config, dtmf_mode: value }
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rfc2833">RFC 2833</SelectItem>
                      <SelectItem value="inband">In-band</SelectItem>
                      <SelectItem value="info">SIP INFO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="outbound_proxy">Outbound Proxy</Label>
                  <Input
                    id="outbound_proxy"
                    placeholder="proxy.provider.com:5060"
                    value={importForm.sip_config.outbound_proxy}
                    onChange={(e) => setImportForm({
                      ...importForm,
                      sip_config: { ...importForm.sip_config, outbound_proxy: e.target.value }
                    })}
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="registration_required"
                  checked={importForm.sip_config.registration_required}
                  onCheckedChange={(checked) => setImportForm({
                    ...importForm,
                    sip_config: { ...importForm.sip_config, registration_required: checked }
                  })}
                />
                <Label htmlFor="registration_required">Registration Required</Label>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="network" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="protocol">Protocol</Label>
                <Select 
                  value={importForm.network_config.protocol} 
                  onValueChange={(value: 'udp' | 'tcp' | 'tls') => 
                    setImportForm({
                      ...importForm,
                      network_config: { ...importForm.network_config, protocol: value }
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="udp">UDP</SelectItem>
                    <SelectItem value="tcp">TCP</SelectItem>
                    <SelectItem value="tls">TLS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="port_range">Port Range</Label>
                <Input
                  id="port_range"
                  placeholder="5060-5070"
                  value={importForm.network_config.port_range}
                  onChange={(e) => setImportForm({
                    ...importForm,
                    network_config: { ...importForm.network_config, port_range: e.target.value }
                  })}
                />
              </div>
              <div>
                <Label>IP Whitelist</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    placeholder="192.168.1.1 or 10.0.0.0/24"
                    value={ipInput}
                    onChange={(e) => setIpInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addIpAddress()}
                  />
                  <Button type="button" onClick={addIpAddress} variant="outline">Add</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {importForm.network_config.ip_whitelist.map((ip) => (
                    <Badge key={ip} variant="secondary" className="cursor-pointer" onClick={() => removeIpAddress(ip)}>
                      {ip} ×
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="nat_traversal"
                  checked={importForm.network_config.nat_traversal}
                  onCheckedChange={(checked) => setImportForm({
                    ...importForm,
                    network_config: { ...importForm.network_config, nat_traversal: checked }
                  })}
                />
                <Label htmlFor="nat_traversal">NAT Traversal (STUN/TURN)</Label>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={!isFormValid || loading}
          >
            {loading ? 'Importing...' : 'Import Number'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}