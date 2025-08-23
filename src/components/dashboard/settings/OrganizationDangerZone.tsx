import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { AlertTriangle, Building2 } from "lucide-react"
// import { useToast } from "@/hooks/use-toast"

export function OrganizationDangerZone() {
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const orgName = "Acme Corporation" // This should come from your organization context

  const handleDeleteOrganization = () => {
    if (deleteConfirmation !== orgName) {
      console.log(`Please type "${orgName}" to confirm`)
      return
    }
    
    // TODO: Implement organization deletion
    // This should:
    // 1. Delete all organization data
    // 2. Remove all members
    // 3. Cancel subscription
    // 4. Delete organization permanently
    console.log("Organization deletion initiated")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Danger Zone</h1>
        <p className="text-muted-foreground">Irreversible and destructive actions for the organization</p>
      </div>

      <Card className="border-destructive">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">Delete Organization</CardTitle>
          </div>
          <CardDescription>
            Once you delete this organization, there is no going back. Please be certain.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-destructive/10 p-4 rounded-lg space-y-2">
            <h4 className="font-medium text-destructive">What happens when you delete this organization:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• All organization data will be permanently deleted</li>
              <li>• All agents, calls, and recordings will be removed</li>
              <li>• All knowledge base content will be deleted</li>
              <li>• All members will be removed from the organization</li>
              <li>• Active subscription will be canceled</li>
              <li>• All integrations will be disconnected</li>
              <li>• This action cannot be undone</li>
            </ul>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <Building2 className="h-4 w-4 text-yellow-600" />
              <h4 className="font-medium text-yellow-800">Organization: {orgName}</h4>
            </div>
            <p className="text-sm text-yellow-700 mt-1">
              This action will permanently delete all data associated with this organization.
            </p>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                Delete Organization
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>This action cannot be undone. This will permanently delete the <strong>{orgName}</strong> organization and all associated data.</p>
                  <p>Type <strong>{orgName}</strong> in the box below to confirm:</p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-4">
                <Label htmlFor="delete-confirmation">Organization Name</Label>
                <Input
                  id="delete-confirmation"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder={`Type "${orgName}" to confirm`}
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeleteConfirmation("")}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteOrganization}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete Organization
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  )
}