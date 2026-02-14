import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const SecurityPolicy = () => {
    return (
        <div className="min-h-screen bg-background">
            <Navigation />
            <main className="container mx-auto max-w-3xl px-4 py-20">
                <h1 className="text-4xl font-bold mb-2">Security</h1>
                <p className="text-sm text-muted-foreground mb-8">
                    Last updated: February 2026 &middot; <span className="italic">Beta — practices evolving</span>
                </p>

                <section className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
                    <h2 className="text-2xl font-semibold">Our Commitment</h2>
                    <p>
                        Security is a core priority at Tulora. While we are still in <strong>beta</strong> and
                        actively maturing our security program, we are building toward industry-recognized
                        standards and continuously improving our posture.
                    </p>

                    <h2 className="text-2xl font-semibold">Infrastructure</h2>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>Hosted on leading cloud providers with SOC 2-audited infrastructure.</li>
                        <li>Data encrypted at rest (AES-256) and in transit (TLS 1.2+).</li>
                        <li>Logical tenant isolation — your data is separated from other customers.</li>
                    </ul>

                    <h2 className="text-2xl font-semibold">Application Security</h2>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>Row-level security (RLS) enforced at the database layer.</li>
                        <li>Role-based access control (RBAC) for team management.</li>
                        <li>Multi-factor authentication (MFA) available for all accounts.</li>
                        <li>Automated secret scanning and dependency auditing in CI.</li>
                    </ul>

                    <h2 className="text-2xl font-semibold">Data Handling</h2>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>We do not use your data to train AI models.</li>
                        <li>AI processing occurs in secure, isolated environments.</li>
                        <li>Minimal data retention — we only store what is necessary for the Service.</li>
                    </ul>

                    <h2 className="text-2xl font-semibold">Compliance Roadmap</h2>
                    <p>
                        We are actively working toward SOC 2 Type II certification. Our current security
                        practices are informed by SOC 2 and GDPR frameworks, but we have not yet completed
                        a formal audit. We will update this page when certification is achieved.
                    </p>

                    <h2 className="text-2xl font-semibold">Reporting Vulnerabilities</h2>
                    <p>
                        If you discover a security issue, please report it responsibly to{" "}
                        <a href="mailto:security@tulora.com" className="text-primary underline">security@tulora.com</a>.
                        We aim to acknowledge reports within 48 hours.
                    </p>

                    <p className="text-sm text-muted-foreground mt-8">
                        See also: <Link to="/privacy" className="text-primary underline">Privacy Policy</Link>
                        {" · "}
                        <Link to="/gdpr" className="text-primary underline">GDPR</Link>
                        {" · "}
                        <Link to="/dpa" className="text-primary underline">Data Processing Agreement</Link>
                    </p>
                </section>
            </main>
            <Footer />
        </div>
    );
};

export default SecurityPolicy;
