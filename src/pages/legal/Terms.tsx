import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const Terms = () => {
    return (
        <div className="min-h-screen bg-background">
            <Navigation />
            <main className="container mx-auto max-w-3xl px-4 py-20">
                <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
                <p className="text-sm text-muted-foreground mb-8">
                    Last updated: February 2026 &middot; <span className="italic">Beta — subject to change</span>
                </p>

                <section className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
                    <h2 className="text-2xl font-semibold">1. Acceptance of Terms</h2>
                    <p>
                        By accessing or using Tulora (&ldquo;the Service&rdquo;), you agree to be bound by these
                        Terms of Service. If you do not agree, do not use the Service. Tulora is currently in{" "}
                        <strong>beta</strong>; features, pricing, and availability may change without notice.
                    </p>

                    <h2 className="text-2xl font-semibold">2. Description of Service</h2>
                    <p>
                        Tulora provides an AI-powered workforce platform for sales engagement, voice agents, and
                        related automation tools. The Service is provided &ldquo;as is&rdquo; during the beta
                        period without warranties of any kind.
                    </p>

                    <h2 className="text-2xl font-semibold">3. User Accounts</h2>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>You must provide accurate and complete registration information.</li>
                        <li>You are responsible for safeguarding your account credentials.</li>
                        <li>You must be at least 18 years old to use the Service.</li>
                    </ul>

                    <h2 className="text-2xl font-semibold">4. Acceptable Use</h2>
                    <p>You agree not to:</p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>Use the Service for any unlawful purpose.</li>
                        <li>Attempt to gain unauthorized access to any part of the Service.</li>
                        <li>Interfere with or disrupt the Service&rsquo;s infrastructure.</li>
                        <li>Use AI agents for spam, harassment, or deceptive communications.</li>
                    </ul>

                    <h2 className="text-2xl font-semibold">5. Intellectual Property</h2>
                    <p>
                        You retain ownership of data you submit. Tulora retains ownership of the platform, its
                        design, and underlying technology. We do not use your data to train AI models.
                    </p>

                    <h2 className="text-2xl font-semibold">6. Limitation of Liability</h2>
                    <p>
                        To the maximum extent permitted by law, Tulora shall not be liable for any indirect,
                        incidental, or consequential damages arising from your use of the Service. During the beta
                        period, the Service is provided without uptime guarantees.
                    </p>

                    <h2 className="text-2xl font-semibold">7. Termination</h2>
                    <p>
                        We may suspend or terminate your access at any time for violation of these terms. You may
                        cancel your account at any time by contacting{" "}
                        <a href="mailto:support@tulora.com" className="text-primary underline">support@tulora.com</a>.
                    </p>

                    <h2 className="text-2xl font-semibold">8. Contact</h2>
                    <p>
                        Questions? Reach us at{" "}
                        <a href="mailto:legal@tulora.com" className="text-primary underline">legal@tulora.com</a>.
                    </p>
                </section>
            </main>
            <Footer />
        </div>
    );
};

export default Terms;
