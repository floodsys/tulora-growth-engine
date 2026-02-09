const _allowedOrigins: string[] = (() => {
  const raw = Deno.env.get("CORS_ALLOWED_ORIGINS") ?? "";
  const parsed = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return parsed.length > 0
    ? parsed
    : ["http://localhost:5173", "http://localhost:3000"];
})();

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowedOrigin = _allowedOrigins.includes(origin)
    ? origin
    : _allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Vary": "Origin",
  };
}

