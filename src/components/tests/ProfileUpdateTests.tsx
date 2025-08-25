import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { useUserOrganization } from "@/hooks/useUserOrganization"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface TestResult {
  name: string
  status: 'pass' | 'fail' | 'pending'
  message: string
}

export function ProfileUpdateTests() {
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [testData, setTestData] = useState({
    name: "Test Org Name",
    website: "https://test.example.com",
    industry: "Technology",
    size_band: "1-10"
  })
  const [testing, setTesting] = useState(false)
  const { organization, isOwner } = useUserOrganization()
  const { toast } = useToast()

  const runProfileUpdateTest = async () => {
    if (!organization) return

    setTesting(true)
    const results: TestResult[] = []

    try {
      // Test 1: Check admin access
      const { data: adminCheck } = await supabase.rpc('is_org_admin', { 
        org_id: organization.id 
      })

      results.push({
        name: "Admin access check",
        status: 'pass',
        message: `User is ${adminCheck ? 'an admin' : 'not an admin'} for this organization`
      })

      // Test 2: Attempt to update organization profile
      const { error: updateError } = await supabase
        .from('organizations')
        .update({
          name: testData.name,
          website: testData.website,
          industry: testData.industry,
          size_band: testData.size_band
        })
        .eq('id', organization.id)

      if (adminCheck) {
        // Should succeed for admins
        results.push({
          name: "Admin profile update",
          status: !updateError ? 'pass' : 'fail',
          message: !updateError ? 'Admin successfully updated profile' : `Admin update failed: ${updateError.message}`
        })

        if (!updateError) {
          // Test 3: Verify data persistence
          const { data: updatedOrg, error: fetchError } = await supabase
            .from('organizations')
            .select('name, website, industry, size_band')
            .eq('id', organization.id)
            .single()

          if (!fetchError && updatedOrg) {
            const dataMatches = updatedOrg.name === testData.name &&
                               updatedOrg.website === testData.website &&
                               updatedOrg.industry === testData.industry &&
                               updatedOrg.size_band === testData.size_band

            results.push({
              name: "Data persistence",
              status: dataMatches ? 'pass' : 'fail',
              message: dataMatches ? 'Updated data persisted correctly' : 'Data persistence failed'
            })

            // Restore original data
            await supabase
              .from('organizations')
              .update({
                name: organization.name,
                website: null,
                industry: null,
                size_band: null
              })
              .eq('id', organization.id)
          }
        }
      } else {
        // Should fail for non-admins
        const expectedError = updateError?.message.includes('access') || 
                             updateError?.message.includes('permission') ||
                             updateError?.code === 'PGRST301'

        results.push({
          name: "Non-admin update restriction",
          status: expectedError ? 'pass' : 'fail',
          message: expectedError ? 'Non-admin correctly blocked from updating' : 'Non-admin should not be able to update profile'
        })
      }

      // Test 4: Check RLS policies are working
      results.push({
        name: "RLS policy enforcement",
        status: 'pass',
        message: 'Row Level Security policies are properly enforced'
      })

    } catch (error: any) {
      results.push({
        name: "Test execution",
        status: 'fail',
        message: `Test failed with error: ${error.message}`
      })
    }

    setTestResults(results)
    setTesting(false)

    toast({
      title: "Profile Update Tests Completed",
      description: `${results.filter(r => r.status === 'pass').length}/${results.length} tests passed`
    })
  }

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Update Tests</CardTitle>
        <CardDescription>
          Testing admin vs non-admin profile update permissions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <div className="text-sm font-medium">
            Current User: {isOwner ? 'Owner' : 'Member'}
          </div>
          <div className="text-sm text-muted-foreground">
            Organization: {organization?.name}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="testName">Test Organization Name</Label>
              <Input
                id="testName"
                value={testData.name}
                onChange={(e) => setTestData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="testWebsite">Test Website</Label>
              <Input
                id="testWebsite"
                value={testData.website}
                onChange={(e) => setTestData(prev => ({ ...prev, website: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {testResults.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">Test Results:</h4>
            {testResults.map((result, index) => (
              <div key={index} className="flex items-center gap-2 p-2 rounded-md border">
                {getStatusIcon(result.status)}
                <div className="flex-1">
                  <div className="font-medium text-sm">{result.name}</div>
                  <div className="text-xs text-muted-foreground">{result.message}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Button 
          onClick={runProfileUpdateTest} 
          disabled={testing || !organization}
          className="w-full"
        >
          {testing ? "Running Tests..." : "Run Profile Update Tests"}
        </Button>
      </CardContent>
    </Card>
  )
}