import { useEffect, useState } from 'react'
import { Plus, Phone, Settings, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { useRetellNumbers } from '@/hooks/useRetellNumbers'
import { useRetellAgents } from '@/hooks/useRetellAgents'
import { useSMS } from '@/hooks/useSMS'
import { Skeleton } from '@/components/ui/skeleton'

export const NumbersView = () => {
  const {
    loading,
    ownedNumbers,
    availableNumbers,
    listNumbers,
    buyNumber,
    updateNumber,
    releaseNumber,
    importNumber,
  } = useRetellNumbers()
  
  const { agents, loading: agentsLoading, loadAgents } = useRetellAgents()
  const { brands, listBrands } = useSMS()
  
  const [buyDialogOpen, setBuyDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [editingNumber, setEditingNumber] = useState<any>(null)
  
  // Form states
  const [buyForm, setBuyForm] = useState({
    area_code: '',
    country: 'US'
  })
  
  const [importForm, setImportForm] = useState({
    e164: '',
    country: 'US',
    byoc_provider: '',
    sms_enabled: false
  })

  useEffect(() => {
    listNumbers()
    loadAgents()
    listBrands()
  }, [])

  const handleBuyNumber = async () => {
    const result = await buyNumber(buyForm)
    if (result) {
      setBuyDialogOpen(false)
      setBuyForm({ area_code: '', country: 'US' })
    }
  }

  const handleImportNumber = async () => {
    const result = await importNumber(importForm)
    if (result) {
      setImportDialogOpen(false)
      setImportForm({ e164: '', country: 'US', byoc_provider: '', sms_enabled: false })
    }
  }

  const handleUpdateNumber = async (numberId: string, updates: any) => {
    await updateNumber({ number_id: numberId, ...updates })
    setEditingNumber(null)
  }

  const handleReleaseNumber = async (numberId: string) => {
    if (confirm('Are you sure you want to release this number? This action cannot be undone.')) {
      await releaseNumber(numberId)
    }
  }

  if (loading && ownedNumbers.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Numbers</h2>
            <p className="text-muted-foreground">Manage your phone numbers and routing</p>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Numbers</h2>
          <p className="text-muted-foreground">Manage your phone numbers and routing</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Import BYOC
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import BYOC Number</DialogTitle>
                <DialogDescription>
                  Import a Bring Your Own Carrier (BYOC) number from your SIP provider
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="e164">Phone Number (E.164 format)</Label>
                  <Input
                    id="e164"
                    placeholder="+15551234567"
                    value={importForm.e164}
                    onChange={(e) => setImportForm({ ...importForm, e164: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="byoc_provider">BYOC Provider</Label>
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
                <Button 
                  onClick={handleImportNumber} 
                  disabled={!importForm.e164 || !importForm.byoc_provider || loading}
                  className="w-full"
                >
                  Import Number
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={buyDialogOpen} onOpenChange={setBuyDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Buy Number
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Buy Phone Number</DialogTitle>
                <DialogDescription>
                  Purchase a new phone number from Retell
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="area_code">Area Code (Optional)</Label>
                  <Input
                    id="area_code"
                    placeholder="555"
                    value={buyForm.area_code}
                    onChange={(e) => setBuyForm({ ...buyForm, area_code: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Select value={buyForm.country} onValueChange={(value) => setBuyForm({ ...buyForm, country: value })}>
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
                <Button onClick={handleBuyNumber} disabled={loading} className="w-full">
                  Purchase Number
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {ownedNumbers.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No phone numbers</h3>
            <p className="text-muted-foreground mb-4">
              Get started by purchasing a phone number or importing your own BYOC number
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => setBuyDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Buy Number
              </Button>
              <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Import BYOC
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ownedNumbers.map((number) => (
            <Card key={number.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{number.e164}</CardTitle>
                    <CardDescription>{number.country}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {number.is_byoc && (
                      <Badge variant="secondary">BYOC</Badge>
                    )}
                    {number.sms_enabled && (
                      <Badge variant="outline">SMS</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div>
                    <Label className="text-sm text-muted-foreground">Inbound Agent</Label>
                    <Select
                      value={number.inbound_agent_id || ""}
                      onValueChange={(value) => handleUpdateNumber(number.number_id, { 
                        inbound_agent_id: value || null 
                      })}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Select agent" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {agents.map((agent) => (
                          <SelectItem key={agent.agent_id} value={agent.agent_id}>
                            {agent.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-sm text-muted-foreground">Outbound Agent</Label>
                    <Select
                      value={number.outbound_agent_id || ""}
                      onValueChange={(value) => handleUpdateNumber(number.number_id, { 
                        outbound_agent_id: value || null 
                      })}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Select agent" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {agents.map((agent) => (
                          <SelectItem key={agent.agent_id} value={agent.agent_id}>
                            {agent.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id={`sms-${number.id}`}
                      checked={number.sms_enabled}
                      onCheckedChange={(checked) => handleUpdateNumber(number.number_id, { 
                        sms_enabled: checked 
                      })}
                      disabled={!number.sms_enabled && !brands?.some(b => b.registration_status === 'approved')}
                    />
                    <Label htmlFor={`sms-${number.id}`} className="text-sm">
                      SMS
                    </Label>
                    {!number.sms_enabled && !brands?.some(b => b.registration_status === 'approved') && (
                      <Badge variant="outline" className="text-xs">
                        Requires approved SMS brand
                      </Badge>
                    )}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleReleaseNumber(number.number_id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                
                {number.is_byoc && number.byoc_provider && (
                  <div className="text-xs text-muted-foreground">
                    Provider: {number.byoc_provider}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}