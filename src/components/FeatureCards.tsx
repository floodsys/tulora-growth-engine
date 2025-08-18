const FeatureCards = () => {
  const agents = [{
    title: "Voice AI Leads Agent",
    emoji: "🤖",
    descriptions: ["Answers and calls back leads in seconds—qualifies, routes, and books. 24/7 phone coverage, zero busywork.", "Instant answer/callback: Sub-60s from forms, ads, and missed calls", "Qualifies & routes: Your ICP rules, territories, and handoffs"],
    features: [{
      icon: "📞",
      title: "No missed calls",
      subtitle: "Every inquiry answered"
    }, {
      icon: "🔁",
      title: "Every callback covered",
      subtitle: "Sequenced until booked/closed"
    }, {
      icon: "⚡",
      title: "Speed-to-lead",
      subtitle: "Under 60 seconds"
    }, {
      icon: "💼",
      title: "Less admin",
      subtitle: "Auto logging & transcripts"
    }, {
      icon: "👥",
      title: "Custom call flows",
      subtitle: "Built to your script"
    }, {
      icon: "🔗",
      title: "Integrations",
      subtitle: "Twilio/Retell, Salesforce/HubSpot, calendars"
    }]
  }, {
    title: "Research Agent (Coming Soon)",
    emoji: "🔬",
    descriptions: ["AI handles your research, so you don't have to", "Every call is fully prepped with the right insights", "Customize exactly how you need it"],
    features: [{
      icon: "🔍",
      title: "Deep insights",
      subtitle: "Comprehensive research"
    }, {
      icon: "📊",
      title: "Smart analysis",
      subtitle: "AI-powered findings"
    }, {
      icon: "⏰",
      title: "Save time",
      subtitle: "Instant results"
    }, {
      icon: "🎯",
      title: "Targeted data",
      subtitle: "Relevant only"
    }, {
      icon: "📋",
      title: "Ready reports",
      subtitle: "Formatted"
    }]
  }, {
    title: "Support Agent",
    emoji: "🎧",
    descriptions: ["Responds to customer inquiries instantly", "Learns from your knowledge base and documents", "Escalates complex issues to human agents seamlessly"],
    features: [{
      icon: "💬",
      title: "24/7 available",
      subtitle: "Always online"
    }, {
      icon: "🧠",
      title: "Smart learning",
      subtitle: "Improves over time"
    }, {
      icon: "🎧",
      title: "Multi-channel",
      subtitle: "Chat, email, phone"
    }, {
      icon: "🔄",
      title: "Smart handoff",
      subtitle: "Knows when"
    }, {
      icon: "📈",
      title: "Track metrics",
      subtitle: "Monitor performance"
    }]
  }, {
    title: "Content Agent (Coming Soon)",
    emoji: "✏️",
    descriptions: ["Creates blog posts, emails, and marketing copy", "Maintains your brand voice and style consistently", "Optimizes content for SEO and engagement"],
    features: [{
      icon: "✏️",
      title: "Brand voice",
      subtitle: "Matches yours"
    }, {
      icon: "🚀",
      title: "SEO ready",
      subtitle: "Built for discovery"
    }, {
      icon: "📝",
      title: "Multi-format",
      subtitle: "Blogs, emails, social"
    }, {
      icon: "📊",
      title: "Track results",
      subtitle: "Measure engagement"
    }, {
      icon: "⚡",
      title: "Fast output",
      subtitle: "Content at scale"
    }]
  }];
  return <section className="py-8 bg-background">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="text-center mb-12">
          <div className="mb-5">
            <img src="https://71bed9839f6b63de0d12cd02f4fd4947.cdn.bubble.io/f1754095697336x643713194993545500/ai_workforce.svg" alt="AI Workforce" className="w-48 h-28 mx-auto" />
          </div>
          <h2 className="font-bold text-foreground mb-4 font-heading text-4xl">
            Building an AI Workforce
          </h2>
          <p className="text-muted-foreground font-heading text-2xl">
            Recruit enterprise-grade AI agents today—fully customizable
          </p>
        </div>

        {/* Cards Container */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-[1600px] mx-auto">
          {agents.map((agent, index) => <div key={index} className="bg-white rounded-2xl p-8 lg:p-12 grid grid-cols-1 lg:grid-cols-[2fr_250px] gap-8 lg:gap-12 items-center transition-all duration-300 border border-border shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-primary min-h-[280px]">
              {/* Agent Content */}
              <div className="flex flex-col gap-2">
                <div className="mb-2">
                  <h3 className="text-2xl font-bold text-foreground font-heading">
                    AI <span className="text-primary">{agent.title}</span>
                  </h3>
                </div>
                
                <div className="space-y-1 mb-3">
                  {agent.descriptions.map((desc, idx) => <div key={idx} className="text-sm text-muted-foreground leading-relaxed">
                      {desc}
                    </div>)}
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 gap-2 mt-2">
                  {agent.features.map((feature, idx) => <div key={idx} className="bg-muted/50 p-2 rounded-lg border border-border/50 text-center transition-all duration-200 hover:bg-muted hover:border-border min-h-[60px] flex flex-col justify-center">
                      <div className="w-4 h-4 bg-gradient-to-br from-primary to-purple-600 rounded text-[8px] flex items-center justify-center mx-auto mb-1">
                        <span className="text-white text-[6px]">{feature.icon.charAt(0)}</span>
                      </div>
                      <div className="text-[11px] font-semibold text-foreground mb-0.5 font-heading">
                        {feature.title}
                      </div>
                      <div className="text-[9px] text-muted-foreground leading-tight break-words hyphens-auto">
                        {feature.subtitle}
                      </div>
                    </div>)}
                </div>
              </div>
              
              {/* Agent Avatar */}
              <div className="lg:order-last order-first">
                <div className="w-full lg:w-48 h-24 lg:h-36 bg-gradient-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center relative overflow-hidden">
                  <div className="text-4xl lg:text-5xl drop-shadow-lg">
                    {agent.emoji}
                  </div>
                  <div className="absolute bottom-3 w-20 h-3 bg-white/30 rounded-full blur-sm"></div>
                </div>
              </div>
            </div>)}
        </div>
      </div>
    </section>;
};
export default FeatureCards;