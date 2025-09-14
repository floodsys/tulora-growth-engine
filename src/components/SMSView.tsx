import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useSMS } from '@/hooks/useSMS'
import { useRetellNumbers } from '@/hooks/useRetellNumbers'
import { MessageSquare, Building2, Target, Send, Plus, CheckCircle, XCircle, Clock } from 'lucide-react'
import { toast } from 'sonner'

export default function SMSView() {
  const { 
    loading, 
    brands, 
    campaigns, 
    messages, 
    listBrands, 
    listCampaigns, 
    listMessages, 
    registerBrand, 
    registerCampaign, 
    sendSMS 
  } = useSMS()
  const { ownedNumbers, listNumbers } = useRetellNumbers()

  const [brandDialogOpen, setBrandDialogOpen] = useState(false)
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false)
  const [sendDialogOpen, setSendDialogOpen] = useState(false)

  // Brand form state
  const [brandForm, setBrandForm] = useState({
    brand_name: '',
    company_name: '',
    tax_id: '',
    website: '',
    industry: '',
    phone_number: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'US',
  })

  // Campaign form state
  const [campaignForm, setCampaignForm] = useState({
    brand_id: '',
    campaign_name: '',
    campaign_type: 'standard',
    use_case: '',
    sample_messages: [''],
    monthly_volume: 1000,
  })

  // Send SMS form state
  const [smsForm, setSmsForm] = useState({
    to_number: '',
    message_body: '',
    campaign_id: '',
    number_id: '',
  })

  useEffect(() => {
    listBrands()
    listCampaigns()
    listMessages()
    listNumbers()
  }, [])

  const handleBrandRegister = async () => {
    try {
      await registerBrand(brandForm)
      setBrandDialogOpen(false)
      setBrandForm({
        brand_name: '',
        company_name: '',
        tax_id: '',
        website: '',
        industry: '',
        phone_number: '',
        address_line1: '',
        address_line2: '',
        city: '',
        state: '',
        postal_code: '',
        country: 'US',
      })
    } catch (error) {
      // Error handled in hook
    }
  }

  const handleCampaignRegister = async () => {
    try {
      await registerCampaign({
        ...campaignForm,
        sample_messages: campaignForm.sample_messages.filter(msg => msg.trim()),
      })
      setCampaignDialogOpen(false)
      setCampaignForm({
        brand_id: '',
        campaign_name: '',
        campaign_type: 'standard',
        use_case: '',
        sample_messages: [''],
        monthly_volume: 1000,
      })
    } catch (error) {
      // Error handled in hook
    }
  }

  const handleSendSMS = async () => {
    try {
      await sendSMS(smsForm)
      setSendDialogOpen(false)
      setSmsForm({
        to_number: '',
        message_body: '',
        campaign_id: '',
        number_id: '',
      })
    } catch (error) {
      // Error handled in hook
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Pending</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const smsEnabledNumbers = ownedNumbers.filter(num => num.sms_enabled)

  if (loading && brands.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">SMS / 10DLC</h1>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">SMS / 10DLC</h1>
        <div className="flex gap-2">
          <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Send className="w-4 h-4" />
                Send SMS
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send SMS</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="to_number">To Number</Label>
                  <Input
                    id="to_number"
                    value={smsForm.to_number}
                    onChange={(e) => setSmsForm(prev => ({ ...prev, to_number: e.target.value }))}
                    placeholder="+1234567890"
                  />
                </div>
                <div>
                  <Label htmlFor="number_id">From Number</Label>
                  <Select value={smsForm.number_id} onValueChange={(value) => setSmsForm(prev => ({ ...prev, number_id: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a number" />
                    </SelectTrigger>
                    <SelectContent>
                      {smsEnabledNumbers.map((number) => (
                        <SelectItem key={number.id} value={number.id}>
                          {number.e164} {number.country && `(${number.country})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="campaign_id">Campaign (Optional)</Label>
                  <Select value={smsForm.campaign_id} onValueChange={(value) => setSmsForm(prev => ({ ...prev, campaign_id: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a campaign" />
                    </SelectTrigger>
                    <SelectContent>
                      {campaigns.filter(c => c.registration_status === 'approved').map((campaign) => (
                        <SelectItem key={campaign.id} value={campaign.id}>
                          {campaign.campaign_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="message_body">Message</Label>
                  <Textarea
                    id="message_body"
                    value={smsForm.message_body}
                    onChange={(e) => setSmsForm(prev => ({ ...prev, message_body: e.target.value }))}
                    placeholder="Enter your message..."
                    rows={4}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    {smsForm.message_body.length}/160 characters
                  </p>
                </div>
                <Button onClick={handleSendSMS} disabled={!smsForm.to_number || !smsForm.message_body || !smsForm.number_id}>
                  Send SMS
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="brands" className="space-y-4">
        <TabsList>
          <TabsTrigger value="brands">Brands</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
        </TabsList>

        <TabsContent value="brands" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Brand Registration</h2>
            <Dialog open={brandDialogOpen} onOpenChange={setBrandDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Register Brand
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Register New Brand</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="brand_name">Brand Name *</Label>
                    <Input
                      id="brand_name"
                      value={brandForm.brand_name}
                      onChange={(e) => setBrandForm(prev => ({ ...prev, brand_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="company_name">Company Name *</Label>
                    <Input
                      id="company_name"
                      value={brandForm.company_name}
                      onChange={(e) => setBrandForm(prev => ({ ...prev, company_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="tax_id">Tax ID</Label>
                    <Input
                      id="tax_id"
                      value={brandForm.tax_id}
                      onChange={(e) => setBrandForm(prev => ({ ...prev, tax_id: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={brandForm.website}
                      onChange={(e) => setBrandForm(prev => ({ ...prev, website: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="industry">Industry</Label>
                    <Input
                      id="industry"
                      value={brandForm.industry}
                      onChange={(e) => setBrandForm(prev => ({ ...prev, industry: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone_number">Phone Number</Label>
                    <Input
                      id="phone_number"
                      value={brandForm.phone_number}
                      onChange={(e) => setBrandForm(prev => ({ ...prev, phone_number: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="address_line1">Address Line 1</Label>
                    <Input
                      id="address_line1"
                      value={brandForm.address_line1}
                      onChange={(e) => setBrandForm(prev => ({ ...prev, address_line1: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="address_line2">Address Line 2</Label>
                    <Input
                      id="address_line2"
                      value={brandForm.address_line2}
                      onChange={(e) => setBrandForm(prev => ({ ...prev, address_line2: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={brandForm.city}
                      onChange={(e) => setBrandForm(prev => ({ ...prev, city: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={brandForm.state}
                      onChange={(e) => setBrandForm(prev => ({ ...prev, state: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="postal_code">Postal Code</Label>
                    <Input
                      id="postal_code"
                      value={brandForm.postal_code}
                      onChange={(e) => setBrandForm(prev => ({ ...prev, postal_code: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="country">Country</Label>
                    <Select value={brandForm.country} onValueChange={(value) => setBrandForm(prev => ({ ...prev, country: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="US">United States</SelectItem>
                        <SelectItem value="CA">Canada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleBrandRegister} disabled={!brandForm.brand_name || !brandForm.company_name} className="mt-4">
                  Register Brand
                </Button>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {brands.map((brand) => (
              <Card key={brand.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5" />
                      {brand.brand_name}
                    </CardTitle>
                    {getStatusBadge(brand.registration_status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong>Company:</strong> {brand.company_name}
                    </div>
                    <div>
                      <strong>Website:</strong> {brand.website || 'N/A'}
                    </div>
                    <div>
                      <strong>Industry:</strong> {brand.industry || 'N/A'}
                    </div>
                    <div>
                      <strong>Country:</strong> {brand.country}
                    </div>
                  </div>
                  {brand.rejection_reason && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                      <strong>Rejection Reason:</strong> {brand.rejection_reason}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {brands.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No brands registered</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Register your brand to start sending SMS messages with 10DLC compliance.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Campaign Registration</h2>
            <Dialog open={campaignDialogOpen} onOpenChange={setCampaignDialogOpen}>
              <DialogTrigger asChild>
                <Button disabled={brands.filter(b => b.registration_status === 'approved').length === 0}>
                  <Plus className="w-4 h-4 mr-2" />
                  Register Campaign
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Register New Campaign</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="brand_id">Brand *</Label>
                    <Select value={campaignForm.brand_id} onValueChange={(value) => setCampaignForm(prev => ({ ...prev, brand_id: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {brands.filter(b => b.registration_status === 'approved').map((brand) => (
                          <SelectItem key={brand.id} value={brand.id}>
                            {brand.brand_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="campaign_name">Campaign Name *</Label>
                    <Input
                      id="campaign_name"
                      value={campaignForm.campaign_name}
                      onChange={(e) => setCampaignForm(prev => ({ ...prev, campaign_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="use_case">Use Case *</Label>
                    <Textarea
                      id="use_case"
                      value={campaignForm.use_case}
                      onChange={(e) => setCampaignForm(prev => ({ ...prev, use_case: e.target.value }))}
                      placeholder="Describe how you will use SMS messaging..."
                    />
                  </div>
                  <div>
                    <Label>Sample Messages *</Label>
                    {campaignForm.sample_messages.map((message, index) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <Textarea
                          value={message}
                          onChange={(e) => {
                            const newMessages = [...campaignForm.sample_messages]
                            newMessages[index] = e.target.value
                            setCampaignForm(prev => ({ ...prev, sample_messages: newMessages }))
                          }}
                          placeholder={`Sample message ${index + 1}...`}
                          rows={2}
                        />
                        {index === campaignForm.sample_messages.length - 1 && (
                          <Button
                            onClick={() => setCampaignForm(prev => ({ ...prev, sample_messages: [...prev.sample_messages, ''] }))}
                            variant="outline"
                            size="sm"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div>
                    <Label htmlFor="monthly_volume">Expected Monthly Volume</Label>
                    <Input
                      id="monthly_volume"
                      type="number"
                      value={campaignForm.monthly_volume}
                      onChange={(e) => setCampaignForm(prev => ({ ...prev, monthly_volume: parseInt(e.target.value) || 1000 }))}
                    />
                  </div>
                </div>
                <Button onClick={handleCampaignRegister} disabled={!campaignForm.brand_id || !campaignForm.campaign_name || !campaignForm.use_case}>
                  Register Campaign
                </Button>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {campaigns.map((campaign) => (
              <Card key={campaign.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Target className="w-5 h-5" />
                      {campaign.campaign_name}
                    </CardTitle>
                    {getStatusBadge(campaign.registration_status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div>
                      <strong>Use Case:</strong> {campaign.use_case}
                    </div>
                    <div>
                      <strong>Type:</strong> {campaign.campaign_type}
                    </div>
                    <div>
                      <strong>Monthly Volume:</strong> {campaign.monthly_volume.toLocaleString()}
                    </div>
                    <div>
                      <strong>Sample Messages:</strong>
                      <ul className="ml-4 mt-1 space-y-1">
                        {campaign.sample_messages.map((message, index) => (
                          <li key={index} className="text-muted-foreground">• {message}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  {campaign.rejection_reason && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                      <strong>Rejection Reason:</strong> {campaign.rejection_reason}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {campaigns.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <Target className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No campaigns registered</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Register campaigns for your approved brands to organize your SMS messaging.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="messages" className="space-y-4">
          <h2 className="text-xl font-semibold">SMS Messages</h2>
          
          <div className="grid gap-4">
            {messages.map((message) => (
              <Card key={message.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5" />
                      {message.direction === 'outbound' ? 'Sent' : 'Received'}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(message.delivery_status)}
                      <Badge variant="outline">
                        ${(message.cost_cents / 100).toFixed(3)}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span><strong>From:</strong> {message.from_number}</span>
                      <span><strong>To:</strong> {message.to_number}</span>
                      <span><strong>Sent:</strong> {new Date(message.created_at).toLocaleString()}</span>
                    </div>
                    <div className="p-3 bg-muted rounded-md">
                      {message.message_body}
                    </div>
                    {message.error_message && (
                      <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                        <strong>Error:</strong> {message.error_message}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {messages.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <MessageSquare className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No SMS messages</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Your sent and received SMS messages will appear here.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}