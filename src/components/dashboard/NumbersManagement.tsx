import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useRetellNumbers } from "@/hooks/useRetellNumbers"
import { useRetellAgents } from "@/hooks/useRetellAgents"
import { toast } from "sonner"
import { Phone, Plus, Upload, Settings, Trash2 } from "lucide-react"

export function NumbersManagement() {
  const { ownedNumbers, availableNumbers, loading, listNumbers, buyNumber, updateNumber, releaseNumber, importNumber } = useRetellNumbers()
  const { agents } = useRetellAgents()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)

  useEffect(() => {
    listNumbers()
  }, [listNumbers])

  const handleBuyNumber = async (data: { area_code: string; country: string }) => {
    try {
      await buyNumber(data)
      toast.success("Number purchased successfully")
      setIsDialogOpen(false)
      listNumbers()
    } catch (error) {
      toast.error("Failed to purchase number")
    }
  }

  const handleImportNumber = async (data: any) => {
    try {
      await importNumber(data)
      toast.success("Number imported successfully")
      setIsImportDialogOpen(false)
      listNumbers()
    } catch (error) {
      toast.error("Failed to import number")
    }
  }

  const handleUpdateNumber = async (numberId: string, updates: any) => {
    try {
      await updateNumber({ number_id: numberId, ...updates })
      toast.success("Number updated successfully")
      listNumbers()
    } catch (error) {
      toast.error("Failed to update number")
    }
  }

  const handleReleaseNumber = async (numberId: string) => {
    try {
      await releaseNumber(numberId)
      toast.success("Number released successfully")
      listNumbers()
    } catch (error) {
      toast.error("Failed to release number")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Phone Numbers</h2>
          <p className="text-muted-foreground">
            Manage your phone numbers for inbound and outbound calls
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Import BYOC
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Import BYOC Number</DialogTitle>
                <DialogDescription>
                  Import your own carrier number (BYOC - Bring Your Own Carrier)
                </DialogDescription>
              </DialogHeader>
              <ImportNumberForm onSubmit={handleImportNumber} />
            </DialogContent>
          </Dialog>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Buy Number
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Buy Phone Number</DialogTitle>
                <DialogDescription>
                  Purchase a new phone number from our carrier
                </DialogDescription>
              </DialogHeader>
              <BuyNumberForm onSubmit={handleBuyNumber} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="owned" className="space-y-4">
        <TabsList>
          <TabsTrigger value="owned">Owned Numbers ({ownedNumbers.length})</TabsTrigger>
          <TabsTrigger value="available">Available Numbers</TabsTrigger>
        </TabsList>

        <TabsContent value="owned" className="space-y-4">
          {loading ? (
            <div className="text-center py-8">Loading numbers...</div>
          ) : ownedNumbers.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Phone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No numbers owned</h3>
                  <p className="text-muted-foreground mb-4">
                    Buy or import a phone number to get started
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button onClick={() => setIsDialogOpen(true)}>
                      Buy Number
                    </Button>
                    <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
                      Import BYOC
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {ownedNumbers.map((number) => (
                <NumberCard
                  key={number.id}
                  number={number}
                  agents={agents}
                  onUpdate={handleUpdateNumber}
                  onRelease={handleReleaseNumber}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="available" className="space-y-4">
          {availableNumbers.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No available numbers found</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {availableNumbers.map((number) => (
                <Card key={number.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{number.number}</p>
                        <p className="text-sm text-muted-foreground">{number.country}</p>
                      </div>
                      <Badge variant="outline">{number.type}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function BuyNumberForm({ onSubmit }: { onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState({
    area_code: "",
    country: "US"
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="area_code">Area Code</Label>
          <Input
            id="area_code"
            placeholder="e.g., 555"
            value={formData.area_code}
            onChange={(e) => setFormData(prev => ({ ...prev, area_code: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Select
            value={formData.country}
            onValueChange={(value) => setFormData(prev => ({ ...prev, country: value }))}
          >
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
      </div>
      <Button type="submit" className="w-full">
        Purchase Number
      </Button>
    </form>
  )
}

function ImportNumberForm({ onSubmit }: { onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState({
    e164: "",
    country: "US",
    byoc_provider: "",
    sms_enabled: false,
    sip_config: {
      sip_domain: "",
      sip_username: "",
      auth_username: "",
      auth_password: ""
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="e164">Phone Number</Label>
          <Input
            id="e164"
            placeholder="+15551234567"
            value={formData.e164}
            onChange={(e) => setFormData(prev => ({ ...prev, e164: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="provider">BYOC Provider</Label>
          <Input
            id="provider"
            placeholder="e.g., Twilio, Bandwidth"
            value={formData.byoc_provider}
            onChange={(e) => setFormData(prev => ({ ...prev, byoc_provider: e.target.value }))}
          />
        </div>
      </div>
      
      <div className="space-y-4">
        <h4 className="font-medium">SIP Configuration</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sip_domain">SIP Domain</Label>
            <Input
              id="sip_domain"
              placeholder="sip.provider.com"
              value={formData.sip_config.sip_domain}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                sip_config: { ...prev.sip_config, sip_domain: e.target.value }
              }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sip_username">SIP Username</Label>
            <Input
              id="sip_username"
              value={formData.sip_config.sip_username}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                sip_config: { ...prev.sip_config, sip_username: e.target.value }
              }))}
            />
          </div>
        </div>
      </div>
      
      <Button type="submit" className="w-full">
        Import Number
      </Button>
    </form>
  )
}

function NumberCard({ number, agents, onUpdate, onRelease }: any) {
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    inbound_agent_id: number.inbound_agent_id || "",
    outbound_agent_id: number.outbound_agent_id || "",
    sms_enabled: number.sms_enabled || false
  })

  const handleSave = () => {
    onUpdate(number.number_id, editData)
    setIsEditing(false)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{number.e164}</CardTitle>
            <CardDescription>
              {number.country} • {number.is_byoc ? 'BYOC' : 'Retell'} • 
              {number.is_active ? ' Active' : ' Inactive'}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onRelease(number.number_id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {isEditing && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Inbound Agent</Label>
              <Select
                value={editData.inbound_agent_id}
                onValueChange={(value) => setEditData(prev => ({ ...prev, inbound_agent_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {agents.map((agent: any) => (
                    <SelectItem key={agent.id} value={agent.retell_agent_id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Outbound Agent</Label>
              <Select
                value={editData.outbound_agent_id}
                onValueChange={(value) => setEditData(prev => ({ ...prev, outbound_agent_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {agents.map((agent: any) => (
                    <SelectItem key={agent.id} value={agent.retell_agent_id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              Save
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  )
}