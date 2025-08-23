import { User, Building2, LogOut, Settings } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/contexts/AuthContext"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface ProfileAvatarProps {
  activeScreen: string
  setActiveScreen: (screen: string) => void
}

export function ProfileAvatar({ activeScreen, setActiveScreen }: ProfileAvatarProps) {
  const { user, signOut } = useAuth()

  // TODO: Get user role from auth context - for now assume owner
  const isOwner = true

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }


  const getUserInitials = () => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name
        .split(' ')
        .map((name: string) => name[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    return user?.email?.slice(0, 2).toUpperCase() || "U"
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost" 
            className="h-auto w-full justify-start rounded-sm p-2 hover:bg-muted/50"
          >
            <div className="flex items-center gap-3 w-full">
              <div className="h-8 w-8 bg-muted rounded-sm flex items-center justify-center text-sm font-medium flex-shrink-0">
                {user?.user_metadata?.avatar_url ? (
                  <img 
                    src={user.user_metadata.avatar_url} 
                    alt="Profile"
                    className="h-full w-full object-cover rounded-sm"
                  />
                ) : (
                  <span className="text-muted-foreground">{getUserInitials()}</span>
                )}
              </div>
              <span className="text-sm font-medium text-foreground truncate">
                {user?.user_metadata?.full_name || user?.email || "User"}
              </span>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          className="w-56 mb-2 ml-2 bg-background border shadow-lg" 
          align="start"
          side="top"
          sideOffset={8}
        >
          <div className="px-3 py-2">
            <p className="text-sm font-medium">{user?.user_metadata?.full_name || "User"}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => setActiveScreen("profile-settings")}
            className="cursor-pointer"
          >
            <User className="mr-2 h-4 w-4" />
            <span>Profile Settings</span>
          </DropdownMenuItem>
          {isOwner && (
            <DropdownMenuItem 
              onClick={() => setActiveScreen("organization-settings")}
              className="cursor-pointer"
            >
              <Building2 className="mr-2 h-4 w-4" />
              <span>Organization Settings</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem 
            onClick={() => setActiveScreen("settings")}
            className="cursor-pointer"
          >
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={handleSignOut}
            className="cursor-pointer text-destructive focus:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log Out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

    </>
  )
}