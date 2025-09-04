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
  const [profileData, setProfileData] = useState<any>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  
  // Change password state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordErrors, setPasswordErrors] = useState<{current?: string, new?: string, confirm?: string}>({})
  const [showPasswordSuccess, setShowPasswordSuccess] = useState(false)
  
  // Change email state
  const [newEmail, setNewEmail] = useState("")
  const [emailChangePassword, setEmailChangePassword] = useState("")
  const [isChangingEmail, setIsChangingEmail] = useState(false)
  const [emailChangeSuccess, setEmailChangeSuccess] = useState(false)
  const [emailChangeCountdown, setEmailChangeCountdown] = useState(0)
  const [emailErrors, setEmailErrors] = useState<{email?: string, password?: string}>({})
  const [pendingEmailChange, setPendingEmailChange] = useState("")

  // Load profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return
      
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_name, organization_size, industry')
          .eq('user_id', user.id)
          .single()
        
        setProfileData(profile)
      } catch (error) {
        console.error('Error loading profile:', error)
      } finally {
        setIsLoadingProfile(false)
      }
    }
    
    loadProfile()
  }, [user])

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

  const getPasswordStrength = (password: string) => {
    if (password.length < 8) return { strength: 'weak', message: 'At least 8 characters required' }
    if (password.length < 12) return { strength: 'medium', message: 'Consider a longer password' }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) return { strength: 'medium', message: 'Add uppercase, lowercase, and numbers' }
    return { strength: 'strong', message: 'Strong password' }
  }

  const validatePasswordChange = () => {
    const errors: {current?: string, new?: string, confirm?: string} = {}
    
    if (!currentPassword) {
      errors.current = "Current password is required"
    }
    
    if (!newPassword) {
      errors.new = "New password is required"
    } else if (newPassword.length < 8) {
      errors.new = "Password must be at least 8 characters"
    }
    
    if (!confirmPassword) {
      errors.confirm = "Please confirm your new password"
    } else if (newPassword !== confirmPassword) {
      errors.confirm = "Passwords do not match"
    }
    
    setPasswordErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handlePasswordUpdate = async () => {
    if (!validatePasswordChange() || !user) return
    
    setIsChangingPassword(true)
    setPasswordErrors({})
    setShowPasswordSuccess(false)
    
    try {
      // First, re-authenticate the user
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: currentPassword
      })
      
      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          setPasswordErrors({ current: "Incorrect password" })
        } else {
          toast({
            title: "Authentication failed",
            description: "Please check your current password and try again.",
            variant: "destructive"
          })
        }
        return
      }
      
      // If re-auth succeeds, update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      })
      
      if (updateError) {
        if (updateError.message.includes('Password should be at least')) {
          setPasswordErrors({ new: "Choose a stronger password" })
        } else {
          toast({
            title: "Couldn't update password",
            description: "Please try again.",
            variant: "destructive"
          })
        }
        return
      }
      
      // Success - clear fields and show success
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setShowPasswordSuccess(true)
      
      toast({
        title: "Password updated",
        description: "Your password has been successfully updated."
      })
      
      // Hide success banner after 5 seconds
      setTimeout(() => setShowPasswordSuccess(false), 5000)
      
    } catch (error: any) {
      toast({
        title: "Couldn't update password",
        description: "Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsChangingPassword(false)
    }
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
      setPendingEmailChange(newEmail)
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
        { email: pendingEmailChange || user.email! },
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

      {/* Profile Snapshot Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Snapshot
          </CardTitle>
          <CardDescription>Your current profile information</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingProfile ? (
            <div className="space-y-3">
              <div className="h-4 bg-muted rounded animate-pulse"></div>
              <div className="h-4 bg-muted rounded animate-pulse w-2/3"></div>
              <div className="h-4 bg-muted rounded animate-pulse w-1/2"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Full Name</Label>
                <div className="font-medium">{user?.user_metadata?.full_name || "Not provided"}</div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Email Address</Label>
                <div className="font-medium">{user?.email}</div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Organization</Label>
                <div className="font-medium">{profileData?.organization_name || "Not provided"}</div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Organization Size</Label>
                <div className="font-medium">{profileData?.organization_size || "Not provided"}</div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Industry</Label>
                <div className="font-medium">{profileData?.industry || "Not provided"}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Change Password
          </CardTitle>
          <CardDescription>Update your account password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {showPasswordSuccess && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-blue-600" />
                <h3 className="font-medium text-blue-900">Password updated successfully</h3>
              </div>
              <p className="text-sm text-blue-700">
                For security, please sign in again on other devices.
              </p>
            </div>
          )}
          
          <div>
            <Label htmlFor="currentPassword">Current password *</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value)
                  if (passwordErrors.current) {
                    setPasswordErrors(prev => ({ ...prev, current: undefined }))
                  }
                }}
                className={`pl-10 ${passwordErrors.current ? "border-destructive" : ""}`}
                placeholder="Enter current password"
                autoComplete="current-password"
              />
            </div>
            {passwordErrors.current && (
              <p className="text-xs text-destructive mt-1">{passwordErrors.current}</p>
            )}
          </div>

          <div>
            <Label htmlFor="newPassword">New password *</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value)
                  if (passwordErrors.new) {
                    setPasswordErrors(prev => ({ ...prev, new: undefined }))
                  }
                }}
                className={`pl-10 ${passwordErrors.new ? "border-destructive" : ""}`}
                placeholder="Enter new password"
                autoComplete="new-password"
              />
            </div>
            {passwordErrors.new && (
              <p className="text-xs text-destructive mt-1">{passwordErrors.new}</p>
            )}
            {newPassword && (
              <div className="mt-1">
                {(() => {
                  const { strength, message } = getPasswordStrength(newPassword)
                  return (
                    <p className={`text-xs ${
                      strength === 'weak' ? 'text-red-600' : 
                      strength === 'medium' ? 'text-yellow-600' : 
                      'text-green-600'
                    }`}>
                      {message}
                    </p>
                  )
                })()}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="confirmPassword">Confirm new password *</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  if (passwordErrors.confirm) {
                    setPasswordErrors(prev => ({ ...prev, confirm: undefined }))
                  }
                }}
                className={`pl-10 ${passwordErrors.confirm ? "border-destructive" : ""}`}
                placeholder="Confirm new password"
                autoComplete="new-password"
              />
            </div>
            {passwordErrors.confirm && (
              <p className="text-xs text-destructive mt-1">{passwordErrors.confirm}</p>
            )}
          </div>

          <Button 
            onClick={handlePasswordUpdate}
            disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
            className="relative"
          >
            {isChangingPassword && (
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              </div>
            )}
            <span className={isChangingPassword ? "ml-6" : ""}>
              {isChangingPassword ? "Updating..." : "Update Password"}
            </span>
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
                <p className="text-sm text-green-700 mb-3">
                  We've emailed {pendingEmailChange} a verification link to finalize the change. 
                  Your login email will update after you click the link.
                </p>
                
                <div className="text-sm text-green-600 mb-2">
                  Didn't get the email? <button 
                    onClick={handleResendEmailVerification}
                    disabled={isChangingEmail || emailChangeCountdown > 0}
                    className="underline hover:no-underline disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isChangingEmail ? "Sending..." : emailChangeCountdown > 0 ? `Resend in ${emailChangeCountdown}s` : "Click here to resend"}
                  </button>
                </div>
              </div>
              
              <Button
                variant="outline"
                onClick={() => {
                  setEmailChangeSuccess(false)
                  setEmailChangeCountdown(0)
                  setPendingEmailChange("")
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
                disabled={isChangingEmail || !newEmail || !emailChangePassword}
                className="relative"
              >
                {isChangingEmail && (
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  </div>
                )}
                <span className={isChangingEmail ? "ml-6" : ""}>
                  {isChangingEmail ? "Updating..." : "Update Email"}
                </span>
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