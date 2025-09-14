import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Bot, Phone, BookOpen, History, Settings, Code, TestTube } from 'lucide-react'
import { RetellAgentsGrid } from './RetellAgentsGrid'
import { PhoneNumbersManagement } from './PhoneNumbersManagement'
import { KnowledgeBaseManagement } from './KnowledgeBaseManagement'
import { CallHistoryView } from './CallHistoryView'
import { WebCallTester } from './WebCallTester'
import { SecuritySettings } from './SecuritySettings'
import { WidgetGenerator } from './WidgetGenerator'
import { useRetellAgents } from '@/hooks/useRetellAgents'
import { useRetellKnowledgeBase } from '@/hooks/useRetellKnowledgeBase'
import { useRetellCalls } from '@/hooks/useRetellCalls'
import { useRetellNumbers } from '@/hooks/useRetellNumbers'
import { useUserOrganization } from '@/hooks/useUserOrganization'

export const RetellDashboard = () => {
  const { organization } = useUserOrganization()
  const { agents, loading: agentsLoading } = useRetellAgents(organization?.id)
  const { knowledgeBases, loading: kbLoading } = useRetellKnowledgeBase(organization?.id)
  const { calls, loading: callsLoading } = useRetellCalls(organization?.id)
  const { numbers, loading: numbersLoading } = useRetellNumbers(organization?.id)
  
  const [activeTab, setActiveTab] = useState('agents')

  const stats = [
    {
      title: 'Active Agents',
      value: agents?.filter(a => a.status === 'published').length || 0,
      total: agents?.length || 0,
      icon: Bot,
      color: 'text-primary'
    },
    {
      title: 'Phone Numbers',
      value: numbers?.filter(n => n.is_active).length || 0,
      total: numbers?.length || 0,
      icon: Phone,
      color: 'text-blue-600'
    },
    {
      title: 'Knowledge Bases',
      value: knowledgeBases?.filter(kb => kb.state === 'ready').length || 0,
      total: knowledgeBases?.length || 0,
      icon: BookOpen,
      color: 'text-green-600'
    },
    {
      title: 'Recent Calls',
      value: calls?.filter(c => c.status === 'completed').length || 0,
      total: calls?.length || 0,
      icon: History,
      color: 'text-purple-600'
    }
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Retell AI Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your AI agents, phone numbers, knowledge bases, and call history
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stat.value}
                {stat.total > 0 && (
                  <span className="text-sm text-muted-foreground ml-1">
                    / {stat.total}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="agents" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="numbers" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Numbers
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Knowledge
          </TabsTrigger>
          <TabsTrigger value="calls" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Calls
          </TabsTrigger>
          <TabsTrigger value="test" className="flex items-center gap-2">
            <TestTube className="h-4 w-4" />
            Test
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="widget" className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            Widget
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Agents</CardTitle>
              <CardDescription>
                Create and manage your AI agents. Agents are the source of truth for all interactions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RetellAgentsGrid />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="numbers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Phone Numbers</CardTitle>
              <CardDescription>
                Buy new numbers or import your own (BYOC). Bind numbers to agents for inbound/outbound calls.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PhoneNumbersManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="knowledge" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Knowledge Bases</CardTitle>
              <CardDescription>
                Create knowledge bases and add sources (files, URLs, text). Attach them to agents for enhanced responses.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <KnowledgeBaseManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calls" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Call History</CardTitle>
              <CardDescription>
                View call history, analysis data, and detailed call information.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CallHistoryView />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Web Call Testing</CardTitle>
              <CardDescription>
                Test your agents with one-click web calls directly in the dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WebCallTester />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Privacy & Security</CardTitle>
              <CardDescription>
                Configure data storage settings, domain restrictions, and security options.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SecuritySettings />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="widget" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Website Widget</CardTitle>
              <CardDescription>
                Generate embed snippets for chat and callback widgets with domain restrictions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WidgetGenerator />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}