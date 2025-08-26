import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserOrganization } from '@/hooks/useUserOrganization';

export function OrgConstraintTester() {
  const { toast } = useToast();
  const { organization } = useUserOrganization();
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const testFieldConstraints = async () => {
    if (!organization) return;
    
    setTesting(true);
    const testResults: any[] = [];
    
    console.log('🔬 STEP 5: Testing Organization Column Constraints');
    
    // Quick Gotcha Checks First
    try {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('🚨 GOTCHA CHECKS:');
      
      // Check user membership details
      const { data: membership } = await supabase
        .from('organization_members')
        .select('role, seat_active')
        .eq('organization_id', organization.id)
        .eq('user_id', user?.id)
        .single();
      
      console.log('- User membership:', {
        found: !!membership,
        role: membership?.role,
        seat_active: membership?.seat_active,
        role_type: typeof membership?.role
      });
      
      // Check organization ownership
      const { data: orgOwner } = await supabase
        .from('organizations')
        .select('owner_user_id')
        .eq('id', organization.id)
        .single();
      
      console.log('- Organization ownership:', {
        current_user_id: user?.id,
        owner_user_id: orgOwner?.owner_user_id,
        is_owner: user?.id === orgOwner?.owner_user_id
      });
      
      // Check if check_org_member_access function exists
      try {
        const { data: memberAccessTest } = await supabase.rpc('check_org_member_access', {
          target_org_id: organization.id,
          target_user_id: user?.id
        });
        console.log('- check_org_member_access function: EXISTS, returns:', memberAccessTest);
      } catch (funcError: any) {
        console.log('- check_org_member_access function: MISSING or ERROR:', funcError.message);
      }
      
    } catch (err) {
      console.log('🚨 Gotcha check failed:', err);
    }
    
    // Test 1: Name only (basic test)
    try {
      console.log('Testing: name only...');
      const { data, error } = await supabase
        .from('organizations')
        .update({ name: organization.name + ' TEST' })
        .eq('id', organization.id)
        .select();
      
      testResults.push({
        test: 'Name Update',
        status: error ? 'FAILED' : 'SUCCESS',
        error: error?.message || null,
        data: data
      });
      
      if (!error) {
        // Revert the change
        await supabase
          .from('organizations')
          .update({ name: organization.name })
          .eq('id', organization.id);
      }
    } catch (err: any) {
      testResults.push({
        test: 'Name Update',
        status: 'ERROR',
        error: err.message
      });
    }

    // Test 2: Website constraint
    try {
      console.log('Testing: website constraint...');
      const { error } = await supabase
        .from('organizations')
        .update({ website: 'https://test-website.example.com' })
        .eq('id', organization.id);
      
      testResults.push({
        test: 'Website Update',
        status: error ? 'FAILED' : 'SUCCESS',
        error: error?.message || null
      });
    } catch (err: any) {
      testResults.push({
        test: 'Website Update',
        status: 'ERROR',
        error: err.message
      });
    }

    // Test 3: Industry constraint
    try {
      console.log('Testing: industry constraint...');
      const { error } = await supabase
        .from('organizations')
        .update({ industry: 'Technology' })
        .eq('id', organization.id);
      
      testResults.push({
        test: 'Industry Update',
        status: error ? 'FAILED' : 'SUCCESS',
        error: error?.message || null
      });
    } catch (err: any) {
      testResults.push({
        test: 'Industry Update',
        status: 'ERROR',
        error: err.message
      });
    }

    // Test 4: Size band constraint
    try {
      console.log('Testing: size_band constraint...');
      const { error } = await supabase
        .from('organizations')
        .update({ size_band: '1-10' })
        .eq('id', organization.id);
      
      testResults.push({
        test: 'Size Band Update',
        status: error ? 'FAILED' : 'SUCCESS',
        error: error?.message || null
      });
    } catch (err: any) {
      testResults.push({
        test: 'Size Band Update',
        status: 'ERROR',
        error: err.message
      });
    }

    // Test 5: Check RLS permissions
    try {
      console.log('Testing: RLS permissions...');
      const { data: adminCheck } = await supabase.rpc('check_admin_access', {
        p_org_id: organization.id
      });
      
      const { data: memberCheck } = await supabase.rpc('check_org_membership', {
        p_org_id: organization.id
      });
      
      testResults.push({
        test: 'RLS Permissions',
        status: 'INFO',
        data: {
          has_admin_access: adminCheck,
          has_member_access: memberCheck
        }
      });
    } catch (err: any) {
      testResults.push({
        test: 'RLS Permissions',
        status: 'ERROR',
        error: err.message
      });
    }

    setResults(testResults);
    setTesting(false);
    
    console.log('🔬 Constraint Test Results:', testResults);
    
    toast({
      title: "Constraint tests completed",
      description: `Ran ${testResults.length} tests. Check console for details.`,
    });
  };

  if (!organization) {
    return <div>No organization found</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>🔬 Organization Constraint Tester</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Organization ID</Label>
          <div className="bg-muted p-2 rounded text-sm font-mono">
            {organization.id}
          </div>
        </div>
        
        <Button 
          onClick={testFieldConstraints}
          disabled={testing}
          variant="outline"
        >
          {testing ? "Testing Constraints..." : "Test Field Constraints"}
        </Button>

        {results.length > 0 && (
          <div className="space-y-2">
            <Label>Test Results</Label>
            <div className="space-y-1">
              {results.map((result, index) => (
                <div 
                  key={index} 
                  className={`p-2 rounded text-sm ${
                    result.status === 'SUCCESS' ? 'bg-green-100 text-green-800' :
                    result.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                    result.status === 'ERROR' ? 'bg-red-100 text-red-800' :
                    'bg-blue-100 text-blue-800'
                  }`}
                >
                  <strong>{result.test}:</strong> {result.status}
                  {result.error && <div className="text-xs mt-1">Error: {result.error}</div>}
                  {result.data && <div className="text-xs mt-1">Data: {JSON.stringify(result.data)}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}