import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Play } from "lucide-react";
const Hero = () => {
  return <div className="relative min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Top Banner */}
      

      {/* Main Hero Content */}
      <div className="pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          {/* Decorative Elements */}
          <div className="absolute left-10 top-1/4 w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Play className="h-6 w-6 text-primary" />
          </div>
          <div className="absolute right-10 bottom-1/4 w-12 h-12 bg-purple-500/10 rounded-full flex items-center justify-center">
            <span className="text-2xl">🤖</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-5xl lg:text-7xl font-bold text-foreground mb-8 max-w-5xl mx-auto leading-tight font-heading">
            Build teams of{" "}
            <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              AI agents
            </span>{" "}
            that deliver human-quality work
          </h1>

          {/* Subtitle */}
          <p className="text-xl lg:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed">
            Ops teams can build and manage an entire AI workforce in one powerful visual platform.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Button size="lg" className="px-8 py-4 text-lg font-semibold bg-primary hover:bg-primary/90">
              Try for free
            </Button>
            <Button variant="outline" size="lg" className="px-8 py-4 text-lg font-semibold">
              Request a demo
            </Button>
          </div>

          {/* Navigation Pills */}
          <div className="flex items-center justify-center gap-6 mb-16">
            <Badge variant="secondary" className="px-4 py-2 text-sm font-medium">
              Getting started
            </Badge>
            <Badge variant="outline" className="px-4 py-2 text-sm font-medium">
              AI Agents
            </Badge>
            <Badge variant="outline" className="px-4 py-2 text-sm font-medium">
              AI Tools
            </Badge>
          </div>

          {/* Dashboard Preview */}
          <div className="relative max-w-6xl mx-auto">
            <div className="bg-white rounded-2xl shadow-2xl border border-border overflow-hidden">
              {/* Browser Chrome */}
              <div className="bg-gray-100 px-4 py-3 flex items-center gap-2 border-b border-border">
                <div className="flex gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <div className="bg-white px-4 py-1 rounded-md text-sm text-gray-600 border">
                    Template Gallery
                  </div>
                </div>
              </div>
              
              {/* Dashboard Content */}
              <div className="p-8 bg-gradient-to-br from-white to-gray-50">
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-left mb-2 text-gray-900">
                    ⚡ Supercharge your operations with AI Agents
                  </h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Agent Card 1 */}
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                        <span className="text-2xl">🔍</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-bold text-gray-900">Apia, the Prospect Researcher</h4>
                          <Badge className="text-xs bg-green-100 text-green-800">Recommended</Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">
                          Prepare detailed and nuanced research for every account.
                        </p>
                        <Button variant="outline" size="sm" className="text-sm">
                          Get started
                          <ArrowRight className="ml-1 h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Agent Card 2 */}
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                        <span className="text-2xl">📧</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-900 mb-2">Lima, the Lifecycle Marketer</h4>
                        <p className="text-sm text-gray-600 mb-4">
                          Send sign ups hyper-personalized emails, to boost activation rates
                        </p>
                        <Button variant="outline" size="sm" className="text-sm">
                          Get started
                          <ArrowRight className="ml-1 h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>;
};
export default Hero;