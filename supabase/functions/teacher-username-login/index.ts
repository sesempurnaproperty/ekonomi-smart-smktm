const corsHeaders = {
  "Access-Control-Allow-Headers": "apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin"
};

const allowedOrigins = new Set([
  "https://ekonomi-smart-smktm.vercel.app",
  "https://ekonomi-smart-smktm-cikguikmalproperty-4855.vercel.app",
  "http://localhost:3000"
]);

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  origin: string | null
) {
  const originAllowed = !origin || allowedOrigins.has(origin);
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Access-Control-Allow-Origin": originAllowed && origin ? origin : "null",
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
    if (origin && !allowedOrigins.has(origin)) {
      return jsonResponse({ error: "Origin tidak dibenarkan." }, 403, origin);
    }

    return new Response("ok", {
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Origin": origin ?? "null"
      }
    });
  }

  if (origin && !allowedOrigins.has(origin)) {
    return jsonResponse({ error: "Origin tidak dibenarkan." }, 403, origin);
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Kaedah permintaan tidak disokong." }, 405, origin);
  }

  let body: { username?: unknown; password?: unknown };

  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Permintaan tidak sah." }, 400, origin);
  }

  const username =
    typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (
    !/^(?:[a-z0-9][a-z0-9._-]{2,31}|[a-z0-9][a-z0-9._+-]{0,63}@[a-z0-9][a-z0-9.-]{0,187}\.[a-z]{2,24})$/.test(username) ||
    password.length < 1 ||
    password.length > 256
  ) {
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
    console.error("Supabase Edge Function environment is incomplete.");
    return jsonResponse({ error: "Perkhidmatan log masuk belum dikonfigurasi." }, 500, origin);
  }

  try {
    // Look up the internal Auth user id using a server-only key.
    // The username-to-email mapping is never returned to the browser.
    const lookupUrl = new URL("/rest/v1/teacher_accounts", supabaseUrl);
    lookupUrl.searchParams.set("select", "user_id,is_active");
    lookupUrl.searchParams.set("username", `eq.${username}`);
    lookupUrl.searchParams.set("limit", "1");

    const lookupResponse = await fetch(lookupUrl, {
      headers: {
        apikey: secretKey,
        Accept: "application/json"
      }
    });

    if (!lookupResponse.ok) {
      console.error("Teacher account lookup failed:", lookupResponse.status);
      return jsonResponse({ error: "Perkhidmatan log masuk tidak tersedia." }, 503, origin);
    }

    const rows = await lookupResponse.json();
    const teacher = Array.isArray(rows) ? rows[0] : null;

    if (!teacher || teacher.is_active !== true || typeof teacher.user_id !== "string") {
      return jsonResponse({ error: "Username atau kata laluan tidak sah." }, 401, origin);
    }

    // Retrieve the email internally from Supabase Auth.
    const userResponse = await fetch(
      new URL(`/auth/v1/admin/users/${encodeURIComponent(teacher.user_id)}`, supabaseUrl),
      {
        headers: {
          apikey: secretKey,
          Accept: "application/json"
        }
      }
    );

    if (!userResponse.ok) {
      console.error("Teacher Auth user lookup failed:", userResponse.status);
      return jsonResponse({ error: "Perkhidmatan log masuk tidak tersedia." }, 503, origin);
    }

    const userPayload = await userResponse.json();
    const email = userPayload?.user?.email ?? userPayload?.email;

    if (typeof email !== "string" || !email) {
      return jsonResponse({ error: "Username atau kata laluan tidak sah." }, 401, origin);
    }

    // Supabase Auth validates the password. This function never stores it.
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
      token_type: session.token_type
    }, 200, origin);
  } catch (error) {
    console.error("Teacher username login failed:", error);
    return jsonResponse({ error: "Log masuk tidak berjaya. Sila cuba lagi." }, 500, origin);
  }
});
