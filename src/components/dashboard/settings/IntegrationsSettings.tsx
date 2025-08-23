import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Eye, EyeOff, Key, Phone, Calendar, Webhook, Bot } from "lucide-react"
import { toast } from "sonner"

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
  const [formData, setFormData] = useState<Record<string, Record<string, string>>>({})

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

  const handleSaveIntegration = (integrationId: string) => {
    // TODO: Implement integration save
    toast.success(`${integrations.find(i => i.id === integrationId)?.name} settings saved`)
  }

  const handleTestIntegration = (integrationId: string) => {
    // TODO: Implement integration test
    toast.success(`${integrations.find(i => i.id === integrationId)?.name} connection tested successfully`)
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
              {integration.fields.map((field) => {
                const fieldId = `${integration.id}_${field.key}`
                const isVisible = visibleFields[fieldId]
                const currentValue = formData[integration.id]?.[field.key] || ""

                return (
                  <div key={field.key}>
                    <Label htmlFor={fieldId}>{field.label}</Label>
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
                {integration.configured && (
                  <Button 
                    variant="outline" 
                    onClick={() => handleTestIntegration(integration.id)}
                  >
                    Test Connection
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}