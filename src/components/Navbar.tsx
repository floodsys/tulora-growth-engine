import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useBillingTier } from "@/hooks/useBillingTier";

export default function Navbar() {
  const nav = useNavigate();
  const [authed, setAuthed] = useState(false);
  const tier = useBillingTier();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    nav("/auth", { replace: true });
  }

  return (
    <header className="w-full border-b">
      <nav className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
        <Link to="/" className="font-semibold">Tulora</Link>
        <div className="ml-auto flex items-center gap-3">
          {!authed && <Link to="/auth" className="px-3 py-1.5 border rounded">Login / Sign up</Link>}
          {authed && <>
            <Link to="/dashboard" className="px-3 py-1.5 border rounded">Dashboard</Link>
            <Link to="/billing" className="px-3 py-1.5 border rounded">Billing</Link>
            {tier === "free" && <Link to="/billing" className="px-3 py-1.5 border rounded">Upgrade</Link>}
            <button onClick={signOut} className="px-3 py-1.5 border rounded">Sign out</button>
          </>}
        </div>
      </nav>
    </header>
  );
}