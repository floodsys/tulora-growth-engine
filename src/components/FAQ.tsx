import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQ = () => {
  const faqs = [
    {
      question: "How secure is my prospect data?",
      answer: "Tulora is actively working toward SOC 2 Type II certification and uses AES-256 encryption at rest and TLS in transit. We never share your prospect information with third parties and follow strict data retention policies. All AI processing happens in secure, isolated environments."
    },
    {
      question: "What data privacy measures do you have?",
      answer: "We are aligning our practices with GDPR and CCPA requirements. Your prospect data is processed only for the specific AI functions you enable. You maintain full control over data deletion and can export your data at any time. We use data minimization principles and automatic data expiration."
    },
    {
      question: "Which AI model providers do you use?",
      answer: "Tulora uses a combination of leading AI providers including OpenAI GPT-4, Anthropic Claude, and proprietary fine-tuned models for specific scheduling tasks. We automatically route requests to the best model for each use case to optimize quality and response time."
    },
    {
      question: "Can I cancel my subscription anytime?",
      answer: "Yes, absolutely. You can cancel your subscription at any time with no penalties or fees. Your account will remain active until the end of your current billing period, and you'll retain access to all your data for 90 days after cancellation."
    },
    {
      question: "What kind of support do you provide?",
      answer: "Free users get email support with 48-hour response times. Pro users get priority support with 4-hour response times during business hours, plus access to our dedicated success team for onboarding and optimization guidance."
    },
    {
      question: "Do you have uptime guarantees (SLAs)?",
      answer: "We target high availability for all paid plans and are working toward formal SLA commitments. We use redundant cloud infrastructure to maximize reliability. Specific SLA terms will be available as we exit beta."
    },
    {
      question: "How accurate is the AI scheduling?",
      answer: "Our AI achieves 95%+ accuracy in understanding scheduling intent and availability. For edge cases it can't handle, requests are automatically escalated to human review or your team. The system learns from corrections to improve over time."
    },
    {
      question: "Can I customize the AI's tone and messaging?",
      answer: "Absolutely. You can train the AI on your specific tone, brand voice, and messaging preferences. Upload sample emails, set conversation guidelines, and create custom templates. The AI adapts to match your company's communication style."
    }
  ];

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Frequently asked questions
            </h2>
            <p className="text-lg text-muted-foreground">
              Everything you need to know about Tulora. Can't find what you're looking for?
              <a href="/talk-to-us" className="text-brand hover:text-brand-dark font-semibold ml-1">
                Contact our team
              </a>
            </p>
          </div>

          {/* FAQ Accordion */}
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="card-glass px-6 border-0"
              >
                <AccordionTrigger className="text-left font-semibold text-foreground hover:text-brand transition-colors duration-200">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};

export default FAQ;