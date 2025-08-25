import { useState, useEffect } from "react"
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useFreePlanLimits } from "@/hooks/useFreePlanLimits"
import { useUserOrganization } from "@/hooks/useUserOrganization"
import { UpgradeModal } from "@/components/ui/UpgradeModal"
import { supabase } from "@/integrations/supabase/client"

interface Organization {
  id: string
  name: string
  slug?: string
}

export function OrgSwitcher() {
  const [open, setOpen] = useState(false)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false)
  const { canCreateOrganization, hasPendingBilling, isNonPaying } = useFreePlanLimits()
  const { organization, loading } = useUserOrganization()

  useEffect(() => {
    async function fetchOrganizations() {
      if (loading || !organization) return

      if (isNonPaying) {
        // Free users see only their single org
        const userOrg = { id: organization.id, name: organization.name }
        setOrganizations([userOrg])
        setSelectedOrg(userOrg)
      } else {
        // Paid users see all their orgs
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return

          // Get owned orgs
          const { data: ownedOrgs } = await supabase
            .from('organizations')
            .select('id, name')
            .eq('owner_user_id', user.id)

          // Get member orgs
          const { data: memberOrgs } = await supabase
            .from('organization_members')
            .select(`
              organizations!inner (
                id,
                name
              )
            `)
            .eq('user_id', user.id)
            .eq('seat_active', true)

          const allOrgs = [
            ...(ownedOrgs || []),
            ...(memberOrgs?.map(m => Array.isArray(m.organizations) ? m.organizations[0] : m.organizations) || [])
          ].filter((org, index, self) => 
            org && self.findIndex(o => o.id === org.id) === index
          ) as Organization[]

          setOrganizations(allOrgs)
          setSelectedOrg(organization ? { id: organization.id, name: organization.name } : allOrgs[0])
        } catch (error) {
          console.error('Error fetching organizations:', error)
          // Fallback to current org
          const userOrg = { id: organization.id, name: organization.name }
          setOrganizations([userOrg])
          setSelectedOrg(userOrg)
        }
      }
    }

    fetchOrganizations()
  }, [organization, loading, isNonPaying])

  const handleCreateOrganization = () => {
    if (!canCreateOrganization) {
      setUpgradeModalOpen(true)
      return
    }
    // TODO: Implement organization creation logic
    console.log("Creating new organization...")
  }

  if (loading || !selectedOrg) {
    return (
      <Button variant="outline" className="w-full justify-between" disabled>
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          <span>Loading...</span>
        </div>
      </Button>
    )
  }

  // For free users with only one org, don't show the dropdown
  if (isNonPaying && organizations.length === 1) {
    return (
      <Button variant="outline" className="w-full justify-between" disabled>
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          <span className="truncate">{selectedOrg.name}</span>
        </div>
      </Button>
    )
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="truncate">{selectedOrg.name}</span>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0">
          <Command>
            {!isNonPaying && <CommandInput placeholder="Search organizations..." />}
            <CommandList>
              <CommandEmpty>No organizations found.</CommandEmpty>
              <CommandGroup>
                {organizations.map((org) => (
                  <CommandItem
                    key={org.id}
                    value={org.id}
                    onSelect={() => {
                      setSelectedOrg(org)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedOrg.id === org.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      <span>{org.name}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              {!isNonPaying && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem 
                      onSelect={handleCreateOrganization}
                      disabled={!canCreateOrganization}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create Organization
                      {!canCreateOrganization && (
                        <span className="ml-auto text-xs text-muted-foreground">Upgrade</span>
                      )}
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <UpgradeModal
        open={upgradeModalOpen}
        onOpenChange={setUpgradeModalOpen}
        limitType="org_cap"
        hasPendingBilling={hasPendingBilling}
      />
    </>
  )
}