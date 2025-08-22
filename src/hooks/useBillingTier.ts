import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function useBillingTier() {
  const [tier, setTier] = useState<"free" | "pro" | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { if (!cancelled) setTier(null); return; }

      const { data: profile } = await supabase
        .from("profiles").select("current_org_id").single();

      if (!profile?.current_org_id) { if (!cancelled) setTier("free"); return; }

      const { data: org } = await supabase
        .from("organizations")
        .select("billing_tier")
        .eq("id", profile.current_org_id)
        .single();

      if (!cancelled) setTier((org?.billing_tier as "free"|"pro") ?? "free");
    })();
    return () => { cancelled = true; };
  }, []);

  return tier;
}