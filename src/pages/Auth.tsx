import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { bootstrapUser } from "@/lib/api";

export default function Auth() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(kind: "signIn" | "signUp") {
    setErr(null); setBusy(true);
    try {
      const fn = kind === "signIn" ? supabase.auth.signInWithPassword : supabase.auth.signUp;
      const { error, data } = await fn({ email, password: pw });
      if (error) throw error;
      if (!data.session && kind === "signUp") {
        setErr("Check your email to confirm your account.");
        return;
      }
      await bootstrapUser();          // creates free org, stripe customer, membership, etc.
      nav("/dashboard", { replace: true });
    } catch (e:any) {
      setErr(e.message ?? "Auth failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="max-w-sm mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <input className="w-full border rounded p-2"
        placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
      <input className="w-full border rounded p-2"
        placeholder="password" type="password" value={pw} onChange={e=>setPw(e.target.value)} />
      <div className="flex gap-2">
        <button className="px-4 py-2 border rounded" disabled={busy} onClick={()=>submit("signIn")}>
          {busy ? "..." : "Sign in"}
        </button>
        <button className="px-4 py-2 border rounded" disabled={busy} onClick={()=>submit("signUp")}>
          {busy ? "..." : "Sign up"}
        </button>
      </div>
      {err && <p className="text-red-600">{err}</p>}
    </div>
  );
}