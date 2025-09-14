import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { AlertTriangle, CheckCircle, Info, Network, Phone, Shield, Settings } from 'lucide-react'

interface EnterpriseDocsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const EnterpriseDocsModal = ({ open, onOpenChange }: EnterpriseDocsModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Enterprise BYOC Setup Guide
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="dns">DNS Setup</TabsTrigger>
            <TabsTrigger value="sip">SIP Config</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="troubleshooting">Troubleshooting</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  BYOC Integration Overview
                </CardTitle>
                <CardDescription>
                  Bring Your Own Carrier allows enterprise customers to route calls through their existing SIP infrastructure
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Benefits
                    </h4>
                    <ul className="text-sm space-y-1 ml-6">
                      <li>• Use existing phone numbers</li>
                      <li>• Maintain carrier relationships</li>
                      <li>• Cost optimization</li>
                      <li>• Regulatory compliance</li>
                      <li>• Local presence</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      Requirements
                    </h4>
                    <ul className="text-sm space-y-1 ml-6">
                      <li>• SIP-compatible carrier</li>
                      <li>• Static IP addresses</li>
                      <li>• Network firewall configuration</li>
                      <li>• DNS management access</li>
                      <li>• Enterprise plan subscription</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Setup Process</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center">1</Badge>
                    <span>Configure DNS settings with your provider</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center">2</Badge>
                    <span>Set up SIP trunk configuration</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center">3</Badge>
                    <span>Configure network security and firewall rules</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center">4</Badge>
                    <span>Import numbers through our platform</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center">5</Badge>
                    <span>Test and validate call routing</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dns" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-5 w-5" />
                  DNS Configuration
                </CardTitle>
                <CardDescription>
                  Required DNS records for proper SIP routing and failover
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">SRV Records</h4>
                    <div className="bg-muted p-3 rounded-md font-mono text-sm">
                      <div>_sip._udp.yourdomain.com. 300 IN SRV 10 5 5060 sip1.yourdomain.com.</div>
                      <div>_sip._tcp.yourdomain.com. 300 IN SRV 10 5 5060 sip1.yourdomain.com.</div>
                      <div>_sips._tcp.yourdomain.com. 300 IN SRV 10 5 5061 sip1.yourdomain.com.</div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">A Records</h4>
                    <div className="bg-muted p-3 rounded-md font-mono text-sm">
                      <div>sip1.yourdomain.com. 300 IN A 203.0.113.10</div>
                      <div>sip2.yourdomain.com. 300 IN A 203.0.113.11</div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">NAPTR Records (Optional)</h4>
                    <div className="bg-muted p-3 rounded-md font-mono text-sm">
                      <div>yourdomain.com. 300 IN NAPTR 50 50 "s" "SIP+D2U" "" _sip._udp.yourdomain.com.</div>
                      <div>yourdomain.com. 300 IN NAPTR 60 50 "s" "SIP+D2T" "" _sip._tcp.yourdomain.com.</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sip" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  SIP Trunk Configuration
                </CardTitle>
                <CardDescription>
                  Configure your SIP trunk settings for optimal call quality
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Basic Settings</h4>
                    <div className="space-y-2 text-sm">
                      <div><strong>Protocol:</strong> SIP over UDP/TCP/TLS</div>
                      <div><strong>Port:</strong> 5060 (UDP/TCP), 5061 (TLS)</div>
                      <div><strong>Codec:</strong> G.711 (PCMU/PCMA), G.729</div>
                      <div><strong>DTMF:</strong> RFC 2833 (recommended)</div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Authentication</h4>
                    <div className="space-y-2 text-sm">
                      <div><strong>Method:</strong> SIP Digest Authentication</div>
                      <div><strong>Username:</strong> Provided by carrier</div>
                      <div><strong>Password:</strong> Secure, regularly rotated</div>
                      <div><strong>Realm:</strong> Usually your SIP domain</div>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-semibold mb-2">Sample Configuration</h4>
                  <div className="bg-muted p-3 rounded-md font-mono text-sm">
                    <pre>{`# SIP Trunk Configuration
domain: sip.yourcarrier.com
username: your_trunk_username
password: your_secure_password
proxy: sip.yourcarrier.com:5060
register: yes
insecure: port,invite
context: from-trunk
type: peer
host: dynamic
canreinvite: no
dtmfmode: rfc2833
disallow: all
allow: ulaw,alaw,g729`}</pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security & Network Configuration
                </CardTitle>
                <CardDescription>
                  Secure your SIP infrastructure with proper firewall and network settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Firewall Rules</h4>
                  <div className="bg-muted p-3 rounded-md font-mono text-sm">
                    <div># Allow SIP signaling</div>
                    <div>iptables -A INPUT -p udp --dport 5060 -j ACCEPT</div>
                    <div>iptables -A INPUT -p tcp --dport 5060 -j ACCEPT</div>
                    <div>iptables -A INPUT -p tcp --dport 5061 -j ACCEPT</div>
                    <div></div>
                    <div># Allow RTP media</div>
                    <div>iptables -A INPUT -p udp --dport 10000:20000 -j ACCEPT</div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">IP Whitelisting</h4>
                  <div className="space-y-2 text-sm">
                    <p>Configure your firewall to only allow SIP traffic from trusted sources:</p>
                    <ul className="ml-4 space-y-1">
                      <li>• Your carrier's IP ranges</li>
                      <li>• Your internal network ranges</li>
                      <li>• Our platform IPs (provided separately)</li>
                      <li>• Backup/failover carrier IPs</li>
                    </ul>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">TLS Encryption</h4>
                  <div className="space-y-2 text-sm">
                    <p>For enhanced security, configure TLS encryption:</p>
                    <div className="bg-muted p-2 rounded-md font-mono text-xs">
                      transport=tls<br/>
                      encryption=yes<br/>
                      tlscertfile=/path/to/cert.pem<br/>
                      tlsprivatekey=/path/to/private.key<br/>
                      tlscafile=/path/to/ca.pem
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="troubleshooting" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Common Issues & Solutions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="border-l-4 border-red-500 pl-4">
                    <h4 className="font-semibold text-red-700">Registration Failures</h4>
                    <div className="text-sm space-y-1">
                      <p><strong>Symptoms:</strong> SIP REGISTER returns 401/403</p>
                      <p><strong>Solutions:</strong></p>
                      <ul className="ml-4">
                        <li>• Verify username/password credentials</li>
                        <li>• Check authentication realm settings</li>
                        <li>• Ensure IP is whitelisted at carrier</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="border-l-4 border-yellow-500 pl-4">
                    <h4 className="font-semibold text-yellow-700">One-Way Audio</h4>
                    <div className="text-sm space-y-1">
                      <p><strong>Symptoms:</strong> Can hear caller but they can't hear you</p>
                      <p><strong>Solutions:</strong></p>
                      <ul className="ml-4">
                        <li>• Configure NAT traversal (STUN/TURN)</li>
                        <li>• Check RTP port ranges in firewall</li>
                        <li>• Verify external IP in SIP headers</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="border-l-4 border-blue-500 pl-4">
                    <h4 className="font-semibold text-blue-700">Call Quality Issues</h4>
                    <div className="text-sm space-y-1">
                      <p><strong>Symptoms:</strong> Echo, delay, or choppy audio</p>
                      <p><strong>Solutions:</strong></p>
                      <ul className="ml-4">
                        <li>• Optimize codec selection (prefer G.711)</li>
                        <li>• Check network latency and packet loss</li>
                        <li>• Implement QoS/traffic shaping</li>
                        <li>• Configure echo cancellation</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Support & Diagnostics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">For additional support with BYOC configuration:</p>
                <ul className="text-sm space-y-1 ml-4">
                  <li>• Contact our Enterprise Support team</li>
                  <li>• Provide SIP traces and logs</li>
                  <li>• Share your network topology diagram</li>
                  <li>• Include carrier-specific documentation</li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}