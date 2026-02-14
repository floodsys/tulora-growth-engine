import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const Privacy = () => {
    return (
        <div className="min-h-screen bg-background">
            <Navigation />
            <main className="container mx-auto max-w-3xl px-4 py-20">
                <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
                <p className="text-sm text-muted-foreground mb-8">
                    Last updated: February 2026 &middot; <span className="italic">Beta — subject to change</span>
                </p>

                <section className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
                    <h2 className="text-2xl font-semibold">1. Introduction</h2>
                    <p>
                        Tulora (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is committed to protecting
                        your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard
                        your information when you use our platform. Tulora is currently in <strong>beta</strong>;
                        this policy may be updated as the product evolves.
                    </p>

                    <h2 className="text-2xl font-semibold">2. Information We Collect</h2>
                    <ul className="list-disc pl-6 space-y-2">
                        <li><strong>Account data:</strong> name, email address, and organization details you provide during registration.</li>
                        <li><strong>Usage data:</strong> pages visited, features used, timestamps, and device/browser metadata.</li>
                        <li><strong>AI interaction data:</strong> call transcripts and agent configurations you create within the platform.</li>
                        <li><strong>Payment data:</strong> processed by our third-party payment processor (Stripe). We do not store full payment card numbers.</li>
                    </ul>

                    <h2 className="text-2xl font-semibold">3. How We Use Your Information</h2>
                    <p>We use collected information to:</p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>Provide and maintain the Tulora platform.</li>
                        <li>Improve platform features and user experience.</li>
                        <li>Communicate service updates and respond to support requests.</li>
                        <li>Comply with legal obligations.</li>
                    </ul>

                    <h2 className="text-2xl font-semibold">4. Data Sharing</h2>
                    <p>
                        We do not sell your personal data. We may share information with trusted service providers
                        (e.g., hosting, analytics, payment processing) who assist in operating the platform, subject
                        to confidentiality obligations.
                    </p>

                    <h2 className="text-2xl font-semibold">5. Data Retention</h2>
                    <p>
                        We retain your data for as long as your account is active or as needed to provide services.
                        You may request deletion of your data by contacting us at{" "}
                        <a href="mailto:privacy@tulora.com" className="text-primary underline">privacy@tulora.com</a>.
                    </p>

                    <h2 className="text-2xl font-semibold">6. Your Rights</h2>
                    <p>
                        Depending on your jurisdiction, you may have the right to access, correct, delete, or port
                        your personal data. See our <Link to="/gdpr" className="text-primary underline">GDPR</Link> page
                        for EU/EEA-specific rights.
                    </p>

                    <h2 className="text-2xl font-semibold">7. Contact</h2>
                    <p>
                        Questions about this policy? Reach us at{" "}
                        <a href="mailto:privacy@tulora.com" className="text-primary underline">privacy@tulora.com</a>.
                    </p>
                </section>
            </main>
            <Footer />
        </div>
    );
};

export default Privacy;
