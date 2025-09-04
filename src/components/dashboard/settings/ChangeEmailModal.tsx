import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Mail, Lock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/integrations/supabase/client"

interface ChangeEmailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ChangeEmailModal({ open, onOpenChange }: ChangeEmailModalProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  
  const [newEmail, setNewEmail] = useState("")
  const [emailChangePassword, setEmailChangePassword] = useState("")
  const [isChangingEmail, setIsChangingEmail] = useState(false)
  const [emailChangeSuccess, setEmailChangeSuccess] = useState(false)
  const [emailChangeCountdown, setEmailChangeCountdown] = useState(0)
  const [emailErrors, setEmailErrors] = useState<{email?: string, password?: string}>({})
  const [pendingEmailChange, setPendingEmailChange] = useState("")

  // Countdown timer for email change
  useEffect(() => {
    if (emailChangeCountdown > 0) {
      const timer = setTimeout(() => setEmailChangeCountdown(emailChangeCountdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [emailChangeCountdown])

  const validateEmailChange = () => {
    const errors: {email?: string, password?: string} = {}
    
    if (!newEmail) {
      errors.email = "New email address is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      errors.email = "Please enter a valid email address"
    } else if (newEmail.toLowerCase().trim() === user?.email?.toLowerCase().trim()) {
      errors.email = "That's already your current email address"
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
        console.error('Sign-in error:', signInError)
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
      
      // If re-auth succeeds, update the email with proper redirect URL
      const { error: updateError } = await supabase.auth.updateUser(
        { email: newEmail },
        { 
          emailRedirectTo: `${window.location.origin}/auth/callback` 
        }
      )
      
      if (updateError) {
        console.error('Update error:', updateError)
        if (updateError.message.includes('already registered')) {
          setEmailErrors({ email: "That email is already registered" })
        } else if (updateError.message.includes('invalid')) {
          setEmailErrors({ email: "Please enter a valid email address" })
        } else {
          toast({
            title: "Couldn't start email change",
            description: updateError.message || "Please try again.",
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

  const handleClose = () => {
    setNewEmail("")
    setEmailChangePassword("")
    setEmailErrors({})
    setEmailChangeSuccess(false)
    setEmailChangeCountdown(0)
    setPendingEmailChange("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Change Email
          </DialogTitle>
          <DialogDescription>
            Update your account email address
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {emailChangeSuccess ? (
            <div className="space-y-4">
              <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
                <h3 className="font-medium text-success mb-2">Verification email sent</h3>
                <p className="text-sm text-success/80 mb-3">
                  We've emailed {pendingEmailChange} a verification link to finalize the change. 
                  Your login email will update after you click the link.
                </p>
                
                <div className="text-sm text-success mb-2">
                  Didn't get the email? <button 
                    onClick={handleResendEmailVerification}
                    disabled={isChangingEmail || emailChangeCountdown > 0}
                    className="underline hover:no-underline disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isChangingEmail ? "Sending..." : emailChangeCountdown > 0 ? `Resend in ${emailChangeCountdown}s` : "Click here to resend"}
                  </button>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEmailChangeSuccess(false)
                    setEmailChangeCountdown(0)
                    setPendingEmailChange("")
                  }}
                  className="flex-1"
                >
                  Change different email
                </Button>
                <Button
                  onClick={handleClose}
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
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

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleEmailChange}
                  disabled={isChangingEmail || !newEmail || !emailChangePassword}
                  className="flex-1 relative"
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
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}