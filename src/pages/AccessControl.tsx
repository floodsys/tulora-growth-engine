import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Key, Users, Building2, Copy, Eye, EyeOff, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function AccessControl() {
  const { toast } = useToast()
  const [selectedTab, setSelectedTab] = useState("api-keys")
  const [apiKeys, setApiKeys] = useState([
    {
      id: 1,
      name: "Production API Key",
      key: "sk_live_1234567890abcdef...",
      type: "live",
      permissions: ["read", "write"],
      lastUsed: "2024-01-15",
      created: "2024-01-01"
    },
    {
      id: 2,
      name: "Development Key",
      key: "sk_test_abcdef1234567890...",
      type: "test",
      permissions: ["read"],
      lastUsed: "2024-01-14",
      created: "2024-01-10"
    }
  ])

  const [workspaces, setWorkspaces] = useState([
    {
      id: 1,
      name: "Production",
      description: "Live production environment",
      members: 5,
      status: "active"
    },
    {
      id: 2,
      name: "Development",
      description: "Development and testing",
      members: 8,
      status: "active"
    }
  ])

  const [teamMembers, setTeamMembers] = useState([
    {
      id: 1,
      name: "John Doe",
      email: "john@company.com",
      role: "Admin",
      workspace: "Production",
      lastActive: "2024-01-15",
      status: "active"
    },
    {
      id: 2,
      name: "Jane Smith",
      email: "jane@company.com",
      role: "Editor",
      workspace: "Development",
      lastActive: "2024-01-14",
      status: "active"
    }
  ])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied!",
      description: "API key copied to clipboard",
    })
  }

  const generateNewKey = () => {
    const newKey = {
      id: apiKeys.length + 1,
      name: "New API Key",
      key: `sk_live_${Math.random().toString(36).substring(2, 24)}...`,
      type: "live",
      permissions: ["read"],
      lastUsed: "Never",
      created: new Date().toISOString().split('T')[0]
    }
    setApiKeys([...apiKeys, newKey])
    toast({
      title: "API Key Generated",
      description: "New API key has been created successfully",
    })
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Access Control</h1>
        <p className="text-muted-foreground">Manage API keys, workspaces, and team access permissions</p>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="workspaces">Workspaces</TabsTrigger>
          <TabsTrigger value="team">Team Members</TabsTrigger>
        </TabsList>

        <TabsContent value="api-keys" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    API Keys
                  </CardTitle>
                  <CardDescription>
                    Manage API keys for accessing Retell services
                  </CardDescription>
                </div>
                <Button onClick={generateNewKey}>
                  Generate New Key
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {apiKeys.map((apiKey) => (
                  <div key={apiKey.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{apiKey.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={apiKey.type === "live" ? "default" : "secondary"}>
                            {apiKey.type}
                          </Badge>
                          {apiKey.permissions.map((permission) => (
                            <Badge key={permission} variant="outline">
                              {permission}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => copyToClipboard(apiKey.key)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="font-mono text-sm bg-muted p-2 rounded border">
                      {apiKey.key}
                    </div>
                    
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Last used: {apiKey.lastUsed}</span>
                      <span>Created: {apiKey.created}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workspaces" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Workspaces
                  </CardTitle>
                  <CardDescription>
                    Organize your projects and team access by workspace
                  </CardDescription>
                </div>
                <Button>
                  Create Workspace
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {workspaces.map((workspace) => (
                  <Card key={workspace.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{workspace.name}</CardTitle>
                          <CardDescription>{workspace.description}</CardDescription>
                        </div>
                        <Badge variant={workspace.status === "active" ? "default" : "secondary"}>
                          {workspace.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Members</span>
                          <span className="text-sm text-muted-foreground">{workspace.members}</span>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="flex-1">
                            Manage
                          </Button>
                          <Button variant="outline" size="sm" className="flex-1">
                            Settings
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Team Members
                  </CardTitle>
                  <CardDescription>
                    Manage team member access and permissions
                  </CardDescription>
                </div>
                <Button>
                  Invite Member
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {teamMembers.map((member) => (
                  <div key={member.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <h3 className="font-medium">{member.name}</h3>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{member.role}</Badge>
                          <Badge variant="secondary">{member.workspace}</Badge>
                          <Badge variant={member.status === "active" ? "default" : "secondary"}>
                            {member.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                        <Button variant="destructive" size="sm">
                          Remove
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-muted-foreground">
                      Last active: {member.lastActive}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}