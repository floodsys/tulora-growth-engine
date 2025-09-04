import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Camera, Mail, Lock, User, Shield } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/integrations/supabase/client"

export function ProfileSettings() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || "")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  
  // Change email state
  const [newEmail, setNewEmail] = useState("")
  const [emailChangePassword, setEmailChangePassword] = useState("")
  const [isChangingEmail, setIsChangingEmail] = useState(false)
  const [emailChangeSuccess, setEmailChangeSuccess] = useState(false)
  const [emailChangeCountdown, setEmailChangeCountdown] = useState(0)
  const [emailErrors, setEmailErrors] = useState<{email?: string, password?: string}>({})

  // Countdown timer for email change
  useEffect(() => {
    if (emailChangeCountdown > 0) {
      const timer = setTimeout(() => setEmailChangeCountdown(emailChangeCountdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [emailChangeCountdown])

  const handleProfileUpdate = () => {
    // TODO: Implement profile update
    console.log("Profile updated successfully")
  }

  const handlePasswordUpdate = () => {
    if (newPassword !== confirmPassword) {
      console.log("Passwords do not match")
      return
    }
    // TODO: Implement password update
    console.log("Password updated successfully")
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
  }

  const validateEmailChange = () => {
    const errors: {email?: string, password?: string} = {}
    
    if (!newEmail) {
      errors.email = "New email address is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      errors.email = "Please enter a valid email address"
    } else if (newEmail === user?.email) {
      errors.email = "That's already your email"
    }
    
    if (!emailChangePassword) {
      errors.password = "Current password is required"
    }
    
    setEmailErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleEmailChange = async () => {
    if (!validateEmailChange() || !user) return
    
    setIsChangingEmail(true)
    setEmailErrors({})
    
    try {
      // First, re-authenticate the user
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: emailChangePassword
      })
      
      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          setEmailErrors({ password: "Incorrect password" })
        } else {
          toast({
            title: "Authentication failed",
            description: "Please check your password and try again.",
            variant: "destructive"
          })
        }
        return
      }
      
      // If re-auth succeeds, update the email
      const { error: updateError } = await supabase.auth.updateUser(
        { email: newEmail },
        { emailRedirectTo: `${window.location.origin}/auth/callback` }
      )
      
      if (updateError) {
        if (updateError.message.includes('User already registered')) {
          setEmailErrors({ email: "That email is already registered" })
        } else {
          toast({
            title: "Couldn't start email change",
            description: "Please try again.",
            variant: "destructive"
          })
        }
        return
      }
      
      // Success - show success state
      setEmailChangeSuccess(true)
      setEmailChangeCountdown(60)
      setNewEmail("")
      setEmailChangePassword("")
      
    } catch (error: any) {
      toast({
        title: "Couldn't start email change",
        description: "Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsChangingEmail(false)
    }
  }

  const handleResendEmailVerification = async () => {
    if (!user || emailChangeCountdown > 0) return
    
    try {
      setIsChangingEmail(true)
      const { error } = await supabase.auth.updateUser(
        { email: newEmail || user.email! },
        { emailRedirectTo: `${window.location.origin}/auth/callback` }
      )
      
      if (error) {
        toast({
          title: "Couldn't resend verification",
          description: "Please try again.",
          variant: "destructive"
        })
        return
      }
      
      setEmailChangeCountdown(60)
      toast({
        title: "Verification email sent",
        description: "Please check your email for the verification link."
      })
      
    } catch (error: any) {
      toast({
        title: "Couldn't resend verification",
        description: "Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsChangingEmail(false)
    }
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
              <AvatarImage src="" />
              <AvatarFallback>JD</AvatarFallback>
            </Avatar>
            <Button variant="outline" size="sm">
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

            <div>
              <Label htmlFor="currentEmail">Current Email Address</Label>
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
          </div>

          <Button onClick={handleProfileUpdate}>
            Update Profile
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Update your account password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="currentPassword">Current Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="pl-10"
                placeholder="Enter current password"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="newPassword">New Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pl-10"
                placeholder="Enter new password"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10"
                placeholder="Confirm new password"
              />
            </div>
          </div>

          <Button onClick={handlePasswordUpdate}>
            Update Password
          </Button>
        </CardContent>
      </Card>

      {/* Change Email Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Change Email
          </CardTitle>
          <CardDescription>
            Update your account email address
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {emailChangeSuccess ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-medium text-green-900 mb-2">Verification email sent</h3>
                <p className="text-sm text-green-700">
                  We've emailed {newEmail || user?.email} a verification link to finalize the change. 
                  Your login email will update after you click the link.
                </p>
              </div>
              
              {emailChangeCountdown > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Resend available in {emailChangeCountdown} seconds
                </p>
              ) : (
                <Button
                  variant="outline"
                  onClick={handleResendEmailVerification}
                  disabled={isChangingEmail}
                >
                  {isChangingEmail ? "Sending..." : "Resend verification email"}
                </Button>
              )}
              
              <Button
                variant="outline"
                onClick={() => {
                  setEmailChangeSuccess(false)
                  setEmailChangeCountdown(0)
                }}
              >
                Change different email
              </Button>
            </div>
          ) : (
            <>
              <div>
                <Label htmlFor="newEmail">New email address *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="newEmail"
                    type="email"
                    value={newEmail}
                    onChange={(e) => {
                      setNewEmail(e.target.value)
                      if (emailErrors.email) {
                        setEmailErrors(prev => ({ ...prev, email: undefined }))
                      }
                    }}
                    className={`pl-10 ${emailErrors.email ? "border-destructive" : ""}`}
                    placeholder="Enter new email address"
                  />
                </div>
                {emailErrors.email && (
                  <p className="text-xs text-destructive mt-1">{emailErrors.email}</p>
                )}
              </div>

              <div>
                <Label htmlFor="emailChangePassword">Current password *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="emailChangePassword"
                    type="password"
                    value={emailChangePassword}
                    onChange={(e) => {
                      setEmailChangePassword(e.target.value)
                      if (emailErrors.password) {
                        setEmailErrors(prev => ({ ...prev, password: undefined }))
                      }
                    }}
                    className={`pl-10 ${emailErrors.password ? "border-destructive" : ""}`}
                    placeholder="Enter current password"
                  />
                </div>
                {emailErrors.password && (
                  <p className="text-xs text-destructive mt-1">{emailErrors.password}</p>
                )}
              </div>

              <Button 
                onClick={handleEmailChange}
                disabled={isChangingEmail}
              >
                {isChangingEmail ? "Updating..." : "Update Email"}
              </Button>
            </>
          )}
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
    </div>
  )
}