import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { CheckCircle, XCircle, AlertCircle, Mail, Database, RefreshCw } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

interface CRMConnectionStatus {
  ok: boolean
  mode?: string
  message?: string
  expires_in_seconds?: number
  api_ping?: {
    status: number
    message: string
  }
}

interface TestResult {
  ok: boolean
  error?: string
  detail?: string
  loading?: boolean
}

export function AdminCRMHealthCard() {
  const [crmStatus, setCrmStatus] = useState<CRMConnectionStatus | null>(null)
  const [crmLoading, setCrmLoading] = useState(false)
  const [emailTest, setEmailTest] = useState<TestResult>({ ok: false })
  const [leadSyncTest, setLeadSyncTest] = useState<TestResult>({ ok: false })
  const { toast } = useToast()

  // Test CRM connection on mount
  useEffect(() => {
    testCRMConnection()
  }, [])

  const testCRMConnection = async () => {
    setCrmLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('test-suitecrm-connection', {
        headers: {
          'x-admin-request': '1'
        }
      })

      if (error) throw error

      setCrmStatus(data)
    } catch (error) {
      console.error('CRM connection test failed:', error)
      setCrmStatus({
        ok: false,
        message: error instanceof Error ? error.message : 'Connection test failed'
      })
    } finally {
      setCrmLoading(false)
    }
  }

  const testEmailSending = async () => {
    setEmailTest({ ok: false, loading: true })
    
    try {
      const { data, error } = await supabase.functions.invoke('send-test-email', {
        method: 'POST',
        headers: {
          'x-admin-request': '1'
        },
        body: {
          to: '', // Will use HELLO_INBOX default
          subject: 'Admin Diagnostics Test',
          html: '<p>This is a test email from the admin diagnostics panel.</p>'
        }
      })

      if (error) throw error

      setEmailTest({ ok: data.ok, loading: false })
      
      if (data.ok) {
        toast({
          title: "Email Test Successful",
          description: "Test email sent successfully",
        })
      } else {
        toast({
          title: "Email Test Failed",
          description: data.detail || data.error || "Unknown error",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Email test failed:', error)
      setEmailTest({ 
        ok: false, 
        loading: false,
        error: error instanceof Error ? error.message : 'Email test failed' 
      })
      toast({
        title: "Email Test Failed",
        description: error instanceof Error ? error.message : 'Email test failed',
        variant: "destructive"
      })
    }
  }

  const syncLatestLead = async () => {
    setLeadSyncTest({ ok: false, loading: true })
    
    try {
      // Get the most recent lead
      const { data: leads, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)

      if (leadError) throw leadError
      if (!leads || leads.length === 0) {
        throw new Error('No leads found to sync')
      }

      const latestLead = leads[0]
      
      // Sync the lead
      const { data, error } = await supabase.functions.invoke('suitecrm-sync', {
        method: 'POST',
        headers: {
          'x-admin-request': '1'
        },
        body: latestLead
      })

      if (error) throw error

      setLeadSyncTest({ ok: data.ok, loading: false })
      
      if (data.ok) {
        toast({
          title: "Lead Sync Successful",
          description: `Synced lead: ${latestLead.email}`,
        })
      } else {
        toast({
          title: "Lead Sync Failed",
          description: data.error || "Unknown sync error",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Lead sync test failed:', error)
      setLeadSyncTest({ 
        ok: false, 
        loading: false,
        error: error instanceof Error ? error.message : 'Lead sync failed' 
      })
      toast({
        title: "Lead Sync Failed",
        description: error instanceof Error ? error.message : 'Lead sync failed',
        variant: "destructive"
      })
    }
  }

  const formatExpiryTime = (seconds?: number) => {
    if (!seconds) return ''
    
    if (seconds > 3600) {
      const hours = Math.floor(seconds / 3600)
      return `${hours}h`
    } else if (seconds > 60) {
      const minutes = Math.floor(seconds / 60)
      return `${minutes}m`
    } else {
      return `${seconds}s`
    }
  }

  const StatusIcon = ({ ok, loading }: { ok: boolean; loading?: boolean }) => {
    if (loading) return <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
    return ok ? (
      <CheckCircle className="h-4 w-4 text-green-600" />
    ) : (
      <XCircle className="h-4 w-4 text-red-600" />
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          System Diagnostics
        </CardTitle>
        <CardDescription>
          Test integrations and system health
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* CRM Connection Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">SuiteCRM Connection</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={testCRMConnection}
              disabled={crmLoading}
            >
              {crmLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Re-run Test
            </Button>
          </div>

          {crmStatus && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <StatusIcon ok={crmStatus.ok} loading={crmLoading} />
                {crmStatus.ok ? (
                  <span className="text-sm">
                    ✅ Connected — token ok 
                    {crmStatus.expires_in_seconds && (
                      <span className="text-muted-foreground">
                        {' '}(expires in ~{formatExpiryTime(crmStatus.expires_in_seconds)})
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-sm text-red-600">
                    ❌ Connection failed: {crmStatus.message}
                  </span>
                )}
              </div>

              {crmStatus.mode && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    Auth: {crmStatus.mode}
                  </Badge>
                </div>
              )}

              {crmStatus.api_ping && (
                <div className="text-sm text-muted-foreground">
                  API Ping: {crmStatus.api_ping.status} - {crmStatus.api_ping.message}
                </div>
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* Quick Tests */}
        <div className="space-y-4">
          <h4 className="font-medium">Quick Tests</h4>
          
          {/* Email Test */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusIcon ok={emailTest.ok} loading={emailTest.loading} />
              <span className="text-sm">Email Service</span>
              {emailTest.error && (
                <span className="text-xs text-red-600">({emailTest.error})</span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={testEmailSending}
              disabled={emailTest.loading}
            >
              {emailTest.loading ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Send Test Email
            </Button>
          </div>

          {/* Lead Sync Test */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusIcon ok={leadSyncTest.ok} loading={leadSyncTest.loading} />
              <span className="text-sm">Lead Sync</span>
              {leadSyncTest.error && (
                <span className="text-xs text-red-600">({leadSyncTest.error})</span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={syncLatestLead}
              disabled={leadSyncTest.loading}
            >
              {leadSyncTest.loading ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Database className="h-4 w-4 mr-2" />
              )}
              Sync Latest Lead to CRM
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}