import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const GDPR = () => {
    return (
        <div className="min-h-screen bg-background">
            <Navigation />
            <main className="container mx-auto max-w-3xl px-4 py-20">
                <h1 className="text-4xl font-bold mb-2">GDPR</h1>
                <p className="text-sm text-muted-foreground mb-8">
                    Last updated: February 2026 &middot; <span className="italic">Beta — subject to change</span>
                </p>

                <section className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
                    <h2 className="text-2xl font-semibold">Our Approach to GDPR</h2>
                    <p>
                        Tulora is committed to aligning with the General Data Protection Regulation (GDPR).
                        While we are in <strong>beta</strong> and have not yet completed a formal GDPR compliance
                        audit, we have designed our platform with data protection principles in mind from
                        the start.
                    </p>

                    <h2 className="text-2xl font-semibold">Data Controller &amp; Processor</h2>
                    <p>
                        When you use Tulora, you are typically the <strong>data controller</strong> for your
                        end-user and prospect data. Tulora acts as a <strong>data processor</strong> on your
                        behalf. Our <Link to="/dpa" className="text-primary underline">Data Processing Agreement</Link>{" "}
                        outlines these responsibilities.
                    </p>

                    <h2 className="text-2xl font-semibold">Your Rights Under GDPR</h2>
                    <p>If you are located in the EU/EEA, you have the right to:</p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li><strong>Access</strong> — request a copy of the personal data we hold about you.</li>
                        <li><strong>Rectification</strong> — request correction of inaccurate data.</li>
                        <li><strong>Erasure</strong> — request deletion of your data (&ldquo;right to be forgotten&rdquo;).</li>
                        <li><strong>Portability</strong> — receive your data in a structured, machine-readable format.</li>
                        <li><strong>Restriction</strong> — request that we limit processing of your data.</li>
                        <li><strong>Objection</strong> — object to processing based on legitimate interests.</li>
                    </ul>

                    <h2 className="text-2xl font-semibold">Data Transfers</h2>
                    <p>
                        Tulora may process data outside the EU/EEA. Where this occurs, we rely on appropriate
                        safeguards such as Standard Contractual Clauses (SCCs) to protect your data.
                    </p>

                    <h2 className="text-2xl font-semibold">Data Protection Practices</h2>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>Encryption at rest (AES-256) and in transit (TLS 1.2+).</li>
                        <li>Logical tenant isolation at the database layer.</li>
                        <li>We do not use your data to train AI models.</li>
                        <li>Access controls and audit logging are in place.</li>
                    </ul>

                    <h2 className="text-2xl font-semibold">Contact Our Privacy Team</h2>
                    <p>
                        To exercise any of your rights or ask questions, contact us at{" "}
                        <a href="mailto:privacy@tulora.com" className="text-primary underline">privacy@tulora.com</a>.
                    </p>
                </section>
            </main>
            <Footer />
        </div>
    );
};

export default GDPR;
