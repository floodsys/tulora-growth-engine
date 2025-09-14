import { User, Building2, LogOut, Settings, Users } from "lucide-react"
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
import { useOrganizationRole } from "@/hooks/useOrganizationRole"
import { useUserOrganization } from "@/hooks/useUserOrganization"
import { useNavigate } from "react-router-dom"

interface ProfileAvatarProps {
  activeScreen: string
  setActiveScreen: (screen: string) => void
}

export function ProfileAvatar({ activeScreen, setActiveScreen }: ProfileAvatarProps) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  
  const { organizationId, isOwner } = useUserOrganization()
  const { isAdmin } = useOrganizationRole(organizationId || undefined)

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/')
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
            className="h-auto w-full justify-start rounded-sm p-2 hover:bg-muted"
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
                {user?.user_metadata?.full_name || "User"}
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
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer text-muted-foreground">
            <User className="mr-2 h-4 w-4" />
            <span>Profile Settings (Coming Soon)</span>
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