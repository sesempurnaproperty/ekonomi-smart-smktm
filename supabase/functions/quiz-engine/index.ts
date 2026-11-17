const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin"
};

const allowedOrigins = new Set([
  "https://ekonomi-smart-smktm.vercel.app",
  "https://ekonomi-smart-smktm-cikguikmalproperty-4855.vercel.app",
  "https://ekonomi-smart-smktm-git-main-cikguikmalproperty-4855.vercel.app",
  "http://localhost:3000"
]);

type JsonRecord = Record<string, unknown>;
type PortalRole = "admin" | "teacher" | "student";

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

function getKeys() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKey = readKeyMap("SUPABASE_SECRET_KEYS") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publishableKey = readKeyMap("SUPABASE_PUBLISHABLE_KEYS") ?? Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !secretKey || !publishableKey) {
    throw new Error("Konfigurasi Supabase untuk enjin kuiz belum lengkap.");
  }
  return { supabaseUrl, secretKey, publishableKey };
}

function send(body: JsonRecord, status: number, origin: string | null) {
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

function withQuery(base: string, values: Record<string, string>) {
  const url = new URL(base);
  for (const [key, value] of Object.entries(values)) url.searchParams.set(key, value);
  return url;
}

async function getRows(
  supabaseUrl: string,
  secretKey: string,
  table: string,
  query: Record<string, string>
): Promise<JsonRecord[]> {
  const url = withQuery(new URL("/rest/v1/" + table, supabaseUrl).toString(), query);
  const res = await fetch(url, {
    headers: { apikey: secretKey, Accept: "application/json" }
  });
  if (!res.ok) throw new Error(table + " query failed: " + res.status);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function insertRows(
  supabaseUrl: string,
  secretKey: string,
  table: string,
  rows: JsonRecord[],
  onConflict?: string
): Promise<JsonRecord[]> {
  const url = new URL("/rest/v1/" + table, supabaseUrl);
  if (onConflict) url.searchParams.set("on_conflict", onConflict);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: secretKey,
      "Content-Type": "application/json",
      Prefer: onConflict ? "resolution=merge-duplicates,return=representation" : "return=representation"
    },
    body: JSON.stringify(rows)
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(table + " insert failed: " + res.status + " " + body.slice(0, 400));
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function deleteRows(
  supabaseUrl: string,
  secretKey: string,
  table: string,
  query: Record<string, string>
): Promise<JsonRecord[]> {
  const url = withQuery(new URL("/rest/v1/" + table, supabaseUrl).toString(), query);
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      apikey: secretKey,
      Accept: "application/json",
      Prefer: "return=representation"
    }
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(table + " delete failed: " + res.status + " " + body.slice(0, 400));
  }
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}

async function updateRows(
  supabaseUrl: string,
  secretKey: string,
  table: string,
  query: Record<string, string>,
  patch: JsonRecord
): Promise<JsonRecord[]> {
  const url = withQuery(new URL("/rest/v1/" + table, supabaseUrl).toString(), query);
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: secretKey,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(patch)
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(table + " update failed: " + res.status + " " + body.slice(0, 400));
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function validateCaller(
  supabaseUrl: string,
  publishableKey: string,
  authorization: string
): Promise<{ userId: string; profile: JsonRecord } | null> {
  const authRes = await fetch(new URL("/auth/v1/user", supabaseUrl), {
    headers: {
      apikey: publishableKey,
      Authorization: authorization,
      Accept: "application/json"
    }
  });
  if (!authRes.ok) return null;
  const authUser = await authRes.json();
  const userId = authUser?.id;
  if (typeof userId !== "string") return null;

  const rows = await getRows(supabaseUrl, readKeyMap("SUPABASE_SECRET_KEYS") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", "user_profiles", {
    select: "user_id,full_name,role,form_level,class_name,is_active",
    user_id: "eq." + userId,
    limit: "1"
  });
  const profile = rows[0];
  if (!profile || profile.is_active !== true) return null;
  return { userId, profile };
}

function isStaff(profile: JsonRecord) {
  return profile.is_active === true && (profile.role === "admin" || profile.role === "teacher");
}

function asNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

async function getQuestionsAndOptions(
  supabaseUrl: string,
  secretKey: string,
  quizId: string
) {
  const questions = await getRows(supabaseUrl, secretKey, "quiz_questions", {
    select: "id,quiz_id,question_order,question_type,prompt,marks",
    quiz_id: "eq." + quizId,
    order: "question_order.asc",
    limit: "200"
  });
  const ids = questions.map((q) => String(q.id));
  if (!ids.length) return { questions, options: [] as JsonRecord[] };
  const options = await getRows(supabaseUrl, secretKey, "quiz_options", {
    select: "id,question_id,option_code,option_text,option_order",
    question_id: "in.(" + ids.join(",") + ")",
    order: "option_order.asc",
    limit: "1200"
  });
  return { questions, options };
}

async function getManageableQuiz(
  supabaseUrl: string,
  secretKey: string,
  quizId: string,
  profile: JsonRecord,
  callerId: string
): Promise<{ quiz?: JsonRecord; assignedClassIds?: string[]; error?: string; status?: number }> {
  if (!isStaff(profile)) {
    return { error: "Akses guru atau pentadbir diperlukan.", status: 403 };
  }

  const quizRows = await getRows(supabaseUrl, secretKey, "learning_quizzes", {
    select: "id,title,created_by,target_form_level,status",
    id: "eq." + quizId,
    limit: "1"
  });
  const quiz = quizRows[0];
  if (!quiz) return { error: "Kuiz tidak ditemui.", status: 404 };

  if (profile.role === "admin") return { quiz, assignedClassIds: [] };

  if (String(quiz.created_by) !== callerId) {
    return {
      error: "Guru hanya boleh memadam atau menetapkan semula kuiz yang dicipta melalui akaun sendiri. Hubungi pentadbir untuk kuiz milik guru lain.",
      status: 403
    };
  }

  const assignments = await getRows(supabaseUrl, secretKey, "class_teacher_assignments", {
    select: "class_id",
    teacher_user_id: "eq." + callerId,
    limit: "100"
  });
  const assignedClassIds = assignments.map((item) => String(item.class_id));
  if (!assignedClassIds.length) {
    return { error: "Tiada kelas yang ditugaskan kepada akaun guru ini.", status: 403 };
  }

  const assignedClasses = await getRows(supabaseUrl, secretKey, "academic_classes", {
    select: "id,form_level",
    id: "in.(" + assignedClassIds.join(",") + ")",
    is_active: "eq.true",
    limit: "100"
  });
  const assignedFormLevels = new Set(assignedClasses.map((item) => Number(item.form_level)));
  if (
    (quiz.target_form_level === 4 || quiz.target_form_level === 5) &&
    !assignedFormLevels.has(Number(quiz.target_form_level))
  ) {
    return { error: "Kuiz ini bukan untuk tingkatan yang ditugaskan kepada akaun guru anda.", status: 403 };
  }

  return { quiz, assignedClassIds };
}

async function resetQuizAttempts(
  supabaseUrl: string,
  secretKey: string,
  quizId: string,
  profile: JsonRecord,
  callerId: string
) {
  const access = await getManageableQuiz(supabaseUrl, secretKey, quizId, profile, callerId);
  if (!access.quiz) return { error: access.error ?? "Akses kuiz ditolak.", status: access.status ?? 403 };

  const quizRows = await updateRows(supabaseUrl, secretKey, "learning_quizzes", {
    id: "eq." + quizId
  }, {
    status: "draft",
    updated_at: new Date().toISOString()
  });
  if (!quizRows.length) return { error: "Kuiz tidak dapat ditarik balik untuk proses reset.", status: 409 };

  const allAttempts = await getRows(supabaseUrl, secretKey, "quiz_attempts", {
    select: "id,student_id,attempt_number",
    quiz_id: "eq." + quizId,
    limit: "2000"
  });

  let attemptsToDelete = allAttempts;
  if (profile.role === "teacher") {
    const assignedIds = new Set(access.assignedClassIds ?? []);
    const studentIds = [...new Set(allAttempts.map((attempt) => String(attempt.student_id)))];
    const students = studentIds.length ? await getRows(supabaseUrl, secretKey, "user_profiles", {
      select: "user_id,academic_class_id,role",
      user_id: "in.(" + studentIds.join(",") + ")",
      limit: "2000"
    }) : [];
    const studentMap = new Map(students.map((student) => [String(student.user_id), student]));
    attemptsToDelete = allAttempts.filter((attempt) => {
      const student = studentMap.get(String(attempt.student_id));
      return student?.role === "student" &&
        student?.academic_class_id &&
        assignedIds.has(String(student.academic_class_id));
    });
  }

  const ids = attemptsToDelete.map((attempt) => String(attempt.id));
  const deleted = ids.length
    ? await deleteRows(supabaseUrl, secretKey, "quiz_attempts", { id: "in.(" + ids.join(",") + ")" })
    : [];

  return {
    reset: true,
    quiz_id: quizId,
    deleted_attempts: deleted.length,
    remaining_attempts: allAttempts.length - deleted.length,
    unpublished: true,
    message: profile.role === "teacher"
      ? deleted.length + " percubaan daripada kelas yang ditugaskan telah direset. Kuiz ditarik balik dan perlu diterbitkan semula."
      : deleted.length + " percubaan kuiz telah direset. Kuiz ditarik balik dan perlu diterbitkan semula."
  };
}

async function deleteQuiz(
  supabaseUrl: string,
  secretKey: string,
  quizId: string,
  profile: JsonRecord,
  callerId: string
) {
  const access = await getManageableQuiz(supabaseUrl, secretKey, quizId, profile, callerId);
  if (!access.quiz) return { error: access.error ?? "Akses kuiz ditolak.", status: access.status ?? 403 };

  const allAttempts = await getRows(supabaseUrl, secretKey, "quiz_attempts", {
    select: "id,student_id",
    quiz_id: "eq." + quizId,
    limit: "2000"
  });

  if (profile.role === "teacher" && allAttempts.length) {
    const assignedIds = new Set(access.assignedClassIds ?? []);
    const studentIds = [...new Set(allAttempts.map((attempt) => String(attempt.student_id)))];
    const students = studentIds.length ? await getRows(supabaseUrl, secretKey, "user_profiles", {
      select: "user_id,academic_class_id,role",
      user_id: "in.(" + studentIds.join(",") + ")",
      limit: "2000"
    }) : [];
    const studentMap = new Map(students.map((student) => [String(student.user_id), student]));
    const outside = allAttempts.filter((attempt) => {
      const student = studentMap.get(String(attempt.student_id));
      return !student?.academic_class_id || !assignedIds.has(String(student.academic_class_id));
    });
    if (outside.length) {
      return {
        error: "Kuiz ini mempunyai percubaan daripada kelas di luar penugasan anda. Hanya pentadbir boleh memadam kuiz yang melibatkan kelas lain.",
        status: 403
      };
    }
  }

  const unpublished = await updateRows(supabaseUrl, secretKey, "learning_quizzes", {
    id: "eq." + quizId
  }, {
    status: "draft",
    updated_at: new Date().toISOString()
  });
  if (!unpublished.length) return { error: "Kuiz tidak dapat ditarik balik sebelum dipadam.", status: 409 };

  if (allAttempts.length) {
    await deleteRows(supabaseUrl, secretKey, "quiz_attempts", { quiz_id: "eq." + quizId });
  }

  const deleted = await deleteRows(supabaseUrl, secretKey, "learning_quizzes", { id: "eq." + quizId });
  if (!deleted.length) {
    return { error: "Percubaan telah direset tetapi kuiz tidak dapat dipadam. Kuiz kini berstatus draf; cuba semula atau hubungi pentadbir.", status: 409 };
  }

  return {
    deleted: true,
    quiz_id: quizId,
    title: String(access.quiz.title ?? ""),
    deleted_attempts: allAttempts.length,
    message: "Kuiz, semua soalan, pilihan jawapan, kunci jawapan dan rekod percubaan telah dipadam."
  };
}

async function deleteQuestion(
  supabaseUrl: string,
  secretKey: string,
  quizId: string,
  questionId: string,
  profile: JsonRecord,
  callerId: string
) {
  const access = await getManageableQuiz(supabaseUrl, secretKey, quizId, profile, callerId);
  if (!access.quiz) return { error: access.error ?? "Akses kuiz ditolak.", status: access.status ?? 403 };
  if (access.quiz.status === "published") {
    return { error: "Tarik balik penerbitan kuiz terlebih dahulu sebelum memadam soalan.", status: 409 };
  }

  const questionRows = await getRows(supabaseUrl, secretKey, "quiz_questions", {
    select: "id,question_order",
    id: "eq." + questionId,
    quiz_id: "eq." + quizId,
    limit: "1"
  });
  const question = questionRows[0];
  if (!question) return { error: "Soalan tidak ditemui dalam kuiz ini.", status: 404 };

  const attempts = await getRows(supabaseUrl, secretKey, "quiz_attempts", {
    select: "id",
    quiz_id: "eq." + quizId,
    limit: "2000"
  });
  if (attempts.length) {
    return {
      error: "Masih terdapat " + attempts.length + " percubaan murid. Reset percubaan kuiz terlebih dahulu. Jika percubaan kelas lain masih wujud, pentadbir perlu membuat reset penuh sebelum soalan boleh dipadam.",
      status: 409
    };
  }

  const deleted = await deleteRows(supabaseUrl, secretKey, "quiz_questions", {
    id: "eq." + questionId,
    quiz_id: "eq." + quizId
  });
  if (!deleted.length) return { error: "Soalan gagal dipadam.", status: 409 };

  const remaining = await getRows(supabaseUrl, secretKey, "quiz_questions", {
    select: "id,question_order",
    quiz_id: "eq." + quizId,
    order: "question_order.asc",
    limit: "500"
  });
  for (let index = 0; index < remaining.length; index += 1) {
    if (Number(remaining[index].question_order) !== index + 1) {
      await updateRows(supabaseUrl, secretKey, "quiz_questions", {
        id: "eq." + String(remaining[index].id)
      }, { question_order: index + 1, updated_at: new Date().toISOString() });
    }
  }

  return {
    deleted: true,
    question_id: questionId,
    remaining_questions: remaining.length,
    message: "Soalan berjaya dipadam. Nombor soalan telah disusun semula."
  };
}

async function studentCanTakeQuiz(
  supabaseUrl: string,
  secretKey: string,
  quizId: string,
  profile: JsonRecord
): Promise<JsonRecord | null> {
  if (profile.role !== "student" || profile.is_active !== true || (profile.form_level !== 4 && profile.form_level !== 5)) return null;
  const quizzes = await getRows(supabaseUrl, secretKey, "learning_quizzes", {
    select: "id,title,description,target_form_level,duration_minutes,attempt_limit,available_from,available_until,status",
    id: "eq." + quizId,
    limit: "1"
  });
  const quiz = quizzes[0];
  if (!quiz || quiz.status !== "published") return null;
  if (quiz.target_form_level !== null && quiz.target_form_level !== profile.form_level) return null;
  const now = Date.now();
  if (quiz.available_from && new Date(String(quiz.available_from)).getTime() > now) return null;
  if (quiz.available_until && new Date(String(quiz.available_until)).getTime() <= now) return null;
  return quiz;
}

async function startAttempt(
  supabaseUrl: string,
  secretKey: string,
  quizId: string,
  userId: string,
  profile: JsonRecord
) {
  const quiz = await studentCanTakeQuiz(supabaseUrl, secretKey, quizId, profile);
  if (!quiz) return { error: "Kuiz ini tidak tersedia untuk akaun anda atau belum diterbitkan.", status: 403 };

  const { questions, options } = await getQuestionsAndOptions(supabaseUrl, secretKey, quizId);
  if (!questions.length) return { error: "Kuiz ini belum mempunyai soalan.", status: 409 };
  const maxScore = questions.reduce((sum, q) => sum + asNumber(q.marks), 0);

  const existing = await getRows(supabaseUrl, secretKey, "quiz_attempts", {
    select: "id,quiz_id,student_id,attempt_number,status,started_at,max_score",
    quiz_id: "eq." + quizId,
    student_id: "eq." + userId,
    status: "eq.in_progress",
    order: "attempt_number.desc",
    limit: "1"
  });

  let attempt = existing[0];
  if (!attempt) {
    const attempts = await getRows(supabaseUrl, secretKey, "quiz_attempts", {
      select: "id,attempt_number",
      quiz_id: "eq." + quizId,
      student_id: "eq." + userId,
      order: "attempt_number.desc",
      limit: "10"
    });
    const attemptLimit = asNumber(quiz.attempt_limit, 1);
    if (attempts.length >= attemptLimit) {
      return { error: "Had percubaan kuiz telah digunakan.", status: 409 };
    }
    const created = await insertRows(supabaseUrl, secretKey, "quiz_attempts", [{
      quiz_id: quizId,
      student_id: userId,
      attempt_number: attempts.length + 1,
      status: "in_progress",
      max_score: maxScore
    }]);
    attempt = created[0];
  }

  const draftResponses = await getRows(supabaseUrl, secretKey, "quiz_responses", {
    select: "question_id,selected_option_id,response_text",
    attempt_id: "eq." + String(attempt.id),
    limit: "500"
  });

  return {
    attempt,
    draft_responses: draftResponses,
    quiz: {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      duration_minutes: quiz.duration_minutes,
      attempt_limit: quiz.attempt_limit
    },
    questions: questions.map((q) => ({
      ...q,
      options: options.filter((o) => o.question_id === q.id)
    }))
  };
}

async function saveDraftResponse(
  supabaseUrl: string,
  secretKey: string,
  attemptId: string,
  questionId: string,
  userId: string,
  selectedOptionId: string | null,
  responseText: string | null
) {
  const attempts = await getRows(supabaseUrl, secretKey, "quiz_attempts", {
    select: "id,quiz_id,status",
    id: "eq." + attemptId,
    student_id: "eq." + userId,
    status: "eq.in_progress",
    limit: "1"
  });
  const attempt = attempts[0];
  if (!attempt) return { error: "Percubaan tidak aktif atau bukan milik akaun anda.", status: 403 };

  const questions = await getRows(supabaseUrl, secretKey, "quiz_questions", {
    select: "id,quiz_id,question_type",
    id: "eq." + questionId,
    quiz_id: "eq." + String(attempt.quiz_id),
    limit: "1"
  });
  const question = questions[0];
  if (!question) return { error: "Soalan tidak sepadan dengan percubaan ini.", status: 400 };

  if (question.question_type === "objective") {
    if (selectedOptionId) {
      const options = await getRows(supabaseUrl, secretKey, "quiz_options", {
        select: "id",
        id: "eq." + selectedOptionId,
        question_id: "eq." + questionId,
        limit: "1"
      });
      if (!options.length) return { error: "Pilihan jawapan tidak sah.", status: 400 };
    }
    responseText = null;
  } else {
    selectedOptionId = null;
    responseText = typeof responseText === "string" ? responseText.slice(0, 12000) : "";
  }

  await insertRows(supabaseUrl, secretKey, "quiz_responses", [{
    attempt_id: attemptId,
    question_id: questionId,
    selected_option_id: selectedOptionId,
    response_text: responseText,
    auto_score: null,
    teacher_score: null
  }], "attempt_id,question_id");
  return { saved: true };
}

async function submitAttempt(
  supabaseUrl: string,
  secretKey: string,
  attemptId: string,
  userId: string,
  answersValue: unknown
) {
  if (!Array.isArray(answersValue)) return { error: "Format jawapan tidak sah.", status: 400 };
  const attempts = await getRows(supabaseUrl, secretKey, "quiz_attempts", {
    select: "id,quiz_id,student_id,status,started_at,max_score",
    id: "eq." + attemptId,
    student_id: "eq." + userId,
    limit: "1"
  });
  const attempt = attempts[0];
  if (!attempt || attempt.status !== "in_progress") {
    return { error: "Percubaan tidak ditemui atau telah dihantar.", status: 409 };
  }
  const { questions, options } = await getQuestionsAndOptions(supabaseUrl, secretKey, String(attempt.quiz_id));
  if (!questions.length) return { error: "Soalan kuiz tidak ditemui.", status: 409 };

  const ids = questions.map((q) => String(q.id));
  const keys = await getRows(supabaseUrl, secretKey, "quiz_answer_keys", {
    select: "question_id,correct_option_id",
    question_id: "in.(" + ids.join(",") + ")",
    limit: "500"
  });
  const keyMap = new Map(keys.map((key) => [String(key.question_id), String(key.correct_option_id ?? "")]));
  const answerMap = new Map<string, JsonRecord>();
  for (const item of answersValue as JsonRecord[]) {
    if (typeof item?.question_id === "string") answerMap.set(item.question_id, item);
  }

  const responses: JsonRecord[] = [];
  let objectiveScore = 0;
  let structuredCount = 0;
  for (const question of questions) {
    const qid = String(question.id);
    const answer = answerMap.get(qid) ?? {};
    if (question.question_type === "objective") {
      const selectedId = typeof answer.selected_option_id === "string" ? answer.selected_option_id : null;
      const validOption = selectedId ? options.some((o) => o.id === selectedId && o.question_id === qid) : false;
      const correctId = keyMap.get(qid) ?? "";
      const earned = validOption && selectedId === correctId ? asNumber(question.marks) : 0;
      objectiveScore += earned;
      responses.push({
        attempt_id: attemptId,
        question_id: qid,
        selected_option_id: validOption ? selectedId : null,
        response_text: null,
        auto_score: earned,
        teacher_score: null
      });
    } else {
      structuredCount += 1;
      const responseText = typeof answer.response_text === "string" ? answer.response_text.trim().slice(0, 12000) : "";
      responses.push({
        attempt_id: attemptId,
        question_id: qid,
        selected_option_id: null,
        response_text: responseText,
        auto_score: null,
        teacher_score: null
      });
    }
  }

  await insertRows(supabaseUrl, secretKey, "quiz_responses", responses, "attempt_id,question_id");
  const status = structuredCount > 0 ? "pending_review" : "graded";
  const updated = await updateRows(supabaseUrl, secretKey, "quiz_attempts", {
    id: "eq." + attemptId,
    student_id: "eq." + userId,
    status: "eq.in_progress"
  }, {
    status,
    submitted_at: new Date().toISOString(),
    objective_score: objectiveScore,
    teacher_score: structuredCount > 0 ? null : 0,
    total_score: objectiveScore,
    graded_at: structuredCount > 0 ? null : new Date().toISOString()
  });
  if (!updated.length) return { error: "Jawapan tidak dapat disimpan. Muat semula dan hubungi guru.", status: 409 };

  return {
    attempt_id: attemptId,
    status,
    objective_score: objectiveScore,
    max_score: asNumber(attempt.max_score),
    pending_review_questions: structuredCount
  };
}

async function setAnswerKey(
  supabaseUrl: string,
  secretKey: string,
  questionId: string,
  profile: JsonRecord,
  userId: string,
  correctOptionId: string | null,
  markingGuide: string | null
) {
  if (!isStaff(profile)) return { error: "Akses guru atau pentadbir diperlukan.", status: 403 };
  const questions = await getRows(supabaseUrl, secretKey, "quiz_questions", {
    select: "id,question_type",
    id: "eq." + questionId,
    limit: "1"
  });
  const question = questions[0];
  if (!question) return { error: "Soalan tidak ditemui.", status: 404 };

  if (question.question_type === "objective") {
    if (!correctOptionId) return { error: "Pilih satu jawapan betul.", status: 400 };
    const options = await getRows(supabaseUrl, secretKey, "quiz_options", {
      select: "id,question_id",
      id: "eq." + correctOptionId,
      question_id: "eq." + questionId,
      limit: "1"
    });
    if (!options.length) return { error: "Pilihan jawapan tidak sepadan dengan soalan.", status: 400 };
  } else if (correctOptionId) {
    return { error: "Soalan struktur tidak menggunakan pilihan jawapan objektif.", status: 400 };
  }

  await insertRows(supabaseUrl, secretKey, "quiz_answer_keys", [{
    question_id: questionId,
    correct_option_id: correctOptionId,
    marking_guide: markingGuide,
    updated_by: userId,
    updated_at: new Date().toISOString()
  }], "question_id");
  return { saved: true };
}

async function publishQuiz(
  supabaseUrl: string,
  secretKey: string,
  quizId: string,
  profile: JsonRecord
) {
  if (!isStaff(profile)) return { error: "Akses guru atau pentadbir diperlukan.", status: 403 };
  const quizzes = await getRows(supabaseUrl, secretKey, "learning_quizzes", {
    select: "id,status",
    id: "eq." + quizId,
    limit: "1"
  });
  if (!quizzes.length) return { error: "Kuiz tidak ditemui.", status: 404 };

  const { questions, options } = await getQuestionsAndOptions(supabaseUrl, secretKey, quizId);
  if (!questions.length) return { error: "Tambahkan sekurang-kurangnya satu soalan sebelum menerbitkan kuiz.", status: 409 };
  const objectiveIds = questions.filter((q) => q.question_type === "objective").map((q) => String(q.id));
  if (objectiveIds.length) {
    const keys = await getRows(supabaseUrl, secretKey, "quiz_answer_keys", {
      select: "question_id,correct_option_id",
      question_id: "in.(" + objectiveIds.join(",") + ")",
      limit: "500"
    });
    const keyIds = new Set(keys.filter((k) => k.correct_option_id).map((k) => String(k.question_id)));
    const notReady = objectiveIds.filter((id) =>
      !keyIds.has(id) || options.filter((o) => o.question_id === id).length < 2
    );
    if (notReady.length) return { error: "Lengkapkan pilihan jawapan dan kunci jawapan bagi semua soalan objektif sebelum menerbitkan kuiz.", status: 409 };
  }

  const updated = await updateRows(supabaseUrl, secretKey, "learning_quizzes", {
    id: "eq." + quizId
  }, { status: "published", updated_at: new Date().toISOString() });
  return { published: updated.length > 0 };
}

async function gradeResponse(
  supabaseUrl: string,
  secretKey: string,
  responseId: string,
  profile: JsonRecord,
  callerId: string,
  scoreValue: unknown,
  feedbackValue: unknown
) {
  if (!isStaff(profile)) return { error: "Akses guru atau pentadbir diperlukan.", status: 403 };
  const responseRows = await getRows(supabaseUrl, secretKey, "quiz_responses", {
    select: "id,attempt_id,question_id,auto_score,teacher_score",
    id: "eq." + responseId,
    limit: "1"
  });
  const responseRow = responseRows[0];
  if (!responseRow) return { error: "Jawapan murid tidak ditemui.", status: 404 };

  if (profile.role === "teacher") {
    const attemptRows = await getRows(supabaseUrl, secretKey, "quiz_attempts", {
      select: "id,student_id",
      id: "eq." + String(responseRow.attempt_id),
      limit: "1"
    });
    const attempt = attemptRows[0];
    if (!attempt) return { error: "Percubaan murid tidak ditemui.", status: 404 };

    const studentRows = await getRows(supabaseUrl, secretKey, "user_profiles", {
      select: "user_id,academic_class_id,is_active,role",
      user_id: "eq." + String(attempt.student_id),
      limit: "1"
    });
    const student = studentRows[0];
    if (!student || student.role !== "student" || student.is_active !== true || !student.academic_class_id) {
      return { error: "Murid ini tidak mempunyai kelas aktif yang sah.", status: 403 };
    }

    const assignments = await getRows(supabaseUrl, secretKey, "class_teacher_assignments", {
      select: "class_id",
      teacher_user_id: "eq." + callerId,
      class_id: "eq." + String(student.academic_class_id),
      limit: "1"
    });
    if (!assignments.length) {
      return { error: "Akses ditolak. Skrip ini bukan daripada kelas yang ditugaskan kepada anda.", status: 403 };
    }
  }

  const questions = await getRows(supabaseUrl, secretKey, "quiz_questions", {
    select: "id,question_type,marks",
    id: "eq." + String(responseRow.question_id),
    limit: "1"
  });
  const question = questions[0];
  if (!question || question.question_type !== "structured") return { error: "Hanya soalan struktur boleh diberikan markah manual.", status: 400 };
  const score = Number(scoreValue);
  const maximum = asNumber(question.marks);
  if (!Number.isFinite(score) || score < 0 || score > maximum) {
    return { error: "Markah mesti antara 0 hingga " + maximum + ".", status: 400 };
  }

  await updateRows(supabaseUrl, secretKey, "quiz_responses", {
    id: "eq." + responseId
  }, {
    teacher_score: score,
    feedback: typeof feedbackValue === "string" ? feedbackValue.trim().slice(0, 1200) : null,
    updated_at: new Date().toISOString()
  });

  const allResponses = await getRows(supabaseUrl, secretKey, "quiz_responses", {
    select: "id,question_id,auto_score,teacher_score",
    attempt_id: "eq." + String(responseRow.attempt_id),
    limit: "500"
  });
  const questionIds = allResponses.map((r) => String(r.question_id));
  const allQuestions = questionIds.length ? await getRows(supabaseUrl, secretKey, "quiz_questions", {
    select: "id,question_type",
    id: "in.(" + questionIds.join(",") + ")",
    limit: "500"
  }) : [];
  const questionMap = new Map(allQuestions.map((q) => [String(q.id), q]));
  const pending = allResponses.some((r) =>
    questionMap.get(String(r.question_id))?.question_type === "structured" && r.teacher_score === null
  );
  const objectiveScore = allResponses.reduce((sum, r) => sum + asNumber(r.auto_score), 0);
  const teacherScore = allResponses.reduce((sum, r) => sum + asNumber(r.teacher_score), 0);
  const attempts = await getRows(supabaseUrl, secretKey, "quiz_attempts", {
    select: "id",
    id: "eq." + String(responseRow.attempt_id),
    limit: "1"
  });
  if (attempts.length) {
    await updateRows(supabaseUrl, secretKey, "quiz_attempts", {
      id: "eq." + String(responseRow.attempt_id)
    }, {
      status: pending ? "pending_review" : "graded",
      objective_score: objectiveScore,
      teacher_score: teacherScore,
      total_score: objectiveScore + teacherScore,
      graded_at: pending ? null : new Date().toISOString()
    });
  }
  return {
    saved: true,
    pending_review: pending,
    objective_score: objectiveScore,
    teacher_score: teacherScore,
    total_score: objectiveScore + teacherScore
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (origin && !allowedOrigins.has(origin)) return send({ error: "Origin tidak dibenarkan." }, 403, origin);
    return new Response("ok", { headers: { ...corsHeaders, "Access-Control-Allow-Origin": origin ?? "null" } });
  }
  if (origin && !allowedOrigins.has(origin)) return send({ error: "Origin tidak dibenarkan." }, 403, origin);
  if (req.method !== "POST") return send({ error: "Kaedah permintaan tidak disokong." }, 405, origin);

  let body: JsonRecord;
  try {
    body = await req.json();
  } catch {
    return send({ error: "Permintaan tidak sah." }, 400, origin);
  }

  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return send({ error: "Sesi log masuk diperlukan." }, 401, origin);

  try {
    const { supabaseUrl, secretKey, publishableKey } = getKeys();
    const authRes = await fetch(new URL("/auth/v1/user", supabaseUrl), {
      headers: { apikey: publishableKey, Authorization: authorization, Accept: "application/json" }
    });
    if (!authRes.ok) return send({ error: "Sesi tidak sah atau telah tamat." }, 401, origin);
    const authUser = await authRes.json();
    const callerId = authUser?.id;
    if (typeof callerId !== "string") return send({ error: "Identiti pengguna tidak sah." }, 401, origin);

    const profiles = await getRows(supabaseUrl, secretKey, "user_profiles", {
      select: "user_id,full_name,role,form_level,class_name,is_active",
      user_id: "eq." + callerId,
      limit: "1"
    });
    const profile = profiles[0];
    if (!profile || profile.is_active !== true) return send({ error: "Akaun tidak aktif atau tidak dibenarkan." }, 403, origin);

    const action = typeof body.action === "string" ? body.action : "";
    let result: JsonRecord;

    if (action === "student_score_history") {
      if (profile.role !== "student") return send({ error: "Tindakan ini khusus untuk murid." }, 403, origin);
      const historyAttempts = await getRows(supabaseUrl, secretKey, "quiz_attempts", {
        select: "id,quiz_id,attempt_number,status,total_score,max_score,objective_score,submitted_at,started_at,graded_at",
        student_id: "eq." + callerId,
        order: "started_at.desc",
        limit: "1000"
      });
      const historyQuizIds = [...new Set(historyAttempts.map((attempt) => String(attempt.quiz_id)))];
      const historyQuizzes = historyQuizIds.length ? await getRows(supabaseUrl, secretKey, "learning_quizzes", {
        select: "id,title,description,target_form_level,attempt_limit,status",
        id: "in.(" + historyQuizIds.join(",") + ")",
        limit: "500"
      }) : [];
      result = {
        attempts: historyAttempts,
        quizzes: historyQuizzes
      };
    } else if (action === "start_attempt") {
      if (profile.role !== "student") return send({ error: "Tindakan ini khusus untuk murid." }, 403, origin);
      if (typeof body.quiz_id !== "string") return send({ error: "ID kuiz tidak sah." }, 400, origin);
      result = await startAttempt(supabaseUrl, secretKey, body.quiz_id, callerId, profile);
    } else if (action === "save_draft_response") {
      if (profile.role !== "student") return send({ error: "Tindakan ini khusus untuk murid." }, 403, origin);
      if (typeof body.attempt_id !== "string" || typeof body.question_id !== "string") return send({ error: "ID percubaan atau soalan tidak sah." }, 400, origin);
      result = await saveDraftResponse(
        supabaseUrl, secretKey, body.attempt_id, body.question_id, callerId,
        typeof body.selected_option_id === "string" ? body.selected_option_id : null,
        typeof body.response_text === "string" ? body.response_text : null
      );
    } else if (action === "submit_attempt") {
      if (profile.role !== "student") return send({ error: "Tindakan ini khusus untuk murid." }, 403, origin);
      if (typeof body.attempt_id !== "string") return send({ error: "ID percubaan tidak sah." }, 400, origin);
      result = await submitAttempt(supabaseUrl, secretKey, body.attempt_id, callerId, body.answers);
    } else if (action === "save_answer_key") {
      if (typeof body.question_id !== "string") return send({ error: "ID soalan tidak sah." }, 400, origin);
      result = await setAnswerKey(
        supabaseUrl, secretKey, body.question_id, profile, callerId,
        typeof body.correct_option_id === "string" ? body.correct_option_id : null,
        typeof body.marking_guide === "string" ? body.marking_guide : null
      );
    } else if (action === "publish_quiz") {
      if (typeof body.quiz_id !== "string") return send({ error: "ID kuiz tidak sah." }, 400, origin);
      result = await publishQuiz(supabaseUrl, secretKey, body.quiz_id, profile);
    } else if (action === "list_attempts") {
      if (!isStaff(profile)) return send({ error: "Akses guru atau pentadbir diperlukan." }, 403, origin);
      if (typeof body.quiz_id !== "string") return send({ error: "ID kuiz tidak sah." }, 400, origin);
      const attemptRows = await getRows(supabaseUrl, secretKey, "quiz_attempts", {
        select: "id,quiz_id,student_id,attempt_number,status,started_at,submitted_at,objective_score,teacher_score,total_score,max_score,graded_at",
        quiz_id: "eq." + body.quiz_id,
        order: "submitted_at.desc.nullslast,attempt_number.desc",
        limit: "500"
      });
      const studentIds = [...new Set(attemptRows.map((a) => String(a.student_id)))];
      const [quizRows, attemptProfileRows] = await Promise.all([
        getRows(supabaseUrl, secretKey, "learning_quizzes", {
          select: "id,target_form_level,chapter_id",
          id: "eq." + body.quiz_id,
          limit: "1"
        }),
        studentIds.length ? getRows(supabaseUrl, secretKey, "user_profiles", {
          select: "user_id,full_name,form_level,class_name,academic_class_id,is_active",
          user_id: "in.(" + studentIds.join(",") + ")",
          limit: "500"
        }) : Promise.resolve([])
      ]);
      const selectedQuiz = quizRows[0] ?? null;
      const attemptProfileMap = new Map(attemptProfileRows.map((p) => [String(p.user_id), p]));

      let assignedClassIds: string[] = [];
      if (profile.role === "teacher") {
        const assignments = await getRows(supabaseUrl, secretKey, "class_teacher_assignments", {
          select: "class_id",
          teacher_user_id: "eq." + callerId,
          limit: "100"
        });
        assignedClassIds = assignments.map((item) => String(item.class_id));
      }

      let rosterRows: JsonRecord[] = [];
      if (profile.role === "teacher" && assignedClassIds.length === 0) {
        rosterRows = [];
      } else {
        const rosterQuery: Record<string, string> = {
          select: "user_id,full_name,form_level,class_name,academic_class_id,is_active",
          role: "eq.student",
          is_active: "eq.true",
          order: "form_level.asc,class_name.asc,full_name.asc",
          limit: "2000"
        };
        if (profile.role === "teacher") {
          rosterQuery.academic_class_id = "in.(" + assignedClassIds.join(",") + ")";
        }
        if (selectedQuiz?.target_form_level === 4 || selectedQuiz?.target_form_level === 5) {
          rosterQuery.form_level = "eq." + String(selectedQuiz.target_form_level);
        }
        rosterRows = await getRows(supabaseUrl, secretKey, "user_profiles", rosterQuery);
      }

      const rosterMap = new Map(rosterRows.map((p) => [String(p.user_id), p]));
      const profileMap = new Map([...attemptProfileMap, ...rosterMap]);
      let visibleAttemptRows = attemptRows;
      if (profile.role === "teacher") {
        const assignedClassSet = new Set(assignedClassIds);
        visibleAttemptRows = attemptRows.filter((attempt) => {
          const student = profileMap.get(String(attempt.student_id));
          return Boolean(student?.is_active !== false && student?.academic_class_id &&
            assignedClassSet.has(String(student.academic_class_id)));
        });
      }
      const attemptIds = visibleAttemptRows.map((a) => String(a.id));
      const responseRows = attemptIds.length ? await getRows(supabaseUrl, secretKey, "quiz_responses", {
        select: "id,attempt_id,question_id,selected_option_id,response_text,auto_score,teacher_score,feedback",
        attempt_id: "in.(" + attemptIds.join(",") + ")",
        limit: "2000"
      }) : [];
      const questionIds = [...new Set(responseRows.map((r) => String(r.question_id)))];
      const questionRows = questionIds.length ? await getRows(supabaseUrl, secretKey, "quiz_questions", {
        select: "id,question_type,prompt,marks,question_order",
        id: "in.(" + questionIds.join(",") + ")",
        limit: "1000"
      }) : [];
      const answerKeyRows = questionIds.length ? await getRows(supabaseUrl, secretKey, "quiz_answer_keys", {
        select: "question_id,marking_guide",
        question_id: "in.(" + questionIds.join(",") + ")",
        limit: "1000"
      }) : [];
      const guideMap = new Map(answerKeyRows.map((row) => [String(row.question_id), row.marking_guide ?? null]));
      const optionIds = [...new Set(responseRows.map((r) => String(r.selected_option_id ?? "")).filter(Boolean))];
      const optionRows = optionIds.length ? await getRows(supabaseUrl, secretKey, "quiz_options", {
        select: "id,option_code,option_text",
        id: "in.(" + optionIds.join(",") + ")",
        limit: "1000"
      }) : [];
      const questionMap = new Map(questionRows.map((q) => [String(q.id), {
        ...q,
        marking_guide: guideMap.get(String(q.id)) ?? null
      }]));
      const optionMap = new Map(optionRows.map((o) => [String(o.id), o]));
      result = {
        students: rosterRows.map((student) => ({
          user_id: student.user_id,
          full_name: student.full_name,
          form_level: student.form_level,
          class_name: student.class_name,
          academic_class_id: student.academic_class_id
        })),
        attempts: visibleAttemptRows.map((attempt) => ({
          ...attempt,
          student: profileMap.get(String(attempt.student_id)) ?? null,
          responses: responseRows
            .filter((row) => row.attempt_id === attempt.id)
            .map((row) => ({
              ...row,
              question: questionMap.get(String(row.question_id)) ?? null,
              selected_option: row.selected_option_id ? optionMap.get(String(row.selected_option_id)) ?? null : null
            }))
        }))
      };
    } else if (action === "reset_quiz_attempts") {
      if (typeof body.quiz_id !== "string") return send({ error: "ID kuiz tidak sah." }, 400, origin);
      result = await resetQuizAttempts(supabaseUrl, secretKey, body.quiz_id, profile, callerId);
    } else if (action === "delete_quiz") {
      if (typeof body.quiz_id !== "string") return send({ error: "ID kuiz tidak sah." }, 400, origin);
      result = await deleteQuiz(supabaseUrl, secretKey, body.quiz_id, profile, callerId);
    } else if (action === "delete_question") {
      if (typeof body.quiz_id !== "string" || typeof body.question_id !== "string") {
        return send({ error: "ID kuiz atau soalan tidak sah." }, 400, origin);
      }
      result = await deleteQuestion(supabaseUrl, secretKey, body.quiz_id, body.question_id, profile, callerId);
    } else if (action === "grade_response") {
      if (typeof body.response_id !== "string") return send({ error: "ID jawapan tidak sah." }, 400, origin);
      result = await gradeResponse(supabaseUrl, secretKey, body.response_id, profile, callerId, body.teacher_score, body.feedback);
    } else {
      return send({ error: "Tindakan tidak dikenali." }, 400, origin);
    }

    const status = typeof result.status === "number" ? result.status : 200;
    if ("error" in result) return send({ error: String(result.error) }, status, origin);
    return send(result, status, origin);
  } catch (error) {
    console.error("Quiz engine request failed:", error);
    return send({ error: error instanceof Error ? error.message : "Operasi kuiz tidak berjaya." }, 500, origin);
  }
});
