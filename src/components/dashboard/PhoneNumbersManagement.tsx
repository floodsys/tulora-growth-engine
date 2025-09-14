import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Phone, Plus, Upload, ArrowUpDown, Settings, Trash2 } from 'lucide-react'
import { useRetellNumbers } from '@/hooks/useRetellNumbers'
import { useRetellAgents } from '@/hooks/useRetellAgents'
import { useUserOrganization } from '@/hooks/useUserOrganization'
import { useToast } from '@/hooks/use-toast'

export const PhoneNumbersManagement = () => {
  const { organization } = useUserOrganization()
  const { numbers, loading, purchaseNumber, importNumber, updateNumber, deleteNumber } = useRetellNumbers(organization?.id)
  const { agents } = useRetellAgents(organization?.id)
  const { toast } = useToast()

  const [buyDialogOpen, setBuyDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [selectedCountry, setSelectedCountry] = useState('US')
  const [selectedAreaCode, setSelectedAreaCode] = useState('')
  const [importE164, setImportE164] = useState('')
  const [importProvider, setImportProvider] = useState('')
  const [purchasing, setPurchasing] = useState(false)
  const [importing, setImporting] = useState(false)

  const handlePurchaseNumber = async () => {
    setPurchasing(true)
    try {
      await purchaseNumber({
        country: selectedCountry,
        area_code: selectedAreaCode
      })
      setBuyDialogOpen(false)
      setSelectedAreaCode('')
      toast({
        title: "Number purchased",
        description: "Phone number has been purchased successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to purchase phone number.",
        variant: "destructive"
      })
    } finally {
      setPurchasing(false)
    }
  }

  const handleImportNumber = async () => {
    setImporting(true)
    try {
      await importNumber({
        e164: importE164,
        provider: importProvider
      })
      setImportDialogOpen(false)
      setImportE164('')
      setImportProvider('')
      toast({
        title: "Number imported",
        description: "Phone number has been imported successfully.",
      })
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to import phone number.",
        variant: "destructive"
      })
    } finally {
      setImporting(false)
    }
  }

  const handleAgentBinding = async (numberId: string, agentId: string, type: 'inbound' | 'outbound') => {
    try {
      const updates = type === 'inbound' 
        ? { inbound_agent_id: agentId }
        : { outbound_agent_id: agentId }
      
      await updateNumber(numberId, updates)
      toast({
        title: "Agent bound",
        description: `Agent has been bound to ${type} calls.`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to bind agent to number.",
        variant: "destructive"
      })
    }
  }

  const getStatusBadge = (number: any) => {
    if (!number.is_active) return <Badge variant="secondary">Inactive</Badge>
    if (number.is_byoc) return <Badge variant="outline">BYOC</Badge>
    return <Badge variant="default">Active</Badge>
  }

  const getAgentName = (agentId: string) => {
    const agent = agents?.find(a => a.agent_id === agentId)
    return agent?.name || 'Unassigned'
  }

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex gap-4">
        <Dialog open={buyDialogOpen} onOpenChange={setBuyDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Buy Number
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Purchase Phone Number</DialogTitle>
              <DialogDescription>
                Buy a new phone number from Retell's inventory.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Select value={selectedCountry} onValueChange={setSelectedCountry}>
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
              <div className="space-y-2">
                <Label htmlFor="area-code">Area Code (Optional)</Label>
                <Input
                  id="area-code"
                  placeholder="e.g., 415"
                  value={selectedAreaCode}
                  onChange={(e) => setSelectedAreaCode(e.target.value)}
                />
              </div>
              <Button 
                onClick={handlePurchaseNumber} 
                disabled={purchasing}
                className="w-full"
              >
                {purchasing ? 'Purchasing...' : 'Purchase Number'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Import BYOC
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import BYOC Number</DialogTitle>
              <DialogDescription>
                Import your own phone number (Bring Your Own Carrier).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="e164">Phone Number (E.164 format)</Label>
                <Input
                  id="e164"
                  placeholder="+1234567890"
                  value={importE164}
                  onChange={(e) => setImportE164(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <Select value={importProvider} onValueChange={setImportProvider}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="twilio">Twilio</SelectItem>
                    <SelectItem value="vonage">Vonage</SelectItem>
                    <SelectItem value="signalwire">SignalWire</SelectItem>
                    <SelectItem value="telnyx">Telnyx</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={handleImportNumber} 
                disabled={importing || !importE164 || !importProvider}
                className="w-full"
              >
                {importing ? 'Importing...' : 'Import Number'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Numbers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Phone Numbers
          </CardTitle>
          <CardDescription>
            Manage your phone numbers and bind them to agents for inbound/outbound calls.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading numbers...</div>
            </div>
          ) : numbers?.length === 0 ? (
            <div className="text-center py-8">
              <Phone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No phone numbers</h3>
              <p className="text-muted-foreground mb-4">
                Buy or import your first phone number to get started.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Inbound Agent</TableHead>
                  <TableHead>Outbound Agent</TableHead>
                  <TableHead>SMS</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {numbers?.map((number) => (
                  <TableRow key={number.id}>
                    <TableCell className="font-mono">{number.e164}</TableCell>
                    <TableCell>{number.country}</TableCell>
                    <TableCell>{getStatusBadge(number)}</TableCell>
                    <TableCell>
                      <Select
                        value={number.inbound_agent_id || 'unassigned'}
                        onValueChange={(value) => handleAgentBinding(number.id, value, 'inbound')}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {agents?.map((agent) => (
                            <SelectItem key={agent.id} value={agent.agent_id}>
                              {agent.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={number.outbound_agent_id || 'unassigned'}
                        onValueChange={(value) => handleAgentBinding(number.id, value, 'outbound')}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {agents?.map((agent) => (
                            <SelectItem key={agent.id} value={agent.agent_id}>
                              {agent.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {number.sms_enabled ? (
                        <Badge variant="default">Enabled</Badge>
                      ) : (
                        <Badge variant="secondary">Disabled</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => deleteNumber(number.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}