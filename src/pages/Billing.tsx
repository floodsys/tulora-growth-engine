import { useState } from "react";
import { startCheckout, openPortal } from "@/lib/api";

export default function Billing() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upgrade() {
    setErr(null); setBusy(true);
    try {
      const { url } = await startCheckout(import.meta.env.VITE_PRICE_ID_PRO_MONTHLY!);
      window.location.href = url;
    } catch (e:any) { setErr(e.message ?? "Error"); } finally { setBusy(false); }
  }
  async function portal() {
    setErr(null); setBusy(true);
    try {
      const { url } = await openPortal();
      window.location.href = url;
    } catch (e:any) { setErr(e.message ?? "Error"); } finally { setBusy(false); }
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Billing</h1>
      <p>Free by default. Upgrade to Pro anytime.</p>
      <div className="flex gap-3">
        <button className="px-4 py-2 border rounded" disabled={busy} onClick={upgrade}>
          {busy ? "Opening…" : "Upgrade to Pro"}
        </button>
        <button className="px-4 py-2 border rounded" disabled={busy} onClick={portal}>
          {busy ? "Opening…" : "Manage billing"}
        </button>
      </div>
      {err && <p className="text-red-600">{err}</p>}
    </div>
  );
}