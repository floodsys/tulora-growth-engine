import { supabase } from "./supabase";

const base = () => import.meta.env.VITE_SUPABASE_URL;

async function authedFetch(path: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("No session");
  return fetch(`${base()}/functions/v1/${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
  });
}

export async function bootstrapUser() {
  const res = await authedFetch("bootstrap-user", { method: "POST" });
  if (!res.ok) throw new Error("bootstrap-user failed");
  return res.json() as Promise<{ ok: boolean; orgId: string }>;
}

export async function startCheckout(priceId: string) {
  const res = await authedFetch("stripe-checkout", {
    method: "POST",
    body: JSON.stringify({ priceId }),
  });
  if (!res.ok) throw new Error("checkout failed");
  return res.json() as Promise<{ url: string }>;
}

export async function openPortal() {
  const res = await authedFetch("stripe-portal", { method: "POST" });
  if (!res.ok) throw new Error("portal failed");
  return res.json() as Promise<{ url: string }>;
}