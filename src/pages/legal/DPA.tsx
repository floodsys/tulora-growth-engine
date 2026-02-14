import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const DPA = () => {
    return (
        <div className="min-h-screen bg-background">
            <Navigation />
            <main className="container mx-auto max-w-3xl px-4 py-20">
                <h1 className="text-4xl font-bold mb-2">Data Processing Agreement</h1>
                <p className="text-sm text-muted-foreground mb-8">
                    Last updated: February 2026 &middot; <span className="italic">Beta — subject to change</span>
                </p>

                <section className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
                    <h2 className="text-2xl font-semibold">1. Overview</h2>
                    <p>
                        This Data Processing Agreement (&ldquo;DPA&rdquo;) forms part of the{" "}
                        <Link to="/terms" className="text-primary underline">Terms of Service</Link> between you
                        (&ldquo;Customer&rdquo;, the data controller) and Tulora (&ldquo;Processor&rdquo;). It
                        describes how Tulora processes personal data on your behalf. Tulora is in{" "}
                        <strong>beta</strong>; this DPA will be updated as our compliance program matures.
                    </p>

                    <h2 className="text-2xl font-semibold">2. Scope of Processing</h2>
                    <p>Tulora processes personal data solely to provide the Service, including:</p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>Contact and account information of your team members.</li>
                        <li>Prospect and lead data you import or generate via the platform.</li>
                        <li>Call recordings, transcripts, and AI agent interaction logs.</li>
                    </ul>

                    <h2 className="text-2xl font-semibold">3. Data Security Measures</h2>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>Encryption at rest (AES-256) and in transit (TLS 1.2+).</li>
                        <li>Row-level security and logical tenant isolation.</li>
                        <li>Role-based access controls for platform administration.</li>
                        <li>Regular vulnerability scanning and dependency auditing.</li>
                    </ul>

                    <h2 className="text-2xl font-semibold">4. Sub-processors</h2>
                    <p>
                        Tulora uses third-party sub-processors to deliver the Service (e.g., cloud hosting,
                        payment processing, AI model providers). We maintain contracts with sub-processors that
                        impose data protection obligations consistent with this DPA. A list of current
                        sub-processors is available upon request.
                    </p>

                    <h2 className="text-2xl font-semibold">5. Data Subject Requests</h2>
                    <p>
                        If we receive a request from a data subject regarding your data, we will promptly notify
                        you and assist you in responding, to the extent legally permitted.
                    </p>

                    <h2 className="text-2xl font-semibold">6. Data Retention &amp; Deletion</h2>
                    <p>
                        Upon termination of your account, we will delete or return your personal data within 90
                        days, unless retention is required by law.
                    </p>

                    <h2 className="text-2xl font-semibold">7. International Transfers</h2>
                    <p>
                        Where personal data is transferred outside the EU/EEA, we rely on Standard Contractual
                        Clauses (SCCs) or other approved mechanisms.
                    </p>

                    <h2 className="text-2xl font-semibold">8. Contact</h2>
                    <p>
                        For DPA-related inquiries, contact us at{" "}
                        <a href="mailto:privacy@tulora.com" className="text-primary underline">privacy@tulora.com</a>.
                    </p>
                </section>
            </main>
            <Footer />
        </div>
    );
};

export default DPA;
