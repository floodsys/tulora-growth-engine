import { useState } from "react"
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
import { UpgradeModal } from "@/components/ui/UpgradeModal"

interface Organization {
  id: string
  name: string
  slug: string
}

const mockOrgs: Organization[] = [
  { id: "1", name: "Acme Corp", slug: "acme" },
  { id: "2", name: "TechStart Inc", slug: "techstart" },
  { id: "3", name: "Global Solutions", slug: "global" },
]

export function OrgSwitcher() {
  const [open, setOpen] = useState(false)
  const [selectedOrg, setSelectedOrg] = useState<Organization>(mockOrgs[0])
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false)
  const { canCreateOrganization, hasPendingBilling } = useFreePlanLimits()

  const handleCreateOrganization = () => {
    if (!canCreateOrganization) {
      setUpgradeModalOpen(true)
      return
    }
    // TODO: Implement organization creation logic
    console.log("Creating new organization...")
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
            <CommandInput placeholder="Search organizations..." />
            <CommandList>
              <CommandEmpty>No organizations found.</CommandEmpty>
              <CommandGroup>
                {mockOrgs.map((org) => (
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