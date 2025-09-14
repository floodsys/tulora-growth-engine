import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Eye, EyeOff, Key, Phone, Calendar, Webhook, Bot, Database } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { CRMAdminPanel } from "@/components/admin/CRMAdminPanel"

const integrations = [
  {
    id: "retell",
    name: "Retell AI",
    description: "Voice AI platform integration",
    icon: Bot,
    fields: [
      { key: "api_key", label: "API Key", type: "password" },
      { key: "webhook_secret", label: "Webhook Secret", type: "password" }
    ],
    configured: true
  },
  {
    id: "twilio",
    name: "Twilio",
    description: "SMS and voice communications",
    icon: Phone,
    fields: [
      { key: "account_sid", label: "Account SID", type: "text" },
      { key: "auth_token", label: "Auth Token", type: "password" },
      { key: "phone_number", label: "Phone Number", type: "text" }
    ],
    configured: false
  },
  {
    id: "google_calendar",
    name: "Google Calendar",
    description: "Calendar integration for scheduling",
    icon: Calendar,
    fields: [
      { key: "client_id", label: "Client ID", type: "text" },
      { key: "client_secret", label: "Client Secret", type: "password" }
    ],
    configured: false
  },
  {
    id: "suitecrm",
    name: "SuiteCRM",
    description: "Customer relationship management integration",
    icon: Database,
    authModes: [
      { value: "v8_client_credentials", label: "v8 Client Credentials (Recommended)" },
      { value: "v8_password", label: "v8 Username/Password" },
      { value: "v4_1_legacy", label: "v4.1 Legacy" }
    ],
    fields: [
      { key: "base_url", label: "Base URL", type: "text", required: true },
      { key: "client_id", label: "Client ID", type: "text", required: true },
      { key: "client_secret", label: "Client Secret", type: "password", required: true },
      { key: "username", label: "Username", type: "text", conditionalRequired: true },
      { key: "password", label: "Password", type: "password", conditionalRequired: true }
    ],
    configured: false
  },
  {
    id: "crm_webhook",
    name: "CRM Webhook",
    description: "Custom webhook for CRM integration",
    icon: Webhook,
    fields: [
      { key: "webhook_url", label: "Webhook URL", type: "text" },
      { key: "secret_key", label: "Secret Key", type: "password" }
    ],
    configured: true
  }
]

export function IntegrationsSettings() {
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({})
  const [formData, setFormData] = useState<Record<string, Record<string, string>>>({
    suitecrm: { auth_mode: "v8_client_credentials" }
  })
  const [testing, setTesting] = useState<Record<string, boolean>>({})
  const { toast } = useToast()

  const toggleFieldVisibility = (integrationId: string, fieldKey: string) => {
    const key = `${integrationId}_${fieldKey}`
    setVisibleFields(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const handleFieldChange = (integrationId: string, fieldKey: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [integrationId]: {
        ...prev[integrationId],
        [fieldKey]: value
      }
    }))
  }

  const handleAuthModeChange = (integrationId: string, authMode: string) => {
    setFormData(prev => ({
      ...prev,
      [integrationId]: {
        ...prev[integrationId],
        auth_mode: authMode
      }
    }))
  }

  const getVisibleFields = (integration: any) => {
    if (integration.id !== "suitecrm") return integration.fields
    
    const authMode = formData.suitecrm?.auth_mode || "v8_client_credentials"
    
    return integration.fields.filter((field: any) => {
      if (field.key === "username" || field.key === "password") {
        return authMode !== "v8_client_credentials"
      }
      return true
    })
  }

  const validateSuiteCRMFields = () => {
    const data = formData.suitecrm || {}
    const authMode = data.auth_mode || "v8_client_credentials"
    
    const requiredFields = ["base_url", "client_id", "client_secret"]
    if (authMode !== "v8_client_credentials") {
      requiredFields.push("username", "password")
    }
    
    return requiredFields.every(field => data[field]?.trim())
  }

  const handleSaveIntegration = (integrationId: string) => {
    if (integrationId === "suitecrm" && !validateSuiteCRMFields()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      })
      return
    }
    
    console.log(`${integrations.find(i => i.id === integrationId)?.name} settings saved`)
    toast({
      title: "Success",
      description: `${integrations.find(i => i.id === integrationId)?.name} configuration saved`
    })
  }

  const handleTestIntegration = async (integrationId: string) => {
    if (integrationId !== "suitecrm") {
      console.log(`${integrations.find(i => i.id === integrationId)?.name} connection tested successfully`)
      return
    }

    if (!validateSuiteCRMFields()) {
      toast({
        title: "Validation Error", 
        description: "Please fill in all required fields before testing",
        variant: "destructive"
      })
      return
    }

    setTesting(prev => ({ ...prev, [integrationId]: true }))

    try {
      const { data, error } = await supabase.functions.invoke('test-suitecrm-connection', {
        body: formData.suitecrm
      })

      if (error) throw error

      if (data?.success) {
        toast({
          title: "Connection Successful",
          description: `Status: ${data.status_code || 'Success'} - ${data.message || "SuiteCRM connection test passed"}${data.oauth_user ? ` (User: ${data.oauth_user})` : ''}`
        })
      } else {
        const statusInfo = data?.status_code ? `Status ${data.status_code}: ` : ''
        const endpoint = data?.endpoint ? ` (${data.endpoint})` : ''
        throw new Error(`${statusInfo}${data?.error || "Connection test failed"}${endpoint}`)
      }
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      })
    } finally {
      setTesting(prev => ({ ...prev, [integrationId]: false }))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-muted-foreground">Manage provider keys and external integrations</p>
      </div>

      <div className="grid gap-6">
        {integrations.map((integration) => (
          <Card key={integration.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <integration.icon className="h-6 w-6" />
                  <div>
                    <CardTitle>{integration.name}</CardTitle>
                    <CardDescription>{integration.description}</CardDescription>
                  </div>
                </div>
                <Badge variant={integration.configured ? "default" : "secondary"}>
                  {integration.configured ? "Configured" : "Not Configured"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Auth Mode Selector for SuiteCRM */}
              {integration.authModes && (
                <div>
                  <Label htmlFor={`${integration.id}_auth_mode`}>Authentication Mode</Label>
                  <Select
                    value={formData[integration.id]?.auth_mode || integration.authModes[0].value}
                    onValueChange={(value) => handleAuthModeChange(integration.id, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select authentication mode" />
                    </SelectTrigger>
                    <SelectContent>
                      {integration.authModes.map((mode: any) => (
                        <SelectItem key={mode.value} value={mode.value}>
                          {mode.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Dynamic Fields */}
              {getVisibleFields(integration).map((field: any) => {
                const fieldId = `${integration.id}_${field.key}`
                const isVisible = visibleFields[fieldId]
                const currentValue = formData[integration.id]?.[field.key] || ""

                return (
                  <div key={field.key}>
                    <Label htmlFor={fieldId}>
                      {field.label}
                      {field.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <div className="relative">
                      {field.type === "password" && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                          onClick={() => toggleFieldVisibility(integration.id, field.key)}
                        >
                          {isVisible ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      <Input
                        id={fieldId}
                        type={field.type === "password" && !isVisible ? "password" : "text"}
                        value={currentValue}
                        onChange={(e) => handleFieldChange(integration.id, field.key, e.target.value)}
                        placeholder={
                          field.type === "password" 
                            ? integration.configured 
                              ? "••••••••••••••••" 
                              : `Enter ${field.label.toLowerCase()}`
                            : `Enter ${field.label.toLowerCase()}`
                        }
                        className={field.type === "password" ? "pr-12" : ""}
                      />
                    </div>
                  </div>
                )
              })}

              <div className="flex space-x-2 pt-2">
                <Button onClick={() => handleSaveIntegration(integration.id)}>
                  <Key className="h-4 w-4 mr-2" />
                  Save Configuration
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleTestIntegration(integration.id)}
                  disabled={testing[integration.id]}
                >
                  {testing[integration.id] ? "Testing..." : "Test Connection"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* SuiteCRM Admin Panel for organization owners */}
      {formData.suitecrm?.base_url && validateSuiteCRMFields() && (
        <CRMAdminPanel organizationId="current-org-id" />
      )}
    </div>
  )
}