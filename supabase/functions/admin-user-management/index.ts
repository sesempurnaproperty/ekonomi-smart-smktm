const corsHeaders = {
  "Access-Control-Allow-Headers": "apikey, authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin"
};

const allowedOrigins = new Set([
  "https://ekonomi-smart-smktm.vercel.app",
  "https://ekonomi-smart-smktm-cikguikmalproperty-4855.vercel.app",
  "https://ekonomi-smart-smktm-git-main-cikguikmalproperty-4855.vercel.app",
  "http://localhost:3000"
]);

type ProfileRole = "admin" | "teacher" | "student";
type RequestBody = {
  action?: unknown;
  username?: unknown;
  full_name?: unknown;
  role?: unknown;
  password?: unknown;
  form_level?: unknown;
  class_name?: unknown;
  user_id?: unknown;
  is_active?: unknown;
  class_id?: unknown;
  new_class_name?: unknown;
  rows?: unknown;
};

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

function response(body: Record<string, unknown>, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "null",
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

function isUsername(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(value) ||
    /^[a-z0-9][a-z0-9._+-]{0,63}@[a-z0-9][a-z0-9.-]{0,187}\.[a-z]{2,24}$/.test(value);
}

function readKeys() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKey = readKeyMap("SUPABASE_SECRET_KEYS") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publishableKey = readKeyMap("SUPABASE_PUBLISHABLE_KEYS") ?? Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !secretKey || !publishableKey) {
    throw new Error("Supabase management function environment is incomplete.");
  }
  return { supabaseUrl, secretKey, publishableKey };
}

async function getProfileRows(
  supabaseUrl: string,
  secretKey: string,
  query: Record<string, string>
) {
  const url = new URL("/rest/v1/user_profiles", supabaseUrl);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  const res = await fetch(url, {
    headers: { apikey: secretKey, Accept: "application/json" }
  });
  if (!res.ok) throw new Error(`Profile query failed: ${res.status}`);
  return await res.json();
}

async function getClassRows(
  supabaseUrl: string,
  secretKey: string,
  query: Record<string, string>
) {
  const url = new URL("/rest/v1/academic_classes", supabaseUrl);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  const res = await fetch(url, {
    headers: { apikey: secretKey, Accept: "application/json" }
  });
  if (!res.ok) throw new Error(`Class query failed: ${res.status}`);
  return await res.json();
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (origin && !allowedOrigins.has(origin)) return response({ error: "Origin tidak dibenarkan." }, 403, origin);
    return new Response("ok", {
      headers: { ...corsHeaders, "Access-Control-Allow-Origin": origin ?? "null" }
    });
  }
  if (origin && !allowedOrigins.has(origin)) return response({ error: "Origin tidak dibenarkan." }, 403, origin);
  if (req.method !== "POST") return response({ error: "Kaedah permintaan tidak disokong." }, 405, origin);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return response({ error: "Permintaan tidak sah." }, 400, origin);
  }

  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return response({ error: "Sesi pentadbir diperlukan." }, 401, origin);
  }

  let keys: ReturnType<typeof readKeys>;
  try {
    keys = readKeys();
  } catch (error) {
    console.error(error);
    return response({ error: "Perkhidmatan pengurusan pengguna belum dikonfigurasi." }, 500, origin);
  }
  const { supabaseUrl, secretKey, publishableKey } = keys;

  try {
    // Validate the caller's JWT against Supabase Auth.
    const authRes = await fetch(new URL("/auth/v1/user", supabaseUrl), {
      headers: {
        apikey: publishableKey,
        Authorization: authorization,
        Accept: "application/json"
      }
    });
    if (!authRes.ok) return response({ error: "Sesi tidak sah atau telah tamat." }, 401, origin);
    const authUser = await authRes.json();
    const callerId = authUser?.id;
    if (typeof callerId !== "string") return response({ error: "Sesi pengguna tidak sah." }, 401, origin);

    // Authorization is checked from the protected database profile, never from user metadata.
    const callerRows = await getProfileRows(supabaseUrl, secretKey, {
      select: "user_id,role,is_active",
      user_id: `eq.${callerId}`,
      limit: "1"
    });
    const callerProfile = Array.isArray(callerRows) ? callerRows[0] : null;
    if (!callerProfile || callerProfile.role !== "admin" || callerProfile.is_active !== true) {
      return response({ error: "Akses ditolak. Hanya pentadbir boleh mengurus akaun." }, 403, origin);
    }

    const action = typeof body.action === "string" ? body.action : "";

    if (action === "list") {
      const rows = await getProfileRows(supabaseUrl, secretKey, {
        select: "user_id,username,full_name,role,form_level,class_name,is_active,created_at",
        order: "created_at.desc",
        limit: "500"
      });
      return response({ users: rows }, 200, origin);
    }


    if (action === "list_classes") {
      const [classRows, studentRows] = await Promise.all([
        getClassRows(supabaseUrl, secretKey, {
          select: "id,form_level,class_name,is_active,created_at",
          order: "form_level.asc,class_name.asc",
          limit: "200"
        }),
        getProfileRows(supabaseUrl, secretKey, {
          select: "academic_class_id,is_active",
          role: "eq.student",
          limit: "1000"
        })
      ]);

      const counts = new Map<string, { total: number; active: number; inactive: number }>();
      for (const student of (Array.isArray(studentRows) ? studentRows : [])) {
        if (typeof student.academic_class_id !== "string") continue;
        const current = counts.get(student.academic_class_id) ?? { total: 0, active: 0, inactive: 0 };
        current.total += 1;
        if (student.is_active === true) current.active += 1;
        else current.inactive += 1;
        counts.set(student.academic_class_id, current);
      }

      const classes = (Array.isArray(classRows) ? classRows : []).map((item) => {
        const count = counts.get(item.id) ?? { total: 0, active: 0, inactive: 0 };
        return {
          id: item.id,
          form_level: item.form_level,
          class_name: item.class_name,
          is_active: item.is_active,
          total_students: count.total,
          active_students: count.active,
          inactive_students: count.inactive
        };
      });

      return response({
        classes,
        total_classes: classes.length,
        total_students: classes.reduce((sum, item) => sum + item.total_students, 0),
        active_students: classes.reduce((sum, item) => sum + item.active_students, 0)
      }, 200, origin);
    }

    if (action === "list_class_students") {
      const classId = typeof body.class_id === "string" ? body.class_id : "";
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(classId)) {
        return response({ error: "ID kelas tidak sah." }, 400, origin);
      }

      const classRows = await getClassRows(supabaseUrl, secretKey, {
        select: "id,form_level,class_name,is_active",
        id: "eq." + classId,
        limit: "1"
      });
      const selectedClass = Array.isArray(classRows) ? classRows[0] : null;
      if (!selectedClass) return response({ error: "Kelas tidak ditemui." }, 404, origin);

      const rows = await getProfileRows(supabaseUrl, secretKey, {
        select: "user_id,username,full_name,form_level,class_name,is_active,academic_class_id",
        role: "eq.student",
        academic_class_id: "eq." + classId,
        order: "full_name.asc",
        limit: "500"
      });

      return response({
        class: selectedClass,
        students: (Array.isArray(rows) ? rows : []).map((row) => ({
          user_id: row.user_id,
          username: row.username,
          full_name: row.full_name,
          form_level: row.form_level,
          class_name: row.class_name,
          academic_class_id: row.academic_class_id,
          is_active: row.is_active
        }))
      }, 200, origin);
    }

    if (action === "create_class") {
      const formLevel = Number(body.form_level);
      const className = typeof body.class_name === "string" ? body.class_name.trim() : "";
      if (![4, 5].includes(formLevel) || className.length < 1 || className.length > 60) {
        return response({ error: "Tingkatan atau nama kelas tidak sah." }, 400, origin);
      }
      const existing = await getClassRows(supabaseUrl, secretKey, {
        select: "id,class_name",
        form_level: "eq." + formLevel,
        limit: "200"
      });
      if ((Array.isArray(existing) ? existing : []).some((item) => String(item.class_name ?? "").toLowerCase() === className.toLowerCase())) {
        return response({ error: "Nama kelas tersebut sudah wujud untuk tingkatan ini." }, 409, origin);
      }
      const created = await fetch(new URL("/rest/v1/academic_classes", supabaseUrl), {
        method: "POST",
        headers: { apikey: secretKey, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ form_level: formLevel, class_name: className, is_active: true })
      });
      const rows = await created.json().catch(() => []);
      if (!created.ok) return response({ error: "Kelas gagal dicipta. Semak sama ada nama kelas telah digunakan." }, 502, origin);
      const item = Array.isArray(rows) ? rows[0] : null;
      return response({ message: "Kelas berjaya dicipta.", class: item }, 201, origin);
    }

    if (action === "rename_class") {
      const classId = typeof body.class_id === "string" ? body.class_id : "";
      const newName = typeof body.new_class_name === "string" ? body.new_class_name.trim() : "";
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(classId) ||
          newName.length < 1 || newName.length > 60) {
        return response({ error: "ID atau nama kelas tidak sah." }, 400, origin);
      }
      const renamed = await fetch(new URL("/rest/v1/rpc/admin_rename_academic_class", supabaseUrl), {
        method: "POST",
        headers: { apikey: secretKey, "Content-Type": "application/json" },
        body: JSON.stringify({ p_class_id: classId, p_new_class_name: newName })
      });
      const result = await renamed.json().catch(() => null);
      if (!renamed.ok || result !== true) {
        const detail = typeof result === "string" ? result : "";
        return response({ error: detail || "Nama kelas gagal dikemaskini." }, 409, origin);
      }
      return response({ message: "Nama kelas dan rekod murid berjaya dikemaskini." }, 200, origin);
    }

    if (action === "set_class_status") {
      const classId = typeof body.class_id === "string" ? body.class_id : "";
      const isActive = body.is_active;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(classId) ||
          typeof isActive !== "boolean") {
        return response({ error: "Permintaan status kelas tidak sah." }, 400, origin);
      }
      const url = new URL("/rest/v1/academic_classes", supabaseUrl);
      url.searchParams.set("id", "eq." + classId);
      const update = await fetch(url, {
        method: "PATCH",
        headers: { apikey: secretKey, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ is_active: isActive, updated_at: new Date().toISOString() })
      });
      const updatedRows = await update.json().catch(() => []);
      if (!update.ok || !Array.isArray(updatedRows) || updatedRows.length === 0) {
        return response({ error: "Status kelas gagal dikemaskini." }, 502, origin);
      }
      return response({ message: "Status kelas berjaya dikemaskini." }, 200, origin);
    }

    if (action === "delete_class") {
      const classId = typeof body.class_id === "string" ? body.class_id : "";
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(classId)) {
        return response({ error: "ID kelas tidak sah." }, 400, origin);
      }
      const assigned = await getProfileRows(supabaseUrl, secretKey, {
        select: "user_id",
        role: "eq.student",
        academic_class_id: "eq." + classId,
        limit: "1"
      });
      if (Array.isArray(assigned) && assigned.length > 0) {
        return response({ error: "Kelas masih mempunyai murid. Pindahkan semua murid sebelum kelas boleh dipadam." }, 409, origin);
      }
      const url = new URL("/rest/v1/academic_classes", supabaseUrl);
      url.searchParams.set("id", "eq." + classId);
      const deleted = await fetch(url, {
        method: "DELETE",
        headers: { apikey: secretKey, Prefer: "return=representation" }
      });
      if (!deleted.ok) return response({ error: "Kelas gagal dipadam." }, 502, origin);
      return response({ message: "Kelas kosong berjaya dipadam." }, 200, origin);
    }

    if (action === "transfer_student") {
      const userId = typeof body.user_id === "string" ? body.user_id : "";
      const classId = typeof body.class_id === "string" ? body.class_id : "";
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidPattern.test(userId) || !uuidPattern.test(classId)) {
        return response({ error: "ID murid atau kelas tidak sah." }, 400, origin);
      }
      const [profileRows, classRows] = await Promise.all([
        getProfileRows(supabaseUrl, secretKey, {
          select: "user_id,role",
          user_id: "eq." + userId,
          limit: "1"
        }),
        getClassRows(supabaseUrl, secretKey, {
          select: "id,form_level,class_name,is_active",
          id: "eq." + classId,
          limit: "1"
        })
      ]);
      const student = Array.isArray(profileRows) ? profileRows[0] : null;
      const targetClass = Array.isArray(classRows) ? classRows[0] : null;
      if (!student || student.role !== "student") return response({ error: "Rekod murid tidak ditemui." }, 404, origin);
      if (!targetClass || targetClass.is_active !== true) return response({ error: "Kelas sasaran tidak aktif atau tidak ditemui." }, 404, origin);
      const url = new URL("/rest/v1/user_profiles", supabaseUrl);
      url.searchParams.set("user_id", "eq." + userId);
      const updated = await fetch(url, {
        method: "PATCH",
        headers: { apikey: secretKey, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({
          academic_class_id: classId,
          form_level: targetClass.form_level,
          class_name: targetClass.class_name,
          updated_at: new Date().toISOString()
        })
      });
      const updatedRows = await updated.json().catch(() => []);
      if (!updated.ok || !Array.isArray(updatedRows) || updatedRows.length === 0) {
        return response({ error: "Murid gagal dipindahkan. Rekod asal dikekalkan." }, 502, origin);
      }
      return response({ message: "Murid berjaya dipindahkan ke kelas baharu." }, 200, origin);
    }

    if (action === "create") {
      const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
      const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
      const role = body.role;
      const password = typeof body.password === "string" ? body.password : "";
      const formLevel = body.form_level === 4 || body.form_level === 5 ? body.form_level : null;
      const className = typeof body.class_name === "string" ? body.class_name.trim() : "";

      if (!isUsername(username)) return response({ error: "Format username tidak sah. Gunakan 3–32 aksara atau e-mel yang sah." }, 400, origin);
      if (fullName.length < 2 || fullName.length > 150) return response({ error: "Nama penuh mesti antara 2 hingga 150 aksara." }, 400, origin);
      if (role !== "teacher" && role !== "student") return response({ error: "Role hanya boleh ditetapkan sebagai guru atau murid." }, 400, origin);
      if (password.length < 8 || password.length > 256) return response({ error: "Kata laluan mesti sekurang-kurangnya 8 aksara." }, 400, origin);
      if (role === "student" && (!formLevel || className.length < 1 || className.length > 60)) {
        return response({ error: "Untuk akaun murid, pilih tingkatan 4 atau 5 dan masukkan nama kelas." }, 400, origin);
      }
      if (role === "teacher" && (formLevel !== null || className.length > 0)) {
        return response({ error: "Maklumat tingkatan dan kelas hanya digunakan untuk akaun murid." }, 400, origin);
      }

      const existing = await getProfileRows(supabaseUrl, secretKey, {
        select: "user_id",
        username: `eq.${username}`,
        limit: "1"
      });
      if (Array.isArray(existing) && existing.length > 0) {
        return response({ error: "Username tersebut sudah digunakan." }, 409, origin);
      }

      // Plain usernames receive a non-deliverable internal Auth email address.
      // Email-style usernames (for example DELIMa) remain their own Auth email.
      let academicClassId: string | null = null;
      if (role === "student") {
        const classRows = await getClassRows(supabaseUrl, secretKey, {
          select: "id,form_level,class_name,is_active",
          form_level: "eq." + formLevel,
          is_active: "eq.true",
          limit: "200"
        });
        const selectedClass = (Array.isArray(classRows) ? classRows : []).find(
          (item) => String(item.class_name ?? "").toLowerCase() === className.toLowerCase()
        );
        if (!selectedClass) {
          return response({ error: "Pilih kelas aktif yang telah didaftarkan dalam Modul Pengurusan Kelas." }, 400, origin);
        }
        academicClassId = selectedClass.id;
      }

      const authEmail = username.includes("@")
        ? username
        : `${username}@accounts.ekonomismart.invalid`;

      const createAuth = await fetch(new URL("/auth/v1/admin/users", supabaseUrl), {
        method: "POST",
        headers: {
          apikey: secretKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: authEmail,
          password,
          email_confirm: true
        })
      });

      const createdPayload = await createAuth.json().catch(() => ({}));
      if (!createAuth.ok) {
        const message = createdPayload?.msg ?? createdPayload?.message ?? createdPayload?.error_description;
        if (createAuth.status === 422 || createAuth.status === 409) {
          return response({ error: "Akaun Auth untuk identiti tersebut sudah wujud atau tidak dapat dicipta. Semak akaun Supabase Auth." }, 409, origin);
        }
        console.error("Auth admin create user failed:", createAuth.status, message ?? "Unknown error");
        return response({ error: "Supabase Auth gagal mencipta akaun. Sila semak tetapan Auth." }, 502, origin);
      }

      const authId = createdPayload?.id ?? createdPayload?.user?.id;
      if (typeof authId !== "string") {
        console.error("Auth admin create user returned no user id.");
        return response({ error: "Akaun Auth dicipta tetapi ID pengguna tidak diterima. Hubungi pentadbir teknikal." }, 502, origin);
      }

      const profilePayload = {
        user_id: authId,
        username,
        full_name: fullName,
        role: role as ProfileRole,
        form_level: role === "student" ? formLevel : null,
        class_name: role === "student" ? className : null,
        academic_class_id: role === "student" ? academicClassId : null,
        is_active: true
      };

      const insertProfile = await fetch(new URL("/rest/v1/user_profiles", supabaseUrl), {
        method: "POST",
        headers: {
          apikey: secretKey,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify(profilePayload)
      });

      const insertedRows = await insertProfile.json().catch(() => []);
      if (!insertProfile.ok) {
        // Roll back the Auth user if the profile insert failed, so no orphaned login is left.
        await fetch(new URL(`/auth/v1/admin/users/${encodeURIComponent(authId)}`, supabaseUrl), {
          method: "DELETE",
          headers: { apikey: secretKey }
        });
        const detail = Array.isArray(insertedRows) ? insertedRows[0]?.message : insertedRows?.message;
        console.error("User profile insert failed:", insertProfile.status, detail ?? "Unknown error");
        return response({ error: "Profil pengguna gagal disimpan. Akaun Auth sementara telah dibatalkan." }, 502, origin);
      }

      const created = Array.isArray(insertedRows) ? insertedRows[0] : profilePayload;
      return response({
        message: "Akaun berjaya dicipta.",
        user: {
          user_id: created.user_id,
          username: created.username,
          full_name: created.full_name,
          role: created.role,
          form_level: created.form_level,
          class_name: created.class_name,
          is_active: created.is_active
        }
      }, 201, origin);
    }


    if (action === "bulk_create_students") {
      const rows = Array.isArray(body.rows) ? body.rows : [];
      if (rows.length < 1 || rows.length > 100) {
        return response({ error: "Fail mesti mengandungi antara 1 hingga 100 rekod murid." }, 400, origin);
      }

      const seenUsernames = new Set<string>();
      const results: Array<Record<string, unknown>> = [];

      for (let index = 0; index < rows.length; index += 1) {
        const raw = rows[index] as Record<string, unknown>;
        const rowNumber = Number.isInteger(raw?.row_number) ? Number(raw.row_number) : index + 2;
        const username = typeof raw?.username === "string" ? raw.username.trim().toLowerCase() : "";
        const fullName = typeof raw?.full_name === "string" ? raw.full_name.trim() : "";
        const password = typeof raw?.password === "string" ? raw.password : "";
        const formLevel = Number(raw?.form_level);
        const className = typeof raw?.class_name === "string" ? raw.class_name.trim() : "";

        const fail = (message: string) => {
          results.push({
            row_number: rowNumber,
            username: username || "(kosong)",
            full_name: fullName,
            success: false,
            message
          });
        };

        if (!isUsername(username)) {
          fail("Format username tidak sah.");
          continue;
        }
        if (seenUsernames.has(username)) {
          fail("Username berulang dalam fail import.");
          continue;
        }
        seenUsernames.add(username);

        if (fullName.length < 2 || fullName.length > 150) {
          fail("Nama penuh mesti antara 2 hingga 150 aksara.");
          continue;
        }
        if (password.length < 8 || password.length > 256) {
          fail("Password mesti sekurang-kurangnya 8 aksara.");
          continue;
        }
        if (formLevel !== 4 && formLevel !== 5) {
          fail("Tingkatan mesti 4 atau 5.");
          continue;
        }
        if (className.length < 1 || className.length > 60) {
          fail("Nama kelas wajib diisi (maksimum 60 aksara).");
          continue;
        }

        const existing = await getProfileRows(supabaseUrl, secretKey, {
          select: "user_id",
          username: "eq." + username,
          limit: "1"
        });
        if (Array.isArray(existing) && existing.length > 0) {
          fail("Username sudah wujud dalam sistem.");
          continue;
        }

        const classRows = await getClassRows(supabaseUrl, secretKey, {
          select: "id,form_level,class_name,is_active",
          form_level: "eq." + formLevel,
          is_active: "eq.true",
          limit: "200"
        });
        const selectedClass = (Array.isArray(classRows) ? classRows : []).find(
          (item) => String(item.class_name ?? "").toLowerCase() === className.toLowerCase()
        );
        if (!selectedClass) {
          fail("Nama kelas belum didaftarkan atau kelas tidak aktif.");
          continue;
        }

        const authEmail = username.includes("@")
          ? username
          : username + "@accounts.ekonomismart.invalid";

        let createAuth: Response;
        let createdPayload: Record<string, unknown>;
        try {
          createAuth = await fetch(new URL("/auth/v1/admin/users", supabaseUrl), {
            method: "POST",
            headers: {
              apikey: secretKey,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              email: authEmail,
              password,
              email_confirm: true
            })
          });
          createdPayload = await createAuth.json().catch(() => ({}));
        } catch {
          fail("Tidak dapat menghubungi Supabase Auth. Cuba import semula baris ini.");
          continue;
        }

        if (!createAuth.ok) {
          const detail = createdPayload?.msg ?? createdPayload?.message ?? createdPayload?.error_description;
          if (createAuth.status === 422 || createAuth.status === 409) {
            fail("Identiti Auth sudah wujud atau tidak diterima. Semak username/e-mel.");
          } else {
            console.error("Bulk Auth create failed:", createAuth.status, detail ?? "Unknown error");
            fail("Supabase Auth gagal mencipta akaun.");
          }
          continue;
        }

        const authId = createdPayload?.id ?? (createdPayload?.user as Record<string, unknown> | undefined)?.id;
        if (typeof authId !== "string") {
          fail("Supabase Auth tidak memulangkan ID akaun.");
          continue;
        }

        const profilePayload = {
          user_id: authId,
          username,
          full_name: fullName,
          role: "student",
          form_level: formLevel,
          class_name: className,
          academic_class_id: selectedClass.id,
          is_active: true
        };

        let insertProfile: Response;
        let insertedRows: unknown;
        try {
          insertProfile = await fetch(new URL("/rest/v1/user_profiles", supabaseUrl), {
            method: "POST",
            headers: {
              apikey: secretKey,
              "Content-Type": "application/json",
              Prefer: "return=representation"
            },
            body: JSON.stringify(profilePayload)
          });
          insertedRows = await insertProfile.json().catch(() => []);
        } catch {
          await fetch(new URL("/auth/v1/admin/users/" + encodeURIComponent(authId), supabaseUrl), {
            method: "DELETE",
            headers: { apikey: secretKey }
          });
          fail("Profil gagal disimpan. Akaun Auth sementara telah dibatalkan.");
          continue;
        }

        if (!insertProfile.ok) {
          await fetch(new URL("/auth/v1/admin/users/" + encodeURIComponent(authId), supabaseUrl), {
            method: "DELETE",
            headers: { apikey: secretKey }
          });
          const detail = Array.isArray(insertedRows)
            ? (insertedRows[0] as Record<string, unknown> | undefined)?.message
            : (insertedRows as Record<string, unknown> | null)?.message;
          console.error("Bulk profile insert failed:", insertProfile.status, detail ?? "Unknown error");
          fail("Profil gagal disimpan; akaun Auth sementara telah dibatalkan.");
          continue;
        }

        results.push({
          row_number: rowNumber,
          username,
          full_name: fullName,
          success: true,
          message: "Akaun murid berjaya dicipta."
        });
      }

      const createdCount = results.filter((item) => item.success === true).length;
      return response({
        message: "Import pukal selesai diproses.",
        total: rows.length,
        created: createdCount,
        failed: rows.length - createdCount,
        results
      }, 200, origin);
    }

    if (action === "set_status") {
      const userId = typeof body.user_id === "string" ? body.user_id : "";
      const isActive = body.is_active;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId) ||
          typeof isActive !== "boolean") {
        return response({ error: "Permintaan status akaun tidak sah." }, 400, origin);
      }
      const targetRows = await getProfileRows(supabaseUrl, secretKey, {
        select: "user_id,role",
        user_id: `eq.${userId}`,
        limit: "1"
      });
      const target = Array.isArray(targetRows) ? targetRows[0] : null;
      if (!target || target.role === "admin") {
        return response({ error: "Akaun pentadbir atau akaun yang tidak ditemui tidak boleh diubah di sini." }, 403, origin);
      }
      const url = new URL("/rest/v1/user_profiles", supabaseUrl);
      url.searchParams.set("user_id", `eq.${userId}`);
      const update = await fetch(url, {
        method: "PATCH",
        headers: {
          apikey: secretKey,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify({ is_active: isActive, updated_at: new Date().toISOString() })
      });
      if (!update.ok) return response({ error: "Status akaun gagal dikemaskini." }, 502, origin);
      return response({ message: "Status akaun dikemaskini." }, 200, origin);
    }

    return response({ error: "Tindakan tidak dikenali." }, 400, origin);
  } catch (error) {
    console.error("Admin user management request failed:", error);
    return response({ error: "Operasi tidak berjaya. Sila cuba lagi." }, 500, origin);
  }
});
