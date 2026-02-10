import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"
import { Key, Users, Shield, Plus, Copy, RotateCcw, Trash2, Eye, EyeOff } from "lucide-react"

// Additive helper: prefer normalized correlationId → corr → traceId
const getCorrId = (err: any) =>
  err?.correlationId ?? err?.corr ?? err?.traceId ?? null;

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  permissions: string[]
  last_used: string | null
  expires_at: string | null
  is_active: boolean
  created_at: string
}

interface WorkspaceRole {
  id: string
  name: string
  permissions: string[]
  description: string
  is_system: boolean
}

export function AccessControlSettings() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [workspaceRoles, setWorkspaceRoles] = useState<WorkspaceRole[]>([])
  const [loading, setLoading] = useState(true)
  const [isKeyDialogOpen, setIsKeyDialogOpen] = useState(false)
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      // In a real app, these would come from your API
      // For now, using mock data
      setApiKeys([
        {
          id: "1",
          name: "Production API",
          key_prefix: "rk_live_abc123", // gitleaks:allow – mock data, not a real key
          permissions: ["calls:read", "calls:write", "agents:read"],
          last_used: "2024-01-15T10:30:00Z",
          expires_at: null,
          is_active: true,
          created_at: "2024-01-01T00:00:00Z"
        }
      ])

      setWorkspaceRoles([
        {
          id: "admin",
          name: "Administrator",
          permissions: ["*"],
          description: "Full access to all workspace features",
          is_system: true
        },
        {
          id: "editor",
          name: "Editor",
          permissions: ["agents:read", "agents:write", "calls:read", "numbers:read"],
          description: "Can manage agents and view calls",
          is_system: true
        },
        {
          id: "viewer",
          name: "Viewer",
          permissions: ["agents:read", "calls:read"],
          description: "Read-only access to agents and calls",
          is_system: true
        }
      ])
    } catch (error) {
      const corr = getCorrId(error);
      const baseMessage = "Failed to load access control data";
      const message = corr ? `${baseMessage} (Corr ID: ${corr})` : baseMessage;

      toast.error(message);

      console.error("AccessControlSettings error", { corrId: corr, error });
    } finally {
      setLoading(false)
    }
  }

  const handleCreateApiKey = async (data: any) => {
    try {
      // In a real app, this would call your API
      const newKey = {
        id: Date.now().toString(),
        name: data.name,
        key_prefix: `rk_${Math.random().toString(36).substring(2, 8)}`,
        permissions: data.permissions,
        last_used: null,
        expires_at: data.expires_at,
        is_active: true,
        created_at: new Date().toISOString()
      }

      setApiKeys(prev => [...prev, newKey])
      toast.success("API key created successfully")
      setIsKeyDialogOpen(false)
    } catch (error) {
      const corr = getCorrId(error);
      const baseMessage = "Failed to create API key";
      const message = corr ? `${baseMessage} (Corr ID: ${corr})` : baseMessage;

      toast.error(message);

      console.error("AccessControlSettings error", { corrId: corr, error });
    }
  }

  const handleRevokeApiKey = async (keyId: string) => {
    try {
      setApiKeys(prev => prev.filter(key => key.id !== keyId))
      toast.success("API key revoked")
    } catch (error) {
      const corr = getCorrId(error);
      const baseMessage = "Failed to revoke API key";
      const message = corr ? `${baseMessage} (Corr ID: ${corr})` : baseMessage;

      toast.error(message);

      console.error("AccessControlSettings error", { corrId: corr, error });
    }
  }

  const handleCreateRole = async (data: any) => {
    try {
      const newRole = {
        id: Date.now().toString(),
        name: data.name,
        permissions: data.permissions,
        description: data.description,
        is_system: false
      }

      setWorkspaceRoles(prev => [...prev, newRole])
      toast.success("Role created successfully")
      setIsRoleDialogOpen(false)
    } catch (error) {
      const corr = getCorrId(error);
      const baseMessage = "Failed to create role";
      const message = corr ? `${baseMessage} (Corr ID: ${corr})` : baseMessage;

      toast.error(message);

      console.error("AccessControlSettings error", { corrId: corr, error });
    }
  }

  const availablePermissions = [
    { value: "agents:read", label: "Read Agents" },
    { value: "agents:write", label: "Manage Agents" },
    { value: "calls:read", label: "Read Calls" },
    { value: "calls:write", label: "Manage Calls" },
    { value: "numbers:read", label: "Read Numbers" },
    { value: "numbers:write", label: "Manage Numbers" },
    { value: "analytics:read", label: "Read Analytics" },
    { value: "settings:read", label: "Read Settings" },
    { value: "settings:write", label: "Manage Settings" },
    { value: "billing:read", label: "Read Billing" },
    { value: "billing:write", label: "Manage Billing" }
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Access Control</h2>
          <p className="text-muted-foreground">
            Manage API keys, roles, and permissions for your workspace
          </p>
        </div>
      </div>

      <Tabs defaultValue="api-keys" className="space-y-6">
        <TabsList>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
          <TabsTrigger value="workspace">Workspace Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="api-keys" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">API Keys</h3>
              <p className="text-sm text-muted-foreground">
                Generate and manage API keys for programmatic access
              </p>
            </div>
            <Dialog open={isKeyDialogOpen} onOpenChange={setIsKeyDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create API Key
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create API Key</DialogTitle>
                  <DialogDescription>
                    Generate a new API key for programmatic access
                  </DialogDescription>
                </DialogHeader>
                <CreateApiKeyForm
                  permissions={availablePermissions}
                  onSubmit={handleCreateApiKey}
                />
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading API keys...</div>
          ) : apiKeys.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Key className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No API keys</h3>
                  <p className="text-muted-foreground mb-4">
                    Create an API key to access the Retell API
                  </p>
                  <Button onClick={() => setIsKeyDialogOpen(true)}>
                    Create API Key
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {apiKeys.map((key) => (
                <ApiKeyCard
                  key={key.id}
                  apiKey={key}
                  permissions={availablePermissions}
                  onRevoke={handleRevokeApiKey}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Roles & Permissions</h3>
              <p className="text-sm text-muted-foreground">
                Define custom roles and assign permissions
              </p>
            </div>
            <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Role
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Custom Role</DialogTitle>
                  <DialogDescription>
                    Define a new role with specific permissions
                  </DialogDescription>
                </DialogHeader>
                <CreateRoleForm
                  permissions={availablePermissions}
                  onSubmit={handleCreateRole}
                />
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {workspaceRoles.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                permissions={availablePermissions}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="workspace" className="space-y-4">
          <WorkspaceSecuritySettings />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function CreateApiKeyForm({ permissions, onSubmit }: any) {
  const [formData, setFormData] = useState({
    name: "",
    permissions: [],
    expires_at: ""
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      ...formData,
      expires_at: formData.expires_at || null
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Key Name</Label>
        <Input
          id="name"
          placeholder="e.g., Production API, Mobile App"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Permissions</Label>
        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
          {permissions.map((permission: any) => (
            <label key={permission.value} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.permissions.includes(permission.value)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setFormData(prev => ({
                      ...prev,
                      permissions: [...prev.permissions, permission.value]
                    }))
                  } else {
                    setFormData(prev => ({
                      ...prev,
                      permissions: prev.permissions.filter(p => p !== permission.value)
                    }))
                  }
                }}
              />
              <span className="text-sm">{permission.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="expires_at">Expiration Date (Optional)</Label>
        <Input
          id="expires_at"
          type="datetime-local"
          value={formData.expires_at}
          onChange={(e) => setFormData(prev => ({ ...prev, expires_at: e.target.value }))}
        />
      </div>

      <Button type="submit" className="w-full">
        Create API Key
      </Button>
    </form>
  )
}

function CreateRoleForm({ permissions, onSubmit }: any) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    permissions: []
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Role Name</Label>
        <Input
          id="name"
          placeholder="e.g., Support Agent, Developer"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          placeholder="Describe what this role can do"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label>Permissions</Label>
        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
          {permissions.map((permission: any) => (
            <label key={permission.value} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.permissions.includes(permission.value)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setFormData(prev => ({
                      ...prev,
                      permissions: [...prev.permissions, permission.value]
                    }))
                  } else {
                    setFormData(prev => ({
                      ...prev,
                      permissions: prev.permissions.filter(p => p !== permission.value)
                    }))
                  }
                }}
              />
              <span className="text-sm">{permission.label}</span>
            </label>
          ))}
        </div>
      </div>

      <Button type="submit" className="w-full">
        Create Role
      </Button>
    </form>
  )
}

function ApiKeyCard({ apiKey, permissions, onRevoke }: any) {
  const [showKey, setShowKey] = useState(false)

  const getPermissionLabel = (value: string) => {
    return permissions.find((p: any) => p.value === value)?.label || value
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(apiKey.key_prefix + "...")
    toast.success("API key copied to clipboard")
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{apiKey.name}</CardTitle>
            <CardDescription>
              Created {new Date(apiKey.created_at).toLocaleDateString()}
              {apiKey.last_used && ` • Last used ${new Date(apiKey.last_used).toLocaleDateString()}`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {apiKey.is_active ? (
              <Badge variant="default">Active</Badge>
            ) : (
              <Badge variant="secondary">Inactive</Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyToClipboard}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRevoke(apiKey.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <Label className="text-sm font-medium">API Key</Label>
          <p className="text-sm font-mono bg-muted p-2 rounded">
            {showKey ? apiKey.key_prefix + "_full_key_here" : apiKey.key_prefix + "..."}
          </p>
        </div>

        <div>
          <Label className="text-sm font-medium">Permissions</Label>
          <div className="flex flex-wrap gap-1 mt-1">
            {apiKey.permissions.map((permission: string) => (
              <Badge key={permission} variant="outline" className="text-xs">
                {getPermissionLabel(permission)}
              </Badge>
            ))}
          </div>
        </div>

        {apiKey.expires_at && (
          <div>
            <Label className="text-sm font-medium">Expires</Label>
            <p className="text-sm text-muted-foreground">
              {new Date(apiKey.expires_at).toLocaleDateString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RoleCard({ role, permissions }: any) {
  const getPermissionLabel = (value: string) => {
    return permissions.find((p: any) => p.value === value)?.label || value
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {role.name}
            </CardTitle>
            <CardDescription>{role.description}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {role.is_system ? (
              <Badge variant="secondary">System Role</Badge>
            ) : (
              <Badge variant="outline">Custom Role</Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div>
          <Label className="text-sm font-medium">Permissions</Label>
          <div className="flex flex-wrap gap-1 mt-1">
            {role.permissions.includes("*") ? (
              <Badge variant="default">All Permissions</Badge>
            ) : (
              role.permissions.map((permission: string) => (
                <Badge key={permission} variant="outline" className="text-xs">
                  {getPermissionLabel(permission)}
                </Badge>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function WorkspaceSecuritySettings() {
  const [settings, setSettings] = useState({
    require_mfa: false,
    session_timeout_minutes: 480,
    ip_whitelist_enabled: false,
    ip_whitelist: "",
    webhook_security_enabled: true,
    audit_log_retention_days: 90
  })

  const [saving, setSaving] = useState(false)

  const saveSettings = async () => {
    setSaving(true)
    const corr = crypto.randomUUID()
    const previousSettings = { ...settings }

    try {
      // Get current organization
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single()

      if (!membership) throw new Error('No organization found')

      const { data, error } = await supabase.functions.invoke('org-settings-save', {
        body: {
          organizationId: membership.organization_id,
          settings: {
            require_mfa: settings.require_mfa,
            session_timeout_minutes: settings.session_timeout_minutes,
            ip_allowlist_enabled: settings.ip_whitelist_enabled,
            ip_allowlist: settings.ip_whitelist,
            webhook_security_enabled: settings.webhook_security_enabled,
            audit_log_retention_days: settings.audit_log_retention_days
          }
        }
      })

      if (error) throw error

      toast.success("Security settings saved")

      if (data?.settings) {
        setSettings(data.settings)
      }
    } catch (error) {
      // ROLLBACK on failure
      setSettings(previousSettings)

      const corrId = getCorrId(error) || corr
      toast.error(`Failed to save settings (Corr ID: ${corrId})`)
      console.error('Settings save failed:', { corrId, error })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Workspace Security</h3>
          <p className="text-sm text-muted-foreground">
            Configure security settings for your workspace
          </p>
        </div>
        <Button onClick={saveSettings} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Authentication & Access
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Require Multi-Factor Authentication</Label>
                <p className="text-sm text-muted-foreground">
                  Require all users to enable MFA
                </p>
              </div>
              <Switch
                checked={settings.require_mfa}
                onCheckedChange={(require_mfa) =>
                  setSettings(prev => ({ ...prev, require_mfa }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Session Timeout (minutes)</Label>
              <Input
                type="number"
                value={settings.session_timeout_minutes}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  session_timeout_minutes: parseInt(e.target.value)
                }))}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>IP Whitelist</Label>
                <Switch
                  checked={settings.ip_whitelist_enabled}
                  onCheckedChange={(ip_whitelist_enabled) =>
                    setSettings(prev => ({ ...prev, ip_whitelist_enabled }))
                  }
                />
              </div>
              {settings.ip_whitelist_enabled && (
                <Input
                  placeholder="192.168.1.0/24, 10.0.0.1"
                  value={settings.ip_whitelist}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    ip_whitelist: e.target.value
                  }))}
                />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit & Compliance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Audit Log Retention (days)</Label>
              <Input
                type="number"
                value={settings.audit_log_retention_days}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  audit_log_retention_days: parseInt(e.target.value)
                }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Webhook Security</Label>
                <p className="text-sm text-muted-foreground">
                  Verify webhook signatures and enforce HTTPS
                </p>
              </div>
              <Switch
                checked={settings.webhook_security_enabled}
                onCheckedChange={(webhook_security_enabled) =>
                  setSettings(prev => ({ ...prev, webhook_security_enabled }))
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
