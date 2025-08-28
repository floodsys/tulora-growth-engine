import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PlayCircle, Phone, MessageSquare, BarChart3, Users, Star, ExternalLink, Contact } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export function DemoSandbox() {
  const [activeAgent, setActiveAgent] = useState("demo-agent-1")

  // Demo data - clearly labeled as sample
  const demoAgents = [
    {
      id: "demo-agent-1",
      name: "Sarah - Sales Pro",
      status: "Demo Only",
      description: "AI sales agent specialized in lead qualification and appointment setting",
      calls_today: 24,
      conversion_rate: 34,
      last_call: "2 minutes ago"
    },
    {
      id: "demo-agent-2", 
      name: "Marcus - Support Hero",
      status: "Demo Only",
      description: "Customer support agent handling inquiries and technical issues",
      calls_today: 18,
      conversion_rate: 89,
      last_call: "5 minutes ago"
    }
  ]

  const demoAnalytics = {
    total_calls: 156,
    qualified_leads: 47,
    meetings_scheduled: 23,
    revenue_pipeline: 145000
  }

  const demoConversations = [
    {
      id: 1,
      contact: "John Smith",
      agent: "Sarah",
      status: "Qualified",
      duration: "4:32",
      outcome: "Meeting scheduled for Thursday 2PM",
      time: "12 minutes ago"
    },
    {
      id: 2,
      contact: "Emma Johnson", 
      agent: "Marcus",
      status: "Resolved",
      duration: "2:18",
      outcome: "Issue resolved, customer satisfied",
      time: "28 minutes ago"
    },
    {
      id: 3,
      contact: "David Wilson",
      agent: "Sarah", 
      status: "Follow-up",
      duration: "6:45",
      outcome: "Requested product demo next week",
      time: "1 hour ago"
    }
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Demo Banner */}
      <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-b border-yellow-500/20">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Star className="h-5 w-5 text-yellow-600" />
              <div>
                <h1 className="font-semibold text-foreground">Demo Sandbox Environment</h1>
                <p className="text-sm text-muted-foreground">
                  This is a demonstration with sample data. No real calls will be made.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => window.location.href = '/contact'} variant="outline" size="sm">
                <Contact className="h-4 w-4 mr-2" />
                Contact Sales
              </Button>
              <Button onClick={() => window.location.href = '/signup'} size="sm">
                Start Free Trial
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Total Calls Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{demoAnalytics.total_calls}</div>
              <Badge variant="secondary" className="mt-1">Demo Data</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Qualified Leads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{demoAnalytics.qualified_leads}</div>
              <Badge variant="secondary" className="mt-1">Demo Data</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Meetings Scheduled
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{demoAnalytics.meetings_scheduled}</div>
              <Badge variant="secondary" className="mt-1">Demo Data</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Revenue Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${demoAnalytics.revenue_pipeline.toLocaleString()}</div>
              <Badge variant="secondary" className="mt-1">Demo Data</Badge>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="agents" className="space-y-6">
          <TabsList>
            <TabsTrigger value="agents">Demo Agents</TabsTrigger>
            <TabsTrigger value="conversations">Sample Conversations</TabsTrigger>
            <TabsTrigger value="analytics">Demo Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="agents" className="space-y-4">
            <Alert>
              <Star className="h-4 w-4" />
              <AlertDescription>
                These are demo AI agents with sample configurations. In the real product, you can create and customize your own agents.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {demoAgents.map((agent) => (
                <Card key={agent.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{agent.name}</CardTitle>
                      <Badge variant="outline">{agent.status}</Badge>
                    </div>
                    <CardDescription>{agent.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Calls Today</div>
                        <div className="font-medium">{agent.calls_today}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Success Rate</div>
                        <div className="font-medium">{agent.conversion_rate}%</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Last Call</div>
                        <div className="font-medium">{agent.last_call}</div>
                      </div>
                    </div>
                    <Button className="w-full mt-4" variant="outline" disabled>
                      <PlayCircle className="h-4 w-4 mr-2" />
                      Demo Agent (No Real Calls)
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="conversations" className="space-y-4">
            <Alert>
              <MessageSquare className="h-4 w-4" />
              <AlertDescription>
                Sample conversation logs showing how AI agents interact with leads. All data is fictional for demonstration purposes.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              {demoConversations.map((conversation) => (
                <Card key={conversation.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div>
                          <CardTitle className="text-base">{conversation.contact}</CardTitle>
                          <CardDescription>Agent: {conversation.agent} • {conversation.time}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{conversation.status}</Badge>
                        <Badge variant="outline">{conversation.duration}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{conversation.outcome}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <Alert>
              <BarChart3 className="h-4 w-4" />
              <AlertDescription>
                Sample analytics dashboard showing performance metrics. Real analytics include detailed reporting, conversion tracking, and ROI analysis.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Conversion Funnel (Demo)</CardTitle>
                  <CardDescription>Sample conversion rates from demo data</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Total Contacts</span>
                      <span className="font-medium">500</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Calls Connected</span>
                      <span className="font-medium">156 (31%)</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Qualified Leads</span>
                      <span className="font-medium">47 (30%)</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Meetings Scheduled</span>
                      <span className="font-medium">23 (49%)</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Agent Performance (Demo)</CardTitle>
                  <CardDescription>Sample performance metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Sarah - Sales Pro</span>
                      <Badge variant="secondary">34% success rate</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Marcus - Support Hero</span>
                      <Badge variant="secondary">89% satisfaction</Badge>
                    </div>
                    <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Real analytics include detailed call recordings, conversation analysis, sentiment tracking, and custom reporting.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* CTA Section */}
        <div className="mt-12 text-center">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Ready to Get Started?</CardTitle>
              <CardDescription>
                This demo shows a fraction of our capabilities. Get full access with a 14-day free trial.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button onClick={() => window.location.href = '/signup'} size="lg">
                Start Free Trial
              </Button>
              <Button onClick={() => window.location.href = '/contact'} variant="outline" size="lg">
                <ExternalLink className="h-4 w-4 mr-2" />
                Schedule Demo Call
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}