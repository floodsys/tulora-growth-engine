import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, BarChart3, Users, Clock, DollarSign, TrendingUp } from "lucide-react";

const DemoSandbox = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  
  // Mock demo data
  const demoStats = {
    totalCalls: 847,
    successfulBookings: 156,
    averageCallDuration: "4:23",
    conversionRate: "18.4%",
    revenue: "$78,400"
  };

  const demoCallHistory = [
    { id: 1, name: "Sarah Johnson", phone: "+1 (555) 123-4567", status: "Booked", duration: "5:12", time: "2:34 PM" },
    { id: 2, name: "Mike Chen", phone: "+1 (555) 987-6543", status: "Follow-up", duration: "3:45", time: "2:15 PM" },
    { id: 3, name: "Emma Davis", phone: "+1 (555) 456-7890", status: "Booked", duration: "6:28", time: "1:52 PM" },
    { id: 4, name: "James Wilson", phone: "+1 (555) 321-0987", status: "No Answer", duration: "0:00", time: "1:30 PM" },
  ];

  const demoAgent = {
    name: "Alex - Sales Pro",
    status: "Active",
    calls: 23,
    bookings: 7,
    script: "Hi! I'm Alex from TechCorp. I noticed you downloaded our sales automation guide. I'd love to show you how our platform can increase your team's productivity by 40%. Do you have 15 minutes this week for a quick demo?"
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Demo Banner */}
      <div className="bg-warning text-warning-foreground p-3 text-center">
        <div className="flex items-center justify-center gap-2">
          <Badge variant="secondary" className="bg-white/20 text-warning-foreground">
            DEMO MODE
          </Badge>
          <span className="text-sm font-medium">
            This is a sandbox demo with simulated data. No real calls will be made.
          </span>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Tulora AI Demo Dashboard
          </h1>
          <p className="text-muted-foreground">
            Explore our AI-powered sales calling platform with sample data
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="agent">AI Agent</TabsTrigger>
            <TabsTrigger value="calls">Call History</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {/* Stats Cards */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
                  <Phone className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{demoStats.totalCalls}</div>
                  <p className="text-xs text-success">+12% from last week</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Meetings Booked</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{demoStats.successfulBookings}</div>
                  <p className="text-xs text-success">+8% from last week</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{demoStats.conversionRate}</div>
                  <p className="text-xs text-success">+2.1% from last week</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest calls from your AI agent</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {demoCallHistory.slice(0, 3).map((call) => (
                    <div key={call.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                      <div>
                        <p className="font-medium">{call.name}</p>
                        <p className="text-sm text-muted-foreground">{call.phone}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={call.status === "Booked" ? "default" : "secondary"}>
                          {call.status}
                        </Badge>
                        <p className="text-sm text-muted-foreground mt-1">{call.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agent">
            <Card>
              <CardHeader>
                <CardTitle>AI Agent Configuration</CardTitle>
                <CardDescription>Demo agent setup and performance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border border-border rounded-lg">
                    <div className="text-2xl font-bold text-brand">{demoAgent.calls}</div>
                    <div className="text-sm text-muted-foreground">Calls Today</div>
                  </div>
                  <div className="text-center p-4 border border-border rounded-lg">
                    <div className="text-2xl font-bold text-success">{demoAgent.bookings}</div>
                    <div className="text-sm text-muted-foreground">Meetings Booked</div>
                  </div>
                  <div className="text-center p-4 border border-border rounded-lg">
                    <Badge className="bg-success text-success-foreground">{demoAgent.status}</Badge>
                    <div className="text-sm text-muted-foreground mt-2">Agent Status</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Agent Script</h4>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm">{demoAgent.script}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <Button variant="outline" disabled>
                      Edit Script
                    </Button>
                    <Button variant="outline" disabled>
                      Voice Settings
                    </Button>
                    <Button variant="outline" disabled>
                      Advanced Config
                    </Button>
                  </div>
                  
                  <Badge variant="secondary" className="inline-flex">
                    Demo Mode - Configuration editing disabled
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calls">
            <Card>
              <CardHeader>
                <CardTitle>Call History</CardTitle>
                <CardDescription>Recent AI agent call attempts and outcomes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {demoCallHistory.map((call) => (
                    <div key={call.id} className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-card-hover">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-medium">{call.name}</p>
                            <p className="text-sm text-muted-foreground">{call.phone}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-medium">{call.duration}</p>
                          <p className="text-xs text-muted-foreground">Duration</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{call.time}</p>
                          <p className="text-xs text-muted-foreground">Time</p>
                        </div>
                        <Badge variant={call.status === "Booked" ? "default" : call.status === "Follow-up" ? "secondary" : "outline"}>
                          {call.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                  <CardDescription>Key performance indicators</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Connection Rate</span>
                    <span className="font-semibold">73%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Conversation Rate</span>
                    <span className="font-semibold">45%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Booking Rate</span>
                    <span className="font-semibold">18.4%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Avg Call Duration</span>
                    <span className="font-semibold">4:23</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Revenue Impact</CardTitle>
                  <CardDescription>Estimated revenue from AI calls</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-success">{demoStats.revenue}</div>
                    <p className="text-sm text-muted-foreground">Total Revenue Generated</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div className="text-xl font-semibold">$502</div>
                      <div className="text-xs text-muted-foreground">Avg Deal Size</div>
                    </div>
                    <div>
                      <div className="text-xl font-semibold">156</div>
                      <div className="text-xs text-muted-foreground">Total Deals</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* CTA Section */}
        <Card className="mt-8 bg-gradient-brand text-brand-foreground">
          <CardContent className="p-8 text-center">
            <h3 className="text-2xl font-bold mb-4">Ready to Get Started?</h3>
            <p className="mb-6 opacity-90">
              See the power of AI-driven sales calls for your business. Start your free trial today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="bg-white text-brand hover:bg-gray-50"
                onClick={() => window.location.href = '/auth'}
              >
                Start Free Trial
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="border-white/30 text-white hover:bg-white/10"
                onClick={() => window.location.href = '/talk-to-us'}
              >
                Schedule Demo
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DemoSandbox;