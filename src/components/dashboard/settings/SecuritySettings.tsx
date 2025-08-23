import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Smartphone, Globe, Monitor, LogOut } from "lucide-react"
import { toast } from "sonner"

const activeSessions = [
  {
    id: "1",
    device: "MacBook Pro",
    location: "San Francisco, CA",
    ip: "192.168.1.1",
    lastActive: "2 minutes ago",
    current: true,
    icon: Monitor
  },
  {
    id: "2",
    device: "iPhone 14",
    location: "San Francisco, CA",
    ip: "192.168.1.2",
    lastActive: "1 hour ago",
    current: false,
    icon: Smartphone
  },
  {
    id: "3",
    device: "Chrome Browser",
    location: "New York, NY",
    ip: "203.0.113.1",
    lastActive: "3 days ago",
    current: false,
    icon: Globe
  }
]

export function SecuritySettings() {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)

  const handleToggle2FA = () => {
    if (!twoFactorEnabled) {
      // TODO: Implement 2FA setup flow
      toast.success("Two-factor authentication setup initiated")
    } else {
      // TODO: Implement 2FA disable flow
      toast.success("Two-factor authentication disabled")
    }
    setTwoFactorEnabled(!twoFactorEnabled)
  }

  const handleRevokeSession = (sessionId: string) => {
    // TODO: Implement session revocation
    toast.success("Session revoked successfully")
  }

  const handleRevokeAllSessions = () => {
    // TODO: Implement revoke all sessions
    toast.success("All other sessions revoked")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Security Settings</h1>
        <p className="text-muted-foreground">Manage your account security and active sessions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>Add an extra layer of security to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="2fa">Two-Factor Authentication</Label>
              <p className="text-sm text-muted-foreground">
                {twoFactorEnabled 
                  ? "Your account is protected with 2FA" 
                  : "Secure your account with 2FA using an authenticator app"
                }
              </p>
            </div>
            <Switch
              id="2fa"
              checked={twoFactorEnabled}
              onCheckedChange={handleToggle2FA}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>Manage devices that are currently signed in to your account</CardDescription>
            </div>
            <Button variant="outline" onClick={handleRevokeAllSessions}>
              Revoke All Other Sessions
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activeSessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <session.icon className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <div className="flex items-center space-x-2">
                      <p className="font-medium">{session.device}</p>
                      {session.current && <Badge variant="secondary">Current</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{session.location}</p>
                    <p className="text-xs text-muted-foreground">
                      {session.ip} • Last active {session.lastActive}
                    </p>
                  </div>
                </div>
                {!session.current && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRevokeSession(session.id)}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}