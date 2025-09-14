import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Lock, Shield } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/integrations/supabase/client"

interface ChangePasswordModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ChangePasswordModal({ open, onOpenChange }: ChangePasswordModalProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordErrors, setPasswordErrors] = useState<{current?: string, new?: string, confirm?: string}>({})
  const [showPasswordSuccess, setShowPasswordSuccess] = useState(false)

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
      
      // Hide success banner and close modal after 2 seconds
      setTimeout(() => {
        setShowPasswordSuccess(false)
        onOpenChange(false)
      }, 2000)
      
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

  const handleClose = () => {
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setPasswordErrors({})
    setShowPasswordSuccess(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Change Password
          </DialogTitle>
          <DialogDescription>
            Update your account password
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {showPasswordSuccess && (
            <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-success" />
                <h3 className="font-medium text-success">Password updated successfully</h3>
              </div>
              <p className="text-sm text-success/80">
                For security, please sign in again on other devices.
              </p>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current password *</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10" />
              <PasswordInput
                id="currentPassword"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value)
                  if (passwordErrors.current) {
                    setPasswordErrors(prev => ({ ...prev, current: undefined }))
                  }
                }}
                className={passwordErrors.current ? "border-destructive pl-10" : "pl-10"}
                placeholder="Enter current password"
                autoComplete="current-password"
                showIcon={true}
              />
            </div>
            {passwordErrors.current && (
              <p className="text-xs text-destructive mt-1">{passwordErrors.current}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">New password *</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10" />
              <PasswordInput
                id="newPassword"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value)
                  if (passwordErrors.new) {
                    setPasswordErrors(prev => ({ ...prev, new: undefined }))
                  }
                }}
                className={passwordErrors.new ? "border-destructive pl-10" : "pl-10"}
                placeholder="Enter new password"
                autoComplete="new-password"
                showIcon={true}
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
                      strength === 'weak' ? 'text-destructive' : 
                      strength === 'medium' ? 'text-warning' : 
                      'text-success'
                    }`}>
                      {message}
                    </p>
                  )
                })()}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password *</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10" />
              <PasswordInput
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  if (passwordErrors.confirm) {
                    setPasswordErrors(prev => ({ ...prev, confirm: undefined }))
                  }
                }}
                className={passwordErrors.confirm ? "border-destructive pl-10" : "pl-10"}
                placeholder="Confirm new password"
                autoComplete="new-password"
                showIcon={true}
              />
            </div>
            {passwordErrors.confirm && (
              <p className="text-xs text-destructive mt-1">{passwordErrors.confirm}</p>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              onClick={handlePasswordUpdate}
              disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
              className="flex-1 relative"
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}