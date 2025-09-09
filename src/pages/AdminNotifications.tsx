import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Eye, EyeOff, Mail, Database, Send, TestTube2, Link, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { buildContactPayload, validateContactPayload } from "@/lib/contact-payload"
import { SUPABASE_URL } from "@/config/publicConfig"
import { AdminGuard } from "@/components/admin/AdminGuard"
import { ApiErrorPanel } from "@/components/ui/ApiErrorPanel"

// Helper function to parse validation errors into user-friendly messages
const parseValidationErrors = (details: string[]): string => {
  const messages: string[] = [];
  
  for (const detail of details) {
    if (detail.includes('Unknown fields:')) {
      const fields = detail.replace('Unknown fields: ', '');
      messages.push(`Remove unknown fields: ${fields}`);
    } else if (detail.includes('inquiry_type is required')) {
      messages.push('inquiry_type must be contact or enterprise');
    } else if (detail.includes('inquiry_type') && detail.includes('must be either')) {
      messages.push('inquiry_type must be contact or enterprise');
    } else if (detail.includes('full_name is required')) {
      messages.push('full_name is required');
    } else if (detail.includes('email is required')) {
      messages.push('email is required');  
    } else if (detail.includes('message is required')) {
      messages.push('message is required');
    } else {
      // Fallback for other validation errors
      messages.push(detail);
    }
  }
  
  return messages.join('. ');
};

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
  const [e2eTesting, setE2eTesting] = useState(false)
  const [testError, setTestError] = useState<any>(null)
  const [functionVersions, setFunctionVersions] = useState<{
    'contact-sales': { version?: string, status?: string },
    'test-suitecrm-connection': { version?: string, status?: string }
  }>({
    'contact-sales': {},
    'test-suitecrm-connection': {}
  })
  const [e2eResults, setE2eResults] = useState<{
    connection: { status: 'pending' | 'success' | 'error', message?: string, oauth_user?: string, env_present?: Record<string, boolean>, function?: string, version?: string },
    contact: { status: 'pending' | 'success' | 'error', message?: string, function?: string, version?: string, response_status?: number },
    enterprise: { status: 'pending' | 'success' | 'error', message?: string, crm_reference?: string, function?: string, version?: string, response_status?: number },
    overall: 'pending' | 'success' | 'error'
  } | null>(null)
  const handleHardRefresh = async () => {
    try {
      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }

      // Unregister service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map(registration => registration.unregister())
        );
      }

      // Clear local storage and session storage
      localStorage.clear();
      sessionStorage.clear();

      // Force reload with cache bypass
      window.location.reload();
    } catch (error) {
      console.error('Hard refresh failed:', error);
      toast({
        title: "Hard Refresh Failed",
        description: "Could not clear all caches. Try manually refreshing.",
        variant: "destructive"
      });
    }
  };

  const { toast } = useToast()
  const navigate = useNavigate()

  const checkAuthentication = async () => {
    const { data } = await supabase.auth.getSession()
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

      // Call the function with proper JWT authentication
      const response = await fetch(`${SUPABASE_URL}/functions/v1/send-test-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          to: emailTo,
          subject: `Tulora ${type === 'contact' ? 'Contact' : 'Enterprise'} Test Email`,
          html: `<p>This is a test email for the ${type} flow sent from the Admin Notifications panel.</p>`
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`)
      }

      if (data?.ok) {
        toast({
          title: "Test Email Sent",
          description: `${type === 'contact' ? 'Contact' : 'Enterprise'} test email sent successfully to ${emailTo}`,
          variant: "default"
        })
      } else {
        throw new Error(`Status ${response.status}: ${JSON.stringify(data)}`)
      }
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

      let response: Response
      let methodUsed = 'POST'

      // Try POST first (new deployment) - no credentials needed, uses server env vars
      try {
        response = await fetch(`${SUPABASE_URL}/functions/v1/test-suitecrm-connection`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
          // No body - uses server-side environment variables only
        })

        // If we get 405 Method Not Allowed, retry with GET
        if (response.status === 405) {
          console.log('POST method not allowed, retrying with GET')
          methodUsed = 'GET'
          
          response = await fetch(`${SUPABASE_URL}/functions/v1/test-suitecrm-connection`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
        }
      } catch (error) {
        // If POST fails completely, try GET as fallback
        console.log('POST request failed, retrying with GET:', error)
        methodUsed = 'GET'
        
        response = await fetch(`${SUPABASE_URL}/functions/v1/test-suitecrm-connection`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${data.error || JSON.stringify(data)}`)
      }

      if (data?.success) {
        toast({
          title: "✅ SuiteCRM Connection Successful",
          description: `Method: ${data.method_used || methodUsed} | Version: ${data.version || 'unknown'} | User: ${data.oauth_user || 'unknown'}`,
          variant: "default"
        })
      } else {
        throw new Error(`Status ${response.status}: ${data.error || JSON.stringify(data)}`)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      toast({
        title: "❌ SuiteCRM Connection Failed", 
        description: errorMessage,
        variant: "destructive"
      })
    } finally {
      setTesting(prev => ({ ...prev, crm_connection: false }))
    }
  }

  const handleSendTestLead = async () => {
    setTesting(prev => ({ ...prev, crm_lead: true }))
    setTestError(null)

    try {
      // Check authentication and get token
      const token = await checkAuthentication()
      if (!token) return

      // Build canonical payload using shared builder for enterprise
      const payload = buildContactPayload('enterprise', {
        name: "Test Lead", // maps to full_name
        email: "test@example.com",
        company: "Test Company", 
        notes: "This is a test lead created from Admin Notifications panel" // maps to message
      });

      console.log('Sending admin test lead payload:', payload);

      // Call the function with proper JWT authentication
      const response = await fetch(`${SUPABASE_URL}/functions/v1/contact-sales`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-store'
        },
        cache: 'no-store',
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (!response.ok) {
        setTestError({
          status: response.status,
          message: data.error || 'Test lead failed',
          details: data.details,
          endpoint: data.endpoint,
          function: data.function,
          version: data.version
        });
        return;
      }

      toast({
        title: "Test Lead Sent",
        description: `Test lead sent to CRM successfully. Version: ${data.version || 'unknown'}, Method: ${data.method_used || 'POST'}`,
        variant: "default"
      })
    } catch (error) {
      console.error('Admin test lead error:', error);
      setTestError(error);
    } finally {
      setTesting(prev => ({ ...prev, crm_lead: false }))
    }
  }

  const handlePingFunctions = async () => {
    setTesting(prev => ({ ...prev, ping_functions: true }))
    
    try {
      const token = await checkAuthentication()
      if (!token) return

      // Ping contact-sales
      try {
        const contactResponse = await fetch(`${SUPABASE_URL}/functions/v1/contact-sales`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-store'
          },
          cache: 'no-store',
          body: JSON.stringify({
            inquiry_type: 'contact',
            full_name: 'Ping Test',
            email: 'ping@test.local',
            company: 'Test Co',
            message: 'Version ping test',
            website: 'block' // Honeypot trigger for silent success
          })
        })
        
        const contactData = await contactResponse.json()
        setFunctionVersions(prev => ({
          ...prev,
          'contact-sales': {
            version: contactData.version || 'unknown',
            status: contactResponse.ok ? 'ok' : `${contactResponse.status}`
          }
        }))
      } catch (error) {
        setFunctionVersions(prev => ({
          ...prev,
          'contact-sales': {
            version: 'error',
            status: 'unreachable'
          }
        }))
      }

      // Ping test-suitecrm-connection
      try {
        const crmResponse = await fetch(`${SUPABASE_URL}/functions/v1/test-suitecrm-connection`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        })
        
        const crmData = await crmResponse.json()
        setFunctionVersions(prev => ({
          ...prev,
          'test-suitecrm-connection': {
            version: crmData.version || 'unknown',
            status: crmResponse.ok ? 'ok' : `${crmResponse.status}`
          }
        }))
      } catch (error) {
        setFunctionVersions(prev => ({
          ...prev,
          'test-suitecrm-connection': {
            version: 'error',
            status: 'unreachable'
          }
        }))
      }

      toast({
        title: "Function Versions Retrieved",
        description: "Check the Function Versions panel for details",
        variant: "default"
      })

    } catch (error) {
      console.error('Ping functions error:', error)
      toast({
        title: "Ping Functions Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      })
    } finally {
      setTesting(prev => ({ ...prev, ping_functions: false }))
    }
  }

  const handleRunE2ETest = async () => {
    setE2eTesting(true)
    setE2eResults({
      connection: { status: 'pending' },
      contact: { status: 'pending' },
      enterprise: { status: 'pending' },
      overall: 'pending'
    })

    try {
      // Check authentication and get token
      const token = await checkAuthentication()
      if (!token) return

      // Step 1: Test SuiteCRM Connection
      let connectionResult: { status: 'pending' | 'success' | 'error', message: string, oauth_user: string, env_present: Record<string, boolean> } = { 
        status: 'error', 
        message: '', 
        oauth_user: '', 
        env_present: {} 
      }
      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/test-suitecrm-connection`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        })

        const data = await response.json()
        
        if (response.ok && data.success) {
          connectionResult = {
            status: 'success',
            message: `Status ${response.status}: Method: ${data.method_used || 'POST'} | Version: ${data.version || 'unknown'}`,
            oauth_user: data.oauth_user || 'unknown',
            env_present: data.env_present || {}
          }
        } else {
          // Surface HTTP status clearly for debugging
          const statusInfo = `Status ${response.status}`
          const errorMsg = data.error || 'Connection failed'
          const endpoint = data.endpoint ? ` (${data.endpoint})` : ''
          
          connectionResult = {
            status: 'error',
            message: `${statusInfo}: ${errorMsg}${endpoint}`,
            oauth_user: '',
            env_present: data.env_present || {}
          }
        }
      } catch (error) {
        connectionResult = {
          status: 'error',
          message: error instanceof Error ? error.message : 'Connection test failed',
          oauth_user: '',
          env_present: {}
        }
      }

      setE2eResults(prev => prev ? {
        ...prev,
        connection: connectionResult,
        overall: connectionResult.status === 'success' ? 'pending' : 'error'
      } : null)

      // Step 2: Send Test Lead (only if connection succeeded)
      let leadResult: { status: 'pending' | 'success' | 'error', message: string, crm_reference: string } = { 
        status: 'pending', 
        message: '', 
        crm_reference: '' 
      }
      if (connectionResult.status === 'success') {
        try {
          // Build canonical payload using shared builder for enterprise with full data
          const payload = buildContactPayload('enterprise', {
            name: "E2E Test User", // maps to full_name
            email: "e2e-test@example.com",
            company: "E2E Test Company",
            notes: "CRM E2E integration test from admin panel" // maps to message
          });

          console.log('Sending E2E test lead payload:', payload);
          const response = await fetch(`${SUPABASE_URL}/functions/v1/contact-sales`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
          })

          const data = await response.json()

          // Check both HTTP status and response data
          if (response.ok && data.success === true) {
            leadResult = {
              status: 'success',
              message: `Status ${response.status}: Lead sent successfully`,
              crm_reference: data.crm_sync?.leadId || data.leadId || 'Created'
            }
          } else {
            // Surface HTTP status clearly, especially for CRM failures
            const statusInfo = `Status ${response.status}`
            const errorMsg = data.error || 'Lead creation failed'
            const endpoint = data.endpoint ? ` (${data.endpoint})` : ''
            
            // Show detailed error for validation issues (422)
            if (response.status === 422 && data.details) {
              console.error('Validation error details:', data.details)
              
              // Create error object for ApiErrorPanel
              const validationError = {
                status: 422,
                details: data.details,
                message: `Status ${response.status}: ${errorMsg}${endpoint}`
              };
              
              toast({
                title: "❌ Invalid Payload (422)",
                description: "See detailed validation errors below",
                variant: "destructive"
              })
            } else {
              toast({
                title: "❌ Test Lead Failed",
                description: `${statusInfo}: ${errorMsg}${endpoint}`,
                variant: "destructive"
              })
            }
            
            leadResult = {
              status: 'error',
              message: `${statusInfo}: ${errorMsg}${endpoint}`,
              crm_reference: data.leadId || ''
            }
          }
        } catch (error) {
          leadResult = {
            status: 'error',
            message: error instanceof Error ? error.message : 'Lead test failed',
            crm_reference: ''
          }
        }
      } else {
        leadResult = {
          status: 'error',
          message: 'Skipped due to connection failure',
          crm_reference: ''
        }
      }

      const overallStatus = connectionResult.status === 'success' && leadResult.status === 'success' ? 'success' : 'error'

      setE2eResults({
        connection: connectionResult,
        contact: { status: 'pending' },
        enterprise: { status: 'pending' },
        overall: overallStatus
      })

      // Show summary toast
      if (overallStatus === 'success') {
        toast({
          title: "✅ E2E Test Passed",
          description: `All steps completed successfully. OAuth user: ${connectionResult.oauth_user}, CRM ref: ${leadResult.crm_reference}`,
          variant: "default"
        })
      } else {
        toast({
          title: "❌ E2E Test Failed",
          description: `Connection: ${connectionResult.status}, Lead: ${leadResult.status}`,
          variant: "destructive"
        })
      }

    } catch (error) {
      setE2eResults({
        connection: { status: 'error', message: 'E2E test failed to start', function: '', version: '' },
        contact: { status: 'error', message: 'Not executed', function: '', version: '', response_status: 0 },
        enterprise: { status: 'error', message: 'Not executed', function: '', version: '', response_status: 0 },
        overall: 'error'
      })
      
      toast({
        title: "E2E Test Error",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      })
    } finally {
      setE2eTesting(false)
    }
  }

  return (
    <AdminGuard>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 space-y-8">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-foreground">
                Notifications & CRM
              </h1>
              <p className="text-muted-foreground">
                Manage email notifications and CRM integration settings
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleHardRefresh}
                className="flex items-center space-x-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Hard Refresh Cache</span>
              </Button>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button 
                  onClick={handlePingFunctions}
                  variant="secondary"
                  disabled={testing.ping_functions}
                  className="flex items-center space-x-2"
                >
                  <TestTube2 className="h-4 w-4" />
                  <span>{testing.ping_functions ? "Pinging..." : "Ping Functions"}</span>
                </Button>
                
                <Button
                  onClick={handleHardRefresh}
                  variant="destructive"
                  className="flex items-center space-x-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Hard Refresh Cache</span>
                </Button>
              </div>
            </div>
          </div>
          
          {/* Function Versions Panel */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube2 className="h-5 w-5" />
                Function Versions
              </CardTitle>
              <CardDescription>
                Check deployed function versions for consistency
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    contact-sales
                    <Badge variant={functionVersions['contact-sales'].status === 'ok' ? 'default' : 'destructive'}>
                      {functionVersions['contact-sales'].status || 'unknown'}
                    </Badge>
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Version: <code className="bg-muted px-1 rounded">
                      {functionVersions['contact-sales'].version || 'not checked'}
                    </code>
                  </p>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    test-suitecrm-connection
                    <Badge variant={functionVersions['test-suitecrm-connection'].status === 'ok' ? 'default' : 'destructive'}>
                      {functionVersions['test-suitecrm-connection'].status || 'unknown'}
                    </Badge>
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Version: <code className="bg-muted px-1 rounded">
                      {functionVersions['test-suitecrm-connection'].version || 'not checked'}
                    </code>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

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
              {testError && (
                <ApiErrorPanel 
                  error={testError} 
                  onDismiss={() => setTestError(null)}
                />
              )}
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
                
                <Button 
                  variant="secondary"
                  onClick={handleRunE2ETest}
                  disabled={e2eTesting}
                >
                  <TestTube2 className="h-4 w-4 mr-2" />
                  {e2eTesting ? "Running E2E..." : "Run CRM E2E"}
                </Button>
              </div>

              {/* Payload Examples */}
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <h4 className="font-semibold text-sm mb-2">Valid Payload Examples</h4>
                <div className="space-y-2 text-xs font-mono">
                  <div>
                    <strong>Contact (minimal):</strong>
                    <code className="block mt-1 p-2 bg-background rounded text-xs overflow-x-auto">
                      {`{"inquiry_type":"contact","full_name":"Test User","email":"test@example.com","message":"Hello"}`}
                    </code>
                  </div>
                  <div>
                    <strong>Enterprise (minimal):</strong>
                    <code className="block mt-1 p-2 bg-background rounded text-xs overflow-x-auto">
                      {`{"inquiry_type":"enterprise","full_name":"Test User","email":"test@example.com","message":"Hello"}`}
                    </code>
                  </div>
                  <div className="text-muted-foreground text-xs mt-2">
                    Optional fields (snake_case): company, phone, website, leads_id, source, source_metadata, utm_*
                  </div>
                </div>
              </div>

              {/* E2E Test Results */}
              {e2eResults && (
                <div className="mt-6 p-4 bg-muted rounded-lg space-y-3">
                  <h4 className="font-semibold text-sm">E2E Test Results</h4>
                  
                  {/* Connection Test */}
                  <div className="flex items-center justify-between p-2 bg-background rounded border">
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${
                        e2eResults.connection.status === 'success' ? 'bg-green-500' :
                        e2eResults.connection.status === 'error' ? 'bg-red-500' :
                        'bg-yellow-500'
                      }`} />
                      <span className="text-sm font-medium">1. SuiteCRM Connection</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {e2eResults.connection.status === 'success' && e2eResults.connection.oauth_user && (
                        <span>User: {e2eResults.connection.oauth_user}</span>
                      )}
                      {e2eResults.connection.status === 'error' && (
                        <span>{e2eResults.connection.message}</span>
                      )}
                    </div>
                  </div>

                  {/* Lead Test */}
                  <div className="flex items-center justify-between p-2 bg-background rounded border">
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${
                        e2eResults.lead.status === 'success' ? 'bg-green-500' :
                        e2eResults.lead.status === 'error' ? 'bg-red-500' :
                        'bg-yellow-500'
                      }`} />
                      <span className="text-sm font-medium">2. Test Lead Creation</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {e2eResults.lead.status === 'success' && e2eResults.lead.crm_reference && (
                        <span>CRM ID: {e2eResults.lead.crm_reference}</span>
                      )}
                      {e2eResults.lead.status === 'error' && (
                        <span>{e2eResults.lead.message}</span>
                      )}
                    </div>
                  </div>

                  {/* Environment Check */}
                  {e2eResults.connection.env_present && Object.keys(e2eResults.connection.env_present).length > 0 && (
                    <div className="p-2 bg-background rounded border">
                      <div className="text-sm font-medium mb-2">Environment Variables</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {Object.entries(e2eResults.connection.env_present).map(([key, present]) => (
                          <div key={key} className="flex items-center space-x-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${present ? 'bg-green-500' : 'bg-red-500'}`} />
                            <span className={present ? 'text-foreground' : 'text-muted-foreground'}>{key}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Overall Status */}
                  <div className={`p-2 rounded text-center text-sm font-medium ${
                    e2eResults.overall === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                    'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  }`}>
                    {e2eResults.overall === 'success' ? '✅ All tests passed' : '❌ Test failures detected'}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminGuard>
  )
}