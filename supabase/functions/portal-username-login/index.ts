const corsHeaders = {
  "Access-Control-Allow-Headers": "apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin"
};

const allowedOrigins = new Set([
  "https://ekonomi-smart-smktm.vercel.app",
  "https://ekonomi-smart-smktm-cikguikmalproperty-4855.vercel.app",
  // Previously reviewed Vercel Preview deployments.
  "https://ekonomi-smart-smktm-k8i0ace2q-cikguikmalproperty-4855.vercel.app",
  "https://ekonomi-smart-smktm-git-fix-mobi-fc0e34-cikguikmalproperty-4855.vercel.app",
  "https://ekonomi-smart-smktm-git-fix-dele-019622-cikguikmalproperty-4855.vercel.app",
  "https://ekonomi-smart-smktm-99va0gos7-cikguikmalproperty-4855.vercel.app",
  "http://localhost:3000"
]);

// Allow this project's deployment-specific and branch-specific Preview URLs.
// Keep the exact Vercel project prefix and owner suffix to avoid broad wildcard CORS.
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  try {
    const url = new URL(origin);
    return url.protocol === "https:" &&
      /^ekonomi-smart-smktm-[a-z0-9-]+-cikguikmalproperty-4855\.vercel\.app$/.test(url.hostname);
  } catch {
    return false;
  }
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  origin: string | null
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Access-Control-Allow-Origin": origin ? (isAllowedOrigin(origin) ? origin : "null") : "*",
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

function readKeyMap(name: string): string | null {
  const raw = Deno.env.get(name);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return typeof parsed?.default === "string" ? parsed.default : null;
  } catch {
    return null;
  }
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    if (origin && !isAllowedOrigin(origin)) {
      return jsonResponse({ error: "Origin tidak dibenarkan." }, 403, origin);
    }
    return new Response("ok", {
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Origin": origin ?? "*"
      }
    });
  }

  if (origin && !isAllowedOrigin(origin)) {
    return jsonResponse({ error: "Origin tidak dibenarkan." }, 403, origin);
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Kaedah permintaan tidak disokong." }, 405, origin);
  }

  let body: { identifier?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Permintaan tidak sah." }, 400, origin);
  }

  const identifier =
    typeof body.identifier === "string" ? body.identifier.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  const validIdentifier =
    /^[a-z0-9][a-z0-9._-]{2,31}$/.test(identifier) ||
    /^[a-z0-9][a-z0-9._+-]{0,63}@[a-z0-9][a-z0-9.-]{0,187}\.[a-z]{2,24}$/.test(identifier);

  if (!validIdentifier || password.length < 1 || password.length > 256) {
    return jsonResponse({ error: "Username atau kata laluan tidak sah." }, 400, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKey =
    readKeyMap("SUPABASE_SECRET_KEYS") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publishableKey =
    readKeyMap("SUPABASE_PUBLISHABLE_KEYS") ??
    Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !secretKey || !publishableKey) {
    console.error("Portal login function environment is incomplete.");
    return jsonResponse({ error: "Perkhidmatan log masuk belum dikonfigurasi." }, 500, origin);
  }

  try {
    // Resolve the account's trusted role from the server-only profile table.
    const lookupUrl = new URL("/rest/v1/user_profiles", supabaseUrl);
    lookupUrl.searchParams.set("select", "user_id,username,full_name,role,is_active");
    lookupUrl.searchParams.set("username", `eq.${identifier}`);
    lookupUrl.searchParams.set("limit", "1");

    const lookupResponse = await fetch(lookupUrl, {
      headers: {
        apikey: secretKey,
        Accept: "application/json"
      }
    });

    if (!lookupResponse.ok) {
      console.error("User profile lookup failed:", lookupResponse.status);
      return jsonResponse({ error: "Perkhidmatan log masuk tidak tersedia." }, 503, origin);
    }

    const rows = await lookupResponse.json();
    const profile = Array.isArray(rows) ? rows[0] : null;

    if (
      !profile ||
      profile.is_active !== true ||
      !["admin", "teacher", "student"].includes(profile.role) ||
      typeof profile.user_id !== "string"
    ) {
      return jsonResponse({ error: "Username atau kata laluan tidak sah." }, 401, origin);
    }

    // Fetch Auth email internally; it is never sent back to the browser.
    const userResponse = await fetch(
      new URL(`/auth/v1/admin/users/${encodeURIComponent(profile.user_id)}`, supabaseUrl),
      {
        headers: {
          apikey: secretKey,
          Accept: "application/json"
        }
      }
    );

    if (!userResponse.ok) {
      console.error("Auth user lookup failed:", userResponse.status);
      return jsonResponse({ error: "Perkhidmatan log masuk tidak tersedia." }, 503, origin);
    }

    const userPayload = await userResponse.json();
    const email = userPayload?.user?.email ?? userPayload?.email;

    if (typeof email !== "string" || !email) {
      return jsonResponse({ error: "Username atau kata laluan tidak sah." }, 401, origin);
    }

    // Supabase Auth validates the password. No password is stored in user_profiles.
    const signInResponse = await fetch(
      new URL("/auth/v1/token?grant_type=password", supabaseUrl),
      {
        method: "POST",
        headers: {
          apikey: publishableKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      }
    );

    if (!signInResponse.ok) {
      return jsonResponse({ error: "Username atau kata laluan tidak sah." }, 401, origin);
    }

    const session = await signInResponse.json();

    if (
      typeof session?.access_token !== "string" ||
      typeof session?.refresh_token !== "string"
    ) {
      console.error("Supabase Auth returned an incomplete session.");
      return jsonResponse({ error: "Log masuk tidak berjaya. Sila cuba lagi." }, 502, origin);
    }

    return jsonResponse({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      token_type: session.token_type,
      role: profile.role,
      username: profile.username,
      full_name: profile.full_name
    }, 200, origin);
  } catch (error) {
    console.error("Portal username login failed:", error);
    return jsonResponse({ error: "Log masuk tidak berjaya. Sila cuba lagi." }, 500, origin);
  }
});
