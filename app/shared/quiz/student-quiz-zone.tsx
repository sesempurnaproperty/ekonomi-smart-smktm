"use client";

import Link from "next/link";
import MobileHeaderMenu from "../navigation/mobile-header-menu";
import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient } from "../../../lib/supabase/client";
import styles from "./quiz.module.css";

type Quiz = {
  id: string;
  title: string;
  description: string | null;
  target_form_level: number | null;
  attempt_limit: number;
  status: string;
};
type AnswerImage={type:string;size:number;base64:string;preview:string;path?:string};\ntype MarkType = "right" | "wrong" | "tr" | "repeat";
type MarkAnnotation = { id:string; start:number; end:number; text:string; type:MarkType; comment?:string };
type SyllabusTopicInfo={
  id:string;topic_code:string;title:string;chapter_number:number;chapter_title:string;
};
type ScoredResponse = {
  id:string;
  response_text:string|null;
  auto_score:number|null;
  teacher_score:number|null;
  feedback:string|null;
  marking_annotations:MarkAnnotation[]|null;
  question:{question_order:number;question_type:"objective"|"structured";prompt:string;marks:number;image_path:string|null;image_url?:string|null;syllabus_topic_id:string;syllabus_topic?:SyllabusTopicInfo|null}|null;
};
type Attempt = {
  id: string;
  quiz_id: string;
  attempt_number: number;
  status: string;
  total_score: number;
  max_score: number;
  objective_score: number;
  submitted_at: string | null;
  responses?: ScoredResponse[];
};
type Option = { id: string; option_code: string; option_text: string; option_order: number };
type Question = {
  id: string;
  question_order: number;
  question_type: "objective" | "structured";
  prompt: string;
  marks: number;
  image_path: string | null;
  image_url?: string | null;
  syllabus_topic_id:string;
  syllabus_topic?:SyllabusTopicInfo|null;
  options: Option[];
};
type Active = {
  attempt: Attempt;
  quiz: { id: string; title: string; description: string | null };
  questions: Question[];
  draft_responses?: { question_id: string; selected_option_id: string | null; response_text: string | null; answer_image_paths?:string[] }[];
};
type Result = {
  attempt_id: string;
  status: string;
  objective_score: number;
  max_score: number;
  pending_review_questions: number;
};
type QuizProgress = {
  quiz: Quiz;
  attempts: Attempt[];
  latest: Attempt | null;
  best: Attempt | null;
  pendingCount: number;
  inProgressCount: number;
};

function displayMark(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}
function percent(score: number, maximum: number) {
  return maximum > 0 ? Math.max(0, Math.min(100, (score / maximum) * 100)) : 0;
}
function statusLabel(status: string) {
  if (status === "graded") return "SELESAI DINILAI";
  if (status === "pending_review") return "MENUNGGU SEMAKAN";
  return "SEDANG MENJAWAB";
}
const MARK_TYPES:{type:MarkType;symbol:string;label:string}[]=[
 {type:"right",symbol:"✓",label:"Mengandungi markah"},
 {type:"wrong",symbol:"✗",label:"Jawapan salah"},
 {type:"tr",symbol:"TR",label:"Tidak relevan"},
 {type:"repeat",symbol:"U",label:"Ulangan jawapan"}
];
function renderStudentMarkedAnswer(text:string,annotations:MarkAnnotation[]|null|undefined){
 const valid=(annotations??[]).filter(a=>Number.isInteger(a.start)&&Number.isInteger(a.end)&&a.start>=0&&a.end<=text.length&&a.end>a.start&&text.slice(a.start,a.end)===a.text).slice().sort((a,b)=>a.start-b.start);
 const nodes:ReactNode[]=[];let cursor=0;
 valid.forEach(a=>{
  if(a.start<cursor)return;
  if(a.start>cursor)nodes.push(<Fragment key={"student-plain-"+cursor}>{text.slice(cursor,a.start)}</Fragment>);
  const symbol=MARK_TYPES.find(x=>x.type===a.type)?.symbol??"";
  const cls=a.type==="right"?styles.studentMarkRight:a.type==="wrong"?styles.studentMarkWrong:a.type==="tr"?styles.studentMarkTR:styles.studentMarkRepeat;
  nodes.push(<mark key={a.id} className={cls}>{a.text}</mark>);
  nodes.push(<span key={"student-symbol-"+a.id} className={styles.studentMarkSymbol+" "+cls} title={MARK_TYPES.find(x=>x.type===a.type)?.label}>{symbol}</span>);
  cursor=a.end;
 });
 if(cursor<text.length)nodes.push(<Fragment key={"student-plain-end-"+cursor}>{text.slice(cursor)}</Fragment>);
 return nodes;
}

function getStudentMobileMenuItems() {
  return [
    {label:"Dashboard murid",href:"/murid/dashboard"},
    {label:"Nota dan bahan pembelajaran",href:"/murid/pembelajaran"},
    {label:"Latihan dan kuiz",href:"/murid/kuiz"}
  ];
}

export default function StudentQuizZone({ formLevel, className }: { formLevel: number; className: string | null }) {
  const supabase = useMemo(() => createClient(), []);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [active, setActive] = useState<Active | null>(null);
  const [answers, setAnswers] = useState<Record<string, { selected_option_id?: string; response_text?: string; answer_image_paths?:string[]; answer_images?:AnswerImage[] }>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    const [quizResult, historyResult] = await Promise.all([
      supabase.from("learning_quizzes")
        .select("id,title,description,target_form_level,attempt_limit,status")
        .eq("status", "published")
        .order("created_at", { ascending: false }),
      supabase.functions.invoke("quiz-engine", { body: { action: "student_score_history" } })
    ]);
    if (quizResult.error || historyResult.error || historyResult.data?.error) {
      setError(quizResult.error?.message ?? historyResult.error?.message ?? historyResult.data?.error ?? "Rekod kuiz gagal dimuatkan.");
      setLoading(false);
      return;
    }
    const availableQuizzes = (quizResult.data ?? []) as Quiz[];
    const historyQuizzes = (historyResult.data?.quizzes ?? []) as Quiz[];
    const quizMap = new Map<string, Quiz>();
    historyQuizzes.forEach((quiz) => quizMap.set(quiz.id, quiz));
    availableQuizzes.forEach((quiz) => quizMap.set(quiz.id, quiz));
    setQuizzes([...quizMap.values()]);

    const historyAttempts = (historyResult.data?.attempts ?? []) as Attempt[];
    const imagePaths = [...new Set(historyAttempts.flatMap(attempt =>
      (attempt.responses ?? []).map(response=>response.question?.image_path??null)
    ).filter((path):path is string=>typeof path==="string"&&path.length>0))];
    const imagePathsByQuiz=new Map<string,string[]>();
    historyAttempts.forEach(attempt=>(attempt.responses??[]).forEach(response=>{
      const path=response.question?.image_path;
      if(path){
        const current=imagePathsByQuiz.get(attempt.quiz_id)??[];
        current.push(path);
        imagePathsByQuiz.set(attempt.quiz_id,current);
      }
    }));
    const signedEntries=await Promise.all([...imagePathsByQuiz.entries()].map(async([quizId,paths])=>{
      const {data,error:signError}=await supabase.functions.invoke("quiz-engine",{
        body:{action:"sign_question_images",quiz_id:quizId,image_paths:[...new Set(paths)]}
      });
      if(signError||data?.error){
        setError(signError?.message??data?.error??"Gambar sejarah kuiz gagal dimuatkan.");
        return [];
      }
      return (data?.image_urls??[]) as {path:string;url:string}[];
    }));
    const signedMap=new Map<string,string>(signedEntries.flat().map(entry=>[entry.path,entry.url]));
    setAttempts(historyAttempts.map(attempt=>({
      ...attempt,
      responses:(attempt.responses??[]).map(response=>({
        ...response,
        question:response.question?{
          ...response.question,
          image_url:response.question.image_path?signedMap.get(response.question.image_path)??null:null
        }:null
      }))
    })));
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void refresh(); }, [refresh]);

  const quizProgress = useMemo<QuizProgress[]>(() => quizzes.map((quiz) => {
    const rows = attempts
      .filter((attempt) => attempt.quiz_id === quiz.id)
      .slice()
      .sort((a, b) => b.attempt_number - a.attempt_number);
    const graded = rows.filter((attempt) => attempt.status === "graded");
    const best = graded.reduce<Attempt | null>((current, candidate) => {
      if (!current) return candidate;
      const currentRate = current.max_score > 0 ? current.total_score / current.max_score : 0;
      const candidateRate = candidate.max_score > 0 ? candidate.total_score / candidate.max_score : 0;
      return candidateRate > currentRate ? candidate : current;
    }, null);
    return {
      quiz,
      attempts: rows,
      latest: rows[0] ?? null,
      best,
      pendingCount: rows.filter((attempt) => attempt.status === "pending_review").length,
      inProgressCount: rows.filter((attempt) => attempt.status === "in_progress").length
    };
  }), [quizzes, attempts]);

  const availableQuizProgress = useMemo(
    () => quizProgress.filter((item) => item.quiz.status === "published"),
    [quizProgress]
  );

  const scoreSummary = useMemo(() => {
    const assessed = quizProgress.filter((item) => item.best !== null);
    const earned = assessed.reduce((sum, item) => sum + Number(item.best?.total_score ?? 0), 0);
    const maximum = assessed.reduce((sum, item) => sum + Number(item.best?.max_score ?? 0), 0);
    return {
      earned,
      maximum,
      assessed: assessed.length,
      pending: attempts.filter((attempt) => attempt.status === "pending_review").length,
      inProgress: attempts.filter((attempt) => attempt.status === "in_progress").length,
      completed: attempts.filter((attempt) => attempt.status === "graded").length
    };
  }, [attempts, quizProgress]);

  async function start(quiz: Quiz) {
    setBusy(true);
    setError("");
    setNotice("");
    setResult(null);
    const { data, error: invokeError } = await supabase.functions.invoke("quiz-engine", {
      body: { action: "start_attempt", quiz_id: quiz.id }
    });
    setBusy(false);
    if (invokeError || data?.error) {
      setError(invokeError?.message ?? data?.error ?? "Kuiz gagal dimulakan.");
      return;
    }
    const view = data as Active;
    const imagePaths = [...new Set(view.questions.map(question=>question.image_path).filter((path):path is string=>typeof path==="string"&&path.length>0))];
    const signResult=imagePaths.length
      ? await supabase.functions.invoke("quiz-engine",{body:{action:"sign_question_images",quiz_id:quiz.id,image_paths:imagePaths}})
      : {data:{image_urls:[]},error:null};
    if(signResult.error||signResult.data?.error){
      setBusy(false);
      setError(signResult.error?.message??signResult.data?.error??"Gambar soalan gagal dimuatkan.");
      return;
    }
    const signedMap=new Map<string,string>((signResult.data?.image_urls??[]).map((entry:{path:string;url:string})=>[entry.path,entry.url]));
    const viewWithImages:Active={
      ...view,
      questions:view.questions.map(question=>({
        ...question,
        image_url:question.image_path?signedMap.get(question.image_path)??null:null
      }))
    };
    setActive(viewWithImages);
    const draft: Record<string, { selected_option_id?: string; response_text?: string }> = {};
    (view.draft_responses ?? []).forEach((row) => {
      draft[row.question_id] = {
        selected_option_id: row.selected_option_id ?? undefined,
        response_text: row.response_text ?? undefined
      };
    });
    setAnswers(draft);
  }

  async function saveDraft(questionId: string, selectedOptionId: string | null, responseText: string | null) {
    if (!active) return;
    const { data, error: invokeError } = await supabase.functions.invoke("quiz-engine", {
      body: {
        action: "save_draft_response",
        attempt_id: active.attempt.id,
        question_id: questionId,
        selected_option_id: selectedOptionId,
        response_text: responseText
      }
    });
    if (invokeError || data?.error) {
      setError(invokeError?.message ?? data?.error ?? "Jawapan sementara gagal disimpan.");
    }
  }

  async function addAnswerImages(questionId:string, files:FileList|null){
    if(!files||!active)return;
    const existing=answers[questionId]?.answer_images??[];
    for(const file of Array.from(files)){
      if(existing.length>=4){setError("Maksimum empat gambar bagi setiap soalan struktur.");break;}
      if(!["image/jpeg","image/png","image/webp"].includes(file.type)){setError("Format gambar jawapan mestilah JPG, PNG atau WebP.");continue;}
      if(file.size>4*1024*1024){setError("Saiz setiap gambar jawapan maksimum 4 MB.");continue;}
      if(existing.reduce((sum,item)=>sum+item.size,0)+file.size>16*1024*1024){setError("Jumlah saiz gambar jawapan maksimum 16 MB.");break;}
      try{
        const dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>typeof reader.result==="string"?resolve(reader.result):reject(new Error("Fail tidak dapat dibaca."));reader.onerror=()=>reject(new Error("Pelayar gagal membaca fail."));reader.readAsDataURL(file);});
        const comma=dataUrl.indexOf(",");
        const item:AnswerImage={type:file.type,size:file.size,base64:dataUrl.slice(comma+1),preview:dataUrl};
        setAnswers(current=>({...current,[questionId]:{...current[questionId],answer_images:[...(current[questionId]?.answer_images??[]),item]}}));
        existing.push(item);
      }catch(err){setError(err instanceof Error?err.message:"Gambar gagal dibaca.");}
    }
  }
  async function uploadAnswerImages(questionId:string){
    if(!active)return [];
    const current=answers[questionId]?.answer_images??[];
    const paths:string[]=[];
    for(const item of current){
      if(item.path){paths.push(item.path);continue;}
      const {data,error:uploadError}=await supabase.functions.invoke("quiz-engine",{body:{action:"upload_question_image",quiz_id:active.quiz.id,mime_type:item.type,image_base64:item.base64,category:"answer",attempt_id:active.attempt.id,question_id:questionId}});
      if(uploadError||data?.error)throw new Error(uploadError?.message??data?.error??"Gambar jawapan gagal dimuat naik.");
      if(typeof data?.image_path!=="string"||!data.image_path.startsWith(active.quiz.id+"/answers/"))throw new Error("Laluan gambar jawapan tidak sah.");
      paths.push(data.image_path);
    }
    setAnswers(current=>({...current,[questionId]:{...current[questionId],answer_image_paths:paths,answer_images:current[questionId]?.answer_images?.map((item,index)=>({...item,path:paths[index]}))??[]}}));
    return paths;
  }
  function removeAnswerImage(questionId:string,index:number){
    setAnswers(current=>{const images=(current[questionId]?.answer_images??[]).filter((_,i)=>i!==index);return {...current,[questionId]:{...current[questionId],answer_images:images,answer_image_paths:images.map(item=>item.path).filter((path):path is string=>Boolean(path))}};});
  }
  function choose(questionId: string, optionId: string) {
    setAnswers((current) => ({ ...current, [questionId]: { ...current[questionId], selected_option_id: optionId } }));
    void saveDraft(questionId, optionId, null);
  }

  function write(questionId: string, text: string) {
    setAnswers((current) => ({ ...current, [questionId]: { ...current[questionId], response_text: text } }));
  }

  function saveTextDraft(questionId: string) {
    void saveDraft(questionId, null, answers[questionId]?.response_text ?? "");
  }

  async function submit() {
    if (!active) return;
    const unanswered = active.questions.filter((question) =>
      question.question_type === "objective"
        ? !answers[question.id]?.selected_option_id
        : (!answers[question.id]?.response_text?.trim() && !(answers[question.id]?.answer_images?.length || answers[question.id]?.answer_image_paths?.length))
    ).length;
    const confirmation = unanswered
      ? unanswered + " soalan belum dijawab. Hantar juga?"
      : "Hantar jawapan sekarang? Anda tidak boleh mengubahnya selepas dihantar.";
    if (!window.confirm(confirmation)) return;

    setBusy(true);
    setError("");
    const payload = active.questions.map((question) => ({
      question_id: question.id,
      selected_option_id: answers[question.id]?.selected_option_id ?? null,
      response_text: answers[question.id]?.response_text ?? ""
    }));
    const { data, error: invokeError } = await supabase.functions.invoke("quiz-engine", {
      body: { action: "submit_attempt", attempt_id: active.attempt.id, answers: payload }
    });
    setBusy(false);
    if (invokeError || data?.error) {
      setError(invokeError?.message ?? data?.error ?? "Jawapan gagal dihantar.");
      return;
    }
    setResult(data as Result);
    setActive(null);
    setNotice("Jawapan telah dihantar. Markah objektif dipaparkan serta-merta; markah struktur menunggu semakan guru.");
    await refresh();
  }

  return (
    <main className={styles.pageShell}>
      <header className={styles.topBar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}><img src="/smk-taman-medan-logo.png" alt="Logo SMK Taman Medan" /></span>
          <span><strong>EKONOMI SMART</strong><small>LATIHAN DAN KUIZ</small></span>
        </div>
        <span className={styles.roleBadge}>TINGKATAN {formLevel}</span>
        <div className="mobile-header-actions"><MobileHeaderMenu roleLabel="MURID" items={getStudentMobileMenuItems()} /></div>
      </header>

      <section className={styles.pageContent}>
        <div className={styles.hero}>
          <span className={styles.eyebrow}>RUANG LATIHAN MURID</span>
          <h1>Latihan dan kuiz Ekonomi</h1>
          <p>Tingkatan {formLevel}{className ? " · " + className : ""} — jawab latihan dan pantau pencapaian anda.</p>
        </div>

        {error ? <div className={styles.errorBox}>{error}</div> : null}
        {notice ? <div className={styles.noticeBox}>{notice}</div> : null}

        {result ? (
          <section className={styles.resultCard+ " " +styles.resultCardComplete} aria-live="polite">
            <span className={styles.eyebrow}>PENGHANTARAN BERJAYA</span>
            <h2>Jawapan telah direkodkan</h2>
            <div className={styles.resultScore}><strong>{displayMark(result.objective_score)}</strong><span>/ {displayMark(result.max_score)} markah maksimum</span></div>
            <p>{result.pending_review_questions
              ? result.pending_review_questions + " soalan struktur menunggu semakan guru. Markah akhir akan dikemas kini selepas penilaian."
              : "Semua soalan dinilai secara automatik. Ini markah akhir percubaan."}</p>
            <div className={styles.resultActions}>
              <Link className={styles.primaryButton} href="/murid/dashboard">Kembali ke Dashboard</Link>
              <button className={styles.secondaryButton} type="button" onClick={() => setResult(null)}>Lihat rekod markah</button>
            </div>
          </section>
        ) : null}

        {!active ? (
          <section className={styles.studentScoreSection}>
            <div className={styles.scoreSectionHeading}>
              <div>
                <span className={styles.eyebrow}>PAPAN PEMANTAUAN AKADEMIK</span>
                <h2>Pencapaian saya</h2>
                <p>Markah terbaik bagi setiap kuiz dikira sekali sahaja. Percubaan belum selesai tidak dimasukkan dalam kutipan markah akhir.</p>
              </div>
              <button className={styles.textButton} type="button" onClick={() => void refresh()} disabled={loading}>
                {loading ? "Memuatkan..." : "KEMAS KINI REKOD ↻"}
              </button>
            </div>

            <div className={styles.scoreHeroCard}>
              <div className={styles.scoreHeroTop}>
                <div>
                  <span className={styles.scoreHeroLabel}>MARKAH TERBAIK TERKUMPUL</span>
                  <div className={styles.scoreHeroValue}>{displayMark(scoreSummary.earned)}<span> / {displayMark(scoreSummary.maximum)}</span></div>
                  <p>Daripada {scoreSummary.assessed} kuiz yang telah selesai dinilai</p>
                </div>
                <div className={styles.scoreHeroPercent}>{scoreSummary.maximum > 0 ? Math.round(percent(scoreSummary.earned, scoreSummary.maximum)) : 0}%</div>
              </div>
              <div className={styles.scoreProgressTrack}>
                <span style={{ width: percent(scoreSummary.earned, scoreSummary.maximum) + "%" }} />
              </div>
            </div>

            <div className={styles.scoreStatGrid}>
              <article className={styles.scoreStatCard}>
                <span className={styles.scoreStatIcon}>✓</span>
                <div><strong>{scoreSummary.completed}</strong><small>PERCUBAAN DINILAI</small></div>
              </article>
              <article className={styles.scoreStatCard}>
                <span className={styles.scoreStatIcon}>◷</span>
                <div><strong>{scoreSummary.pending}</strong><small>MENUNGGU SEMAKAN</small></div>
              </article>
              <article className={styles.scoreStatCard}>
                <span className={styles.scoreStatIcon}>✎</span>
                <div><strong>{scoreSummary.inProgress}</strong><small>SEDANG MENJAWAB</small></div>
              </article>
              <article className={styles.scoreStatCard}>
                <span className={styles.scoreStatIcon}>◎</span>
                <div><strong>{scoreSummary.assessed}</strong><small>KUIZ SELESAI DINILAI</small></div>
              </article>
            </div>

            <div className={styles.scoreListHeading}>
              <div><span className={styles.eyebrow}>REKOD INDIVIDU</span><h3>Kutipan markah mengikut kuiz</h3></div>
              <span className={styles.scoreListCount}>{quizProgress.length} KUIZ</span>
            </div>

            {loading ? (
              <div className={styles.emptyState}>Memuatkan rekod pencapaian anda...</div>
            ) : quizProgress.length === 0 ? (
              <div className={styles.emptyState}>Belum ada kuiz diterbitkan. Rekod markah akan muncul di sini selepas anda menjawab kuiz.</div>
            ) : (
              <div className={styles.studentScoreGrid}>
                {quizProgress.map((item) => {
                  const best = item.best;
                  const latest = item.latest;
                  const provisional = latest?.status === "pending_review" ? latest : null;
                  const score = best ? Number(best.total_score) : provisional ? Number(provisional.objective_score) : 0;
                  const maximum = best ? Number(best.max_score) : provisional ? Number(provisional.max_score) : 0;
                  return (
                    <article className={styles.studentScoreCard} key={item.quiz.id}>
                      <div className={styles.studentScoreCardTop}>
                        <span className={styles.eyebrow}>TINGKATAN {item.quiz.target_form_level ?? "4 & 5"}</span>
                        <span className={latest?.status === "graded" ? styles.scoreStatusDone : latest?.status === "pending_review" ? styles.scoreStatusPending : latest?.status === "in_progress" ? styles.scoreStatusProgress : styles.scoreStatusEmpty}>
                          {latest ? statusLabel(latest.status) : "BELUM DIJAWAB"}
                        </span>
                      </div>
                      <h4>{item.quiz.title}</h4>
                      <div className={styles.studentScoreCardMarks}>
                        <strong>{best ? displayMark(best.total_score) + " / " + displayMark(best.max_score) : provisional ? displayMark(provisional.objective_score) + " / " + displayMark(provisional.max_score) + " sementara" : "Belum ada markah"}</strong>
                        {best ? <span>MARKAH TERBAIK</span> : provisional ? <span>MARKAH OBJEKTIF SEMENTARA</span> : <span>MENUNGGU PERCUBAAN PERTAMA</span>}
                      </div>
                      <div className={styles.scoreProgressTrack}>
                        <span style={{ width: percent(score, maximum) + "%" }} />
                      </div>
                      <div className={styles.studentScoreMeta}>
                        <span>{item.attempts.length}/{item.quiz.attempt_limit} percubaan digunakan</span>
                        <span>{best ? Math.round(percent(Number(best.total_score), Number(best.max_score))) + "%" : provisional ? "Belum muktamad" : "—"}</span>
                      </div>
                      {item.attempts.length > 0 ? (
                        <div className={styles.studentAttemptHistory}>
                          {item.attempts.map((attempt) => (
                            <details className={styles.studentAttemptDetails} key={attempt.id}>
                              <summary className={styles.studentAttemptRow}>
                                <span>Percubaan {attempt.attempt_number} · LIHAT SKRIP</span>
                                <span className={attempt.status === "graded" ? styles.historyDone : attempt.status === "pending_review" ? styles.historyPending : styles.historyProgress}>
                                  {attempt.status === "graded"
                                    ? displayMark(attempt.total_score) + " / " + displayMark(attempt.max_score)
                                    : attempt.status === "pending_review"
                                      ? "Menunggu guru · " + displayMark(attempt.objective_score) + " markah objektif"
                                      : "Belum dihantar"}
                                </span>
                              </summary>
                              {attempt.responses?.length ? (
                                <div className={styles.studentMarkedScripts}>
                                  {attempt.responses.filter(response=>response.question?.question_type==="structured").map((response,index)=>(
                                    <article className={styles.studentMarkedScript} key={response.id}>
                                      <div className={styles.questionMeta}>
                                        <span>SOALAN {response.question?.question_order??index+1}</span>
                                        <span>{displayMark(response.teacher_score??0)} / {displayMark(response.question?.marks??0)} MARKAH STRUKTUR</span>
                                      </div>
                                      {response.question?.syllabus_topic?<div className={styles.studentQuestionSyllabusTag}>BAB {response.question.syllabus_topic.chapter_number} · {response.question.syllabus_topic.topic_code} · {response.question.syllabus_topic.title}</div>:null}
                                      {response.question?.image_url?<img className={styles.studentQuestionImage} src={response.question.image_url} alt={"Gambar soalan "+(response.question.question_order??index+1)}/>:null}
                                      {response.question?.prompt!=="Lihat gambar soalan"?<strong className={styles.studentMarkedQuestion}>{response.question?.prompt}</strong>:null}
                                      <div className={styles.studentMarkedAnswer}>{response.response_text?renderStudentMarkedAnswer(response.response_text,response.marking_annotations):"Tiada jawapan bertulis."}</div>
                                      {response.feedback?<p className={styles.studentMarkedFeedback}>Ulasan guru: {response.feedback}</p>:null}
                                    </article>
                                  ))}
                                  <div className={styles.studentMarkLegend}>
                                    {MARK_TYPES.map(mark=><span key={mark.type}><strong>{mark.symbol}</strong> {mark.label}</span>)}
                                  </div>
                                </div>
                              ) : (
                                <p className={styles.studentNoMarkedScript}>Skrip dan tanda pemarkahan akan dipaparkan selepas guru menyemak jawapan struktur.</p>
                              )}
                            </details>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        {active ? (
          <section className={styles.activeQuiz}>
            <div className={styles.activeQuizHeading}>
              <div>
                <span className={styles.eyebrow}>PERCUBAAN {active.attempt.attempt_number}</span>
                <h2>{active.quiz.title}</h2>
                <p>{active.quiz.description ?? "Jawab semua soalan dan hantar untuk semakan."}</p>
              </div>
              <span className={styles.roleBadge}>{active.questions.reduce((sum, question) => sum + Number(question.marks), 0)} MARKAH</span>
            </div>
            {active.questions.map((question) => (
              <article className={styles.studentQuestion} key={question.id}>
                <div className={styles.questionMeta}>
                  <span>SOALAN {question.question_order}</span>
                  <span>{question.marks} MARKAH</span>
                  <span>{question.question_type === "objective" ? "OBJEKTIF" : "STRUKTUR"}</span>
                </div>
                {question.syllabus_topic?<div className={styles.studentQuestionSyllabusTag}>BAB {question.syllabus_topic.chapter_number} · {question.syllabus_topic.topic_code} · {question.syllabus_topic.title}</div>:null}
                {question.image_url?<img className={styles.studentQuestionImage} src={question.image_url} alt={"Gambar soalan "+question.question_order}/>:null}
                {question.prompt!=="Lihat gambar soalan"?<h3>{question.prompt}</h3>:null}
                {question.question_type === "objective" ? (
                  <div className={styles.choiceList}>
                    {question.options.map((option) => (
                      <label key={option.id} className={answers[question.id]?.selected_option_id === option.id ? styles.choiceSelected : styles.choice}>
                        <input type="radio" name={question.id} checked={answers[question.id]?.selected_option_id === option.id} onChange={() => choose(question.id, option.id)} />
                        <span className={styles.choiceCode}>{option.option_code}</span>
                        {option.option_text?<span>{option.option_text}</span>:null}
                      </label>
                    ))}
                  </div>
                ) : (
                  <label className={styles.fullWidth}>Jawapan anda
                    <textarea rows={5} value={answers[question.id]?.response_text ?? ""} onChange={(event) => write(question.id, event.target.value)} onBlur={() => saveTextDraft(question.id)} placeholder="Tulis jawapan anda di sini..." />
                  </label>
                  <div className={styles.questionImageUploader}>
                    <strong>Gambar jawapan (pilihan)</strong>
                    <small>JPG, PNG atau WebP · Maksimum 4 MB setiap gambar · 4 gambar / 16 MB. Boleh hantar teks, gambar atau kedua-duanya.</small>
                    <label className={styles.imageUploadButton}>Tambah gambar jawapan
                      <input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy||(answers[question.id]?.answer_images?.length??0)>=4} onChange={event=>{void addAnswerImages(question.id,event.currentTarget.files);event.currentTarget.value="";}}/>
                    </label>
                    {(answers[question.id]?.answer_images??[]).map((item,index)=><div className={styles.questionImageLocalPreview} key={item.path??item.preview.slice(-30)}>{item.preview?<img src={item.preview} alt={"Pratonton jawapan "+(index+1)}/>:<span>Gambar telah disimpan</span>}<button type="button" className={styles.removeQuestionImageButton} disabled={busy} onClick={()=>removeAnswerImage(question.id,index)}>Buang gambar {index+1}</button></div>)}
                  </div>
                )}
              </article>
            ))}
            <div className={styles.submitBar}>
              <button className={styles.secondaryButton} type="button" onClick={() => setActive(null)}>Kembali</button>
              <button className={styles.primaryButton} type="button" disabled={busy} onClick={() => void submit()}>{busy ? "Menghantar..." : "Hantar jawapan"}</button>
            </div>
          </section>
        ) : (
          <>
            <div className={styles.sectionHeading}>
              <h2>Kuiz tersedia</h2>
              <button className={styles.textButton} type="button" onClick={() => void refresh()} disabled={loading}>{loading ? "Memuatkan..." : "Muat semula"}</button>
            </div>
            {loading ? (
              <div className={styles.emptyState}>Memuatkan senarai kuiz...</div>
            ) : availableQuizProgress.length === 0 ? (
              <div className={styles.emptyState}>Belum ada kuiz diterbitkan untuk akaun anda.</div>
            ) : (
              <div className={styles.quizGrid}>
                {availableQuizProgress.map((item) => {
                  const activeAttempt = item.attempts.find((attempt) => attempt.status === "in_progress");
                  const full = !activeAttempt && item.attempts.length >= item.quiz.attempt_limit;
                  return (
                    <article className={styles.quizCard} key={item.quiz.id}>
                      <div className={styles.questionMeta}>
                        <span>{item.quiz.target_form_level ? "TINGKATAN " + item.quiz.target_form_level : "TINGKATAN 4 & 5"}</span>
                        <span>{item.quiz.attempt_limit} PERCUBAAN</span>
                      </div>
                      <h2>{item.quiz.title}</h2>
                      <p>{item.quiz.description ?? "Latihan kendiri Ekonomi."}</p>
                      <div className={styles.quizCardMeta}>{item.attempts.length} / {item.quiz.attempt_limit} percubaan digunakan</div>
                      {item.attempts.map((attempt) => (
                        <div className={styles.pastAttempt} key={attempt.id}>
                          <span>Percubaan {attempt.attempt_number} · {statusLabel(attempt.status)}</span>
                          <strong>{attempt.status === "graded"
                            ? displayMark(attempt.total_score) + "/" + displayMark(attempt.max_score)
                            : attempt.status === "pending_review"
                              ? displayMark(attempt.objective_score) + " sementara"
                              : "—"}</strong>
                        </div>
                      ))}
                      <button className={styles.primaryButton} type="button" disabled={busy || full} onClick={() => void start(item.quiz)}>
                        {busy ? "Memproses..." : activeAttempt ? "Sambung percubaan" : full ? "Had percubaan digunakan" : "Mulakan kuiz"}
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}

        <p className={styles.privacyNote}>Markah akhir dikira daripada percubaan terbaik yang telah selesai dinilai. Markah sementara dan percubaan yang belum dihantar dipaparkan berasingan. Kunci jawapan tidak didedahkan kepada murid.</p>
      </section>
    </main>
  );
}
