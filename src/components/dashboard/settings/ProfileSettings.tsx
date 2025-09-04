import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Camera, Mail, Lock, Shield } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { ChangePasswordModal } from "./ChangePasswordModal"
import { ChangeEmailModal } from "./ChangeEmailModal"
import { ChangePhotoModal } from "./ChangePhotoModal"

export function ProfileSettings() {
  const { user } = useAuth()
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || "")
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false)

  // Get user's initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const handleProfileUpdate = () => {
    // TODO: Implement profile update
    console.log("Profile updated successfully")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Profile Settings</h1>
        <p className="text-muted-foreground">Manage your personal profile information</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your profile details and photo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center space-x-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={user?.user_metadata?.avatar_url || ""} />
              <AvatarFallback className="text-lg font-medium">
                {getInitials(fullName || user?.email?.charAt(0).toUpperCase() || "U")}
              </AvatarFallback>
            </Avatar>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsPhotoModalOpen(true)}
            >
              <Camera className="h-4 w-4 mr-2" />
              Change Photo
            </Button>
          </div>

          <div className="grid gap-4">
            <div>
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1 mr-4">
                <Label htmlFor="currentEmail">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="currentEmail"
                    value={user?.email || ""}
                    disabled
                    className="pl-10"
                  />
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsEmailModalOpen(true)}
                className="mt-6"
              >
                Change Email
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1 mr-4">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value="••••••••••"
                    disabled
                    className="pl-10"
                  />
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsPasswordModalOpen(true)}
                className="mt-6"
              >
                Change Password
              </Button>
            </div>
          </div>

          <Button onClick={handleProfileUpdate}>
            Update Profile
          </Button>
        </CardContent>
      </Card>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Account Information
          </CardTitle>
          <CardDescription>
            View your account details and security information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>User ID</Label>
              <div className="bg-muted p-2 rounded text-sm font-mono">
                {user?.id}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Account Created</Label>
              <div className="bg-muted p-2 rounded text-sm">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email Verified</Label>
            <div className="bg-muted p-2 rounded text-sm">
              {user?.email_confirmed_at ? 'Yes' : 'No'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <ChangePasswordModal 
        open={isPasswordModalOpen} 
        onOpenChange={setIsPasswordModalOpen} 
      />
      <ChangeEmailModal 
        open={isEmailModalOpen} 
        onOpenChange={setIsEmailModalOpen} 
      />
      <ChangePhotoModal 
        open={isPhotoModalOpen} 
        onOpenChange={setIsPhotoModalOpen} 
      />
    </div>
  )
}