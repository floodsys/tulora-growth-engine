import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Eye, EyeOff, Mail, Database, Send, TestTube2, Link } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { callEdge } from "@/lib/callEdge"
import { AdminGuard } from "@/components/admin/AdminGuard"

export default function AdminNotifications() {
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({})
  const [emailConfig, setEmailConfig] = useState({
    notifications_from: "",
    hello_inbox: "",
    enterprise_inbox: "",
    sales_inbox: ""
  })
  const [crmConfig, setCrmConfig] = useState({
    base_url: "",
    client_id: "",
    client_secret: "",
    sync_enabled: false
  })
  const [testing, setTesting] = useState<Record<string, boolean>>({})
  const { toast } = useToast()
  const navigate = useNavigate()

  const checkAuthentication = async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) {
      toast({
        title: "Authentication Required",
        description: "Please sign in again",
        variant: "destructive"
      })
      navigate('/auth')
      return null
    }
    return data.session.access_token
  }

  const toggleSecretVisibility = (field: string) => {
    setVisibleSecrets(prev => ({
      ...prev,
      [field]: !prev[field]
    }))
  }

  const handleEmailConfigChange = (field: string, value: string) => {
    setEmailConfig(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleCrmConfigChange = (field: string, value: string | boolean) => {
    setCrmConfig(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const validateEmailConfig = () => {
    return emailConfig.notifications_from && emailConfig.hello_inbox && emailConfig.enterprise_inbox
  }

  const validateCrmConfig = () => {
    return crmConfig.base_url && crmConfig.client_id && crmConfig.client_secret
  }

  const handleSendTestEmail = async (type: 'contact' | 'enterprise') => {
    const testKey = `email_${type}`
    setTesting(prev => ({ ...prev, [testKey]: true }))

    try {
      // Check authentication and get token
      const token = await checkAuthentication()
      if (!token) return

      const emailTo = type === 'contact' ? emailConfig.hello_inbox : emailConfig.enterprise_inbox
      
      if (!emailTo) {
        throw new Error(`${type === 'contact' ? 'Hello' : 'Enterprise'} inbox email is required`)
      }

      // Call the function with callEdge
      const { data, error } = await callEdge('send-test-email', {
        to: emailTo,
        subject: `Tulora ${type === 'contact' ? 'Contact' : 'Enterprise'} Test Email`,
        html: `<p>This is a test email for the ${type} flow sent from the Admin Notifications panel.</p>`
      });

      if (error) {
        throw new Error(error.message || 'Test email failed');
      }


      if (data?.ok) {
        toast({
          title: "Test Email Sent",
          description: `${type === 'contact' ? 'Contact' : 'Enterprise'} test email sent successfully to ${emailTo}`,
          variant: "default"
        })
    } catch (error) {
      toast({
        title: "Email Test Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      })
    } finally {
      setTesting(prev => ({ ...prev, [testKey]: false }))
    }
  }

  const handleTestCrmConnection = async () => {
    setTesting(prev => ({ ...prev, crm_connection: true }))

    try {
      // Check authentication and get token
      const token = await checkAuthentication()
      if (!token) return

      if (!validateCrmConfig()) {
        throw new Error("Please fill in all CRM configuration fields")
      }

      // Call the function with callEdge
      const { data, error } = await callEdge('test-suitecrm-connection', {
        base_url: crmConfig.base_url,
        client_id: crmConfig.client_id,
        client_secret: crmConfig.client_secret,
        auth_mode: 'v8_client_credentials'
      });

      if (error) {
        throw new Error(error.message || 'CRM connection test failed');
      }


      if (data?.success) {
        toast({
          title: "CRM Connection Successful",
          description: data.message || "SuiteCRM connection test passed",
          variant: "default"
        })
    } catch (error) {
      toast({
        title: "CRM Connection Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      })
    } finally {
      setTesting(prev => ({ ...prev, crm_connection: false }))
    }
  }

  const handleSendTestLead = async () => {
    setTesting(prev => ({ ...prev, crm_lead: true }))

    try {
      // Check authentication and get token
      const token = await checkAuthentication()
      if (!token) return

      if (!validateCrmConfig()) {
        throw new Error("Please configure and test CRM connection first")
      }

      // Create test lead data
      const testLead = {
        name: "Test Lead",
        email: "test@example.com",
        company: "Test Company",
        phone: "+1234567890",
        message: "This is a test lead created from Admin Notifications panel",
        source: "admin_test",
        metadata: {
          test_lead: true,
          created_by: "admin_panel"
        }
      }

      // Call the function with callEdge
      const { data, error } = await callEdge('contact-sales', testLead);
      if (error) {
        throw new Error(error.message || 'Contact sales test failed');
      }

      toast({
        title: "Test Lead Sent",
        description: "Test lead sent to CRM successfully",
        variant: "default"
      })
    } catch (error) {
      toast({
        title: "Test Lead Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      })
    } finally {
      setTesting(prev => ({ ...prev, crm_lead: false }))
    }
  }

  return (
    <AdminGuard>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 space-y-8">
          {/* Page Header */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">
              Notifications & CRM
            </h1>
            <p className="text-muted-foreground">
              Manage email notifications and CRM integration settings
            </p>
          </div>

          {/* Email (Resend) Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <Mail className="h-6 w-6" />
                <div>
                  <CardTitle>Email (Resend) Configuration</CardTitle>
                  <CardDescription>
                    Configure email addresses and test notification delivery
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="notifications_from">
                    NOTIFICATIONS_FROM <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="notifications_from"
                    type="email"
                    value={emailConfig.notifications_from}
                    onChange={(e) => handleEmailConfigChange('notifications_from', e.target.value)}
                    placeholder="noreply@yourdomain.com"
                  />
                </div>
                
                <div>
                  <Label htmlFor="hello_inbox">
                    HELLO_INBOX <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="hello_inbox"
                    type="email"
                    value={emailConfig.hello_inbox}
                    onChange={(e) => handleEmailConfigChange('hello_inbox', e.target.value)}
                    placeholder="hello@yourdomain.com"
                  />
                </div>
                
                <div>
                  <Label htmlFor="enterprise_inbox">
                    ENTERPRISE_INBOX <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="enterprise_inbox"
                    type="email"
                    value={emailConfig.enterprise_inbox}
                    onChange={(e) => handleEmailConfigChange('enterprise_inbox', e.target.value)}
                    placeholder="enterprise@yourdomain.com"
                  />
                </div>
                
                <div>
                  <Label htmlFor="sales_inbox">
                    SALES_INBOX <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="sales_inbox"
                    type="email"
                    value={emailConfig.sales_inbox}
                    onChange={(e) => handleEmailConfigChange('sales_inbox', e.target.value)}
                    placeholder="sales@yourdomain.com"
                  />
                </div>
              </div>

              <div className="flex space-x-2 pt-4">
                <Button 
                  onClick={() => handleSendTestEmail('contact')}
                  disabled={testing.email_contact || !validateEmailConfig()}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {testing.email_contact ? "Sending..." : "Send Test (Contact)"}
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => handleSendTestEmail('enterprise')}
                  disabled={testing.email_enterprise || !validateEmailConfig()}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {testing.email_enterprise ? "Sending..." : "Send Test (Enterprise)"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* SuiteCRM Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <Database className="h-6 w-6" />
                <div>
                  <CardTitle>SuiteCRM (v8 Client Credentials)</CardTitle>
                  <CardDescription>
                    Configure SuiteCRM integration and test connectivity
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="suitecrm_base_url">
                    SUITECRM_BASE_URL <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="suitecrm_base_url"
                    type="url"
                    value={crmConfig.base_url}
                    onChange={(e) => handleCrmConfigChange('base_url', e.target.value)}
                    placeholder="https://your-suitecrm.com"
                  />
                </div>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="suitecrm_client_id">
                      SUITECRM_CLIENT_ID <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="suitecrm_client_id"
                      type="text"
                      value={crmConfig.client_id}
                      onChange={(e) => handleCrmConfigChange('client_id', e.target.value)}
                      placeholder="Your client ID"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="suitecrm_client_secret">
                      SUITECRM_CLIENT_SECRET <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                        onClick={() => toggleSecretVisibility('client_secret')}
                      >
                        {visibleSecrets.client_secret ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Input
                        id="suitecrm_client_secret"
                        type={visibleSecrets.client_secret ? "text" : "password"}
                        value={crmConfig.client_secret}
                        onChange={(e) => handleCrmConfigChange('client_secret', e.target.value)}
                        placeholder="Your client secret"
                        className="pr-12"
                      />
                    </div>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                  <strong>v8 Client Credentials Mode:</strong> Only requires Base URL, Client ID, and Client Secret. 
                  Username/password authentication is not used in this mode.
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="suitecrm_sync_enabled"
                    checked={crmConfig.sync_enabled}
                    onCheckedChange={(checked) => handleCrmConfigChange('sync_enabled', checked)}
                  />
                  <Label htmlFor="suitecrm_sync_enabled">Enable SuiteCRM sync</Label>
                  <Badge variant={crmConfig.sync_enabled ? "default" : "secondary"}>
                    {crmConfig.sync_enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
              </div>

              <div className="flex space-x-2 pt-4">
                <Button 
                  onClick={handleTestCrmConnection}
                  disabled={testing.crm_connection || !validateCrmConfig()}
                >
                  <Link className="h-4 w-4 mr-2" />
                  {testing.crm_connection ? "Testing..." : "Test Connection"}
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={handleSendTestLead}
                  disabled={testing.crm_lead || !validateCrmConfig()}
                >
                  <TestTube2 className="h-4 w-4 mr-2" />
                  {testing.crm_lead ? "Sending..." : "Send Test Lead"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminGuard>
  )
}