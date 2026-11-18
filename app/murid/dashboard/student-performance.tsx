"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import styles from "./student-performance.module.css";

type AssessmentMark = {
  assessment_code: string;
  score: number | string | null;
  mark_status: string | null;
  updated_at: string | null;
};
type Assessment = { code: string; title: string; max_score: number; is_active: boolean };
type StudentIdentity = { user_id: string; full_name: string; form_level: number | null; class_name: string | null };
type TopicPerformance = {
  topic_id:string;
  topic_code:string;
  topic_title:string;
  chapter_id:string;
  chapter_number:number;
  chapter_title:string;
  earned:number;
  maximum:number;
  percentage:number|null;
  question_count:number;
  quiz_count:number;
  assessed:boolean;
};
type SyllabusPerformance = {
  chapters:{id:string;chapter_number:number;title:string;display_order:number}[];
  topics:TopicPerformance[];
  summary:{
    assessed_topics:number;
    total_topics:number;
    earned:number;
    maximum:number;
    percentage:number|null;
    best_quizzes:number;
    pending_review_attempts:number;
    last_updated:string|null;
  };
};
type PerformanceResponse = {
  student?: StudentIdentity;
  marks?: AssessmentMark[];
  assessments?: Assessment[];
  syllabus_performance?: SyllabusPerformance;
  last_updated?: string | null;
  error?: string;
};
type ActionPlan = { heading: string; explanation: string; tasks: string[]; tone: "positive" | "focus" | "urgent" | "neutral" };

async function fetchMyPerformance(): Promise<PerformanceResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Konfigurasi portal belum lengkap.");

  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("Sesi anda telah tamat. Sila log masuk semula.");
  }

  const response = await fetch(`${url}/functions/v1/admin-user-management`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${data.session.access_token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ action: "student_performance" }),
    cache: "no-store"
  });

  const result = (await response.json()) as PerformanceResponse;
  if (!response.ok) throw new Error(result.error ?? "Rekod pencapaian anda gagal dimuatkan.");

  const {data:syllabusData,error:syllabusError}=await supabase.functions.invoke("quiz-engine",{
    body:{action:"student_topic_performance"}
  });
  if(syllabusError||syllabusData?.error){
    throw new Error(syllabusError?.message??syllabusData?.error??"Analisis pencapaian mengikut bab gagal dimuatkan.");
  }
  return {...result,syllabus_performance:syllabusData as SyllabusPerformance};
}

function numberScore(mark?: AssessmentMark): number | null {
  if (!mark || mark.score === null || mark.score === undefined || mark.mark_status === "TH" || mark.mark_status === "X") return null;
  const value = Number(mark.score);
  return Number.isFinite(value) ? value : null;
}

function gradeFromScore(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "A-";
  if (score >= 65) return "B+";
  if (score >= 60) return "B";
  if (score >= 55) return "C+";
  if (score >= 50) return "C";
  if (score >= 45) return "D";
  if (score >= 40) return "E";
  return "G";
}

function formatScore(score: number | null): string {
  return score === null ? "—" : Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function getActionPlan(score: number | null, status: string | null): ActionPlan {
  if (status === "TH") {
    return {
      heading: "Rancang tindakan bersama guru",
      explanation: "Rekod anda ditandakan Tidak Hadir. Markah tidak dikira sebagai sifar dan tidak digunakan untuk menentukan gred.",
      tasks: [
        "Hubungi guru Ekonomi untuk menyemak pilihan pentaksiran atau tindakan susulan.",
        "Teruskan ulang kaji topik yang telah dipelajari supaya tidak ketinggalan.",
        "Semak semula rekod selepas guru mengemas kini status pentaksiran."
      ],
      tone: "neutral"
    };
  }
  if (status === "X") {
    return {
      heading: "Tiada sasaran markah untuk rekod ini",
      explanation: "Rekod anda ditandakan X dan dikecualikan daripada pengiraan purata serta gred.",
      tasks: [
        "Semak status ini dengan guru sekiranya anda merasakan terdapat kesilapan.",
        "Teruskan pembelajaran dan latihan bagi pentaksiran yang masih berkuat kuasa."
      ],
      tone: "neutral"
    };
  }
  if (score === null) {
    return {
      heading: "Lengkapkan rekod pentaksiran",
      explanation: "Markah belum direkodkan. Anda belum mempunyai ukuran pencapaian untuk pentaksiran ini.",
      tasks: [
        "Semak dengan guru sama ada markah telah dimasukkan.",
        "Teruskan ulang kaji nota dan latihan yang diberikan.",
        "Buka semula bahagian ini selepas rekod dikemas kini."
      ],
      tone: "neutral"
    };
  }
  if (score === 0) {
    return {
      heading: "Semak keputusan dengan guru",
      explanation: "Rekod semasa ialah 0 markah. Pastikan markah ini telah disahkan sebelum membuat kesimpulan tentang tahap penguasaan anda.",
      tasks: [
        "Minta guru menyemak ketepatan rekod markah.",
        "Kenal pasti semula konsep asas yang belum dikuasai bersama guru.",
        "Buat latihan berpandu dan semak jawapan selepas setiap latihan."
      ],
      tone: "urgent"
    };
  }
  if (score < 20) {
    return {
      heading: "Keutamaan: bina semula asas Ekonomi",
      explanation: "Markah anda menunjukkan banyak ruang untuk pengukuhan. Mulakan dengan konsep dan istilah asas sebelum beralih kepada soalan aplikasi.",
      tasks: [
        "Senaraikan istilah dan definisi utama yang masih sukar diingat.",
        "Buat latihan asas secara berpandu dan semak sebab jawapan betul atau salah.",
        "Bincang kesilapan dengan guru dan ulang semula soalan yang belum dikuasai."
      ],
      tone: "urgent"
    };
  }
  if (score < 40) {
    return {
      heading: "Fokus: capai tahap lulus",
      explanation: "Anda masih belum mencapai ambang 40 markah. Beri tumpuan kepada penguasaan konsep asas dan ketepatan menjawab.",
      tasks: [
        "Ulang kaji konsep utama dan maksud istilah Ekonomi.",
        "Jawab latihan pendek secara konsisten dan catat kesilapan berulang.",
        "Dapatkan bimbingan guru pada bahagian yang masih mengelirukan."
      ],
      tone: "urgent"
    };
  }
  if (score < 50) {
    return {
      heading: "Fokus: kukuhkan markah lulus",
      explanation: "Anda telah mencapai tahap lulus. Langkah seterusnya ialah mengurangkan kesilapan mudah dan menambah ketepatan jawapan.",
      tasks: [
        "Semak semula jawapan yang kehilangan markah kerana istilah atau fakta tidak tepat.",
        "Latih soalan yang memerlukan penerangan ringkas dan contoh.",
        "Sasarkan peningkatan sekurang-kurangnya 5 markah dalam latihan seterusnya."
      ],
      tone: "focus"
    };
  }
  if (score < 65) {
    return {
      heading: "Fokus: tingkatkan penguasaan",
      explanation: "Asas pencapaian anda sudah terbentuk. Beri perhatian kepada aplikasi konsep dan penerangan yang lebih tepat.",
      tasks: [
        "Terangkan konsep menggunakan contoh situasi ekonomi yang mudah.",
        "Buat latihan aplikasi dan semak ketepatan huraian.",
        "Sasarkan julat 65 markah dan ke atas dalam pentaksiran seterusnya."
      ],
      tone: "focus"
    };
  }
  if (score < 80) {
    return {
      heading: "Fokus: mantapkan jawapan aras tinggi",
      explanation: "Anda menunjukkan penguasaan yang baik. Tingkatkan kualiti huraian, aplikasi konsep dan keupayaan membuat perbandingan.",
      tasks: [
        "Latih soalan yang memerlukan sebab, kesan dan justifikasi.",
        "Semak sama ada setiap jawapan disokong istilah Ekonomi yang tepat.",
        "Kekalkan latihan berkala dan sasarkan gred A."
      ],
      tone: "positive"
    };
  }
  return {
    heading: "Kekalkan kecemerlangan",
    explanation: "Pencapaian anda berada pada tahap tinggi. Teruskan konsistensi dan tingkatkan kemahiran menjawab soalan yang lebih mencabar.",
    tasks: [
      "Kekalkan jadual ulang kaji dan latihan berkualiti.",
      "Perhalus jawapan dengan fakta, istilah dan huraian yang tepat.",
      "Cuba soalan aplikasi serta analisis yang lebih mencabar."
    ],
    tone: "positive"
  };
}

export default function StudentPerformance() {
  const [student, setStudent] = useState<StudentIdentity | null>(null);
  const [marks, setMarks] = useState<AssessmentMark[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [syllabusPerformance,setSyllabusPerformance]=useState<SyllabusPerformance|null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchMyPerformance();
      setStudent(data.student ?? null);
      setMarks(data.marks ?? []);
      setAssessments((data.assessments ?? []).filter((item) => item.is_active));
      setSyllabusPerformance(data.syllabus_performance??null);
      setLastUpdated(data.last_updated ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Data pencapaian gagal dimuatkan.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const markMap = useMemo(() => new Map(marks.map((mark) => [mark.assessment_code, mark])), [marks]);
  const pptMark = markMap.get("PPT2026");
  const patMark = markMap.get("PAT2026");
  const pptScore = numberScore(pptMark);
  const patScore = numberScore(patMark);
  const isPatCekalPending = student?.form_level === 5
    && (student.class_name ?? "").trim().toLowerCase() === "cekal"
    && patScore === 0;

  const latestMark = isPatCekalPending ? pptMark : (patMark ?? pptMark);
  const latestScore = isPatCekalPending ? pptScore : numberScore(latestMark);
  const latestStatus = latestMark?.mark_status ?? null;
  const actionPlan = getActionPlan(latestScore, latestStatus);

  const canCompare = pptScore !== null && patScore !== null && !isPatCekalPending;
  const scoreChange = canCompare ? (patScore as number) - (pptScore as number) : null;
  const pptGrade = pptScore === null ? null : gradeFromScore(pptScore);
  const patGrade = patScore === null || isPatCekalPending ? null : gradeFromScore(patScore);
  const assessmentByCode = useMemo(() => new Map(assessments.map((item) => [item.code, item])), [assessments]);

  const progressMessage = canCompare
    ? scoreChange! > 0 ? "Markah anda meningkat" : scoreChange! < 0 ? "Markah anda menurun" : "Markah anda kekal"
    : isPatCekalPending ? "Keputusan PAT sedang dikemas kini oleh guru"
    : "Perbandingan belum tersedia";

  const progressTone = canCompare
    ? scoreChange! > 0 ? styles.tonePositive : scoreChange! < 0 ? styles.toneUrgent : styles.toneNeutral
    : styles.toneNeutral;

  const updatedLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleString("ms-MY", { dateStyle: "medium", timeStyle: "short" })
    : "Belum ada rekod kemas kini";

  function renderAssessmentCard(code: "PPT2026" | "PAT2026", mark?: AssessmentMark) {
    const score = numberScore(mark);
    const pending = code === "PAT2026" && isPatCekalPending;
    const status = mark?.mark_status ?? null;
    const title = assessmentByCode.get(code)?.title ?? code;
    const max = assessmentByCode.get(code)?.max_score ?? 100;
    const cardGrade = score === null || pending ? null : gradeFromScore(score);
    const displayScore = score === null ? (status === "TH" ? "TH" : status === "X" ? "X" : "—") : formatScore(score);

    return (
      <article className={styles.markCard} key={code}>
        <div className={styles.markCardTop}>
          <span className={styles.markCardLabel}>{title}</span>
          <span className={pending ? styles.pendingBadge : styles.recordBadge}>
            {pending ? "SEMENTARA" : status === "TH" ? "TIDAK HADIR" : status === "X" ? "DIKECUALIKAN" : mark ? "DIREKODKAN" : "BELUM DIREKOD"}
          </span>
        </div>
        <div className={styles.markDisplay}>
          <strong>{pending ? "Menunggu" : displayScore}</strong>
          <span>{pending ? "kemas kini guru" : score === null ? "" : `/ ${max}`}</span>
        </div>
        <div className={styles.markCardFoot}>
          <span>{cardGrade ? `Gred ${cardGrade}` : pending ? "Belum dinilai" : status === "TH" ? "Tiada gred" : status === "X" ? "Tiada gred" : score === null ? "Tiada markah" : `Gred ${gradeFromScore(score)}`}</span>
          {score !== null && !pending && status === null ? <span>{Math.round(score / max * 100)}%</span> : null}
        </div>
        {score !== null && !pending && status === null ? (
          <div className={styles.markTrack}><div className={styles.markFill} style={{ width: `${Math.max(0, Math.min(100, score / max * 100))}%` }} /></div>
        ) : null}
      </article>
    );
  }

  return (
    <section className={styles.performanceSection}>
      <div className={styles.sectionHeader}>
        <div>
          <span className={styles.sectionEyebrow}>PAPAN PEMANTAUAN AKADEMIK</span>
          <h2 className={styles.sectionTitle}>Prestasi saya</h2>
          <p className={styles.sectionDescription}>Semak markah sendiri, perkembangan dan tindakan yang boleh anda ambil untuk meningkatkan pencapaian Ekonomi.</p>
        </div>
        <button className={styles.refreshButton} type="button" onClick={() => void refresh()} disabled={loading}>
          {loading ? "Memuatkan..." : "Muat semula"}
        </button>
      </div>

      {loading ? <div className={styles.stateBox}>Sedang mendapatkan rekod pencapaian peribadi anda...</div> : null}
      {error ? <div className={styles.errorBox}>{error}</div> : null}

      {!loading && !error ? (
        <>
          <div className={styles.markGrid}>
            {renderAssessmentCard("PPT2026", pptMark)}
            {renderAssessmentCard("PAT2026", patMark)}
          </div>

          {isPatCekalPending ? (
            <div className={styles.pendingNotice}>
              <strong>Keputusan PAT 2026 anda masih sementara.</strong>
              <span>Guru sedang mengemas kini markah PAT bagi kelas 5 Cekal. Nilai sifar yang direkodkan buat masa ini tidak digunakan untuk menentukan gred, perkembangan atau tindakan intervensi anda.</span>
            </div>
          ) : null}

          <section className={styles.syllabusSection}>
            <div className={styles.syllabusHeader}>
              <div>
                <span className={styles.sectionEyebrow}>ANALISIS MENGIKUT SILIBUS</span>
                <h3>Penguasaan bab dan subbab</h3>
                <p>Markah berdasarkan percubaan terbaik yang telah selesai dinilai bagi setiap kuiz. Rekod yang belum diuji atau masih menunggu semakan tidak dikira sebagai markah akhir.</p>
              </div>
              <div className={styles.syllabusOverall}>
                <strong>{syllabusPerformance?.summary.percentage===null||syllabusPerformance?.summary.percentage===undefined?"—":syllabusPerformance.summary.percentage+"%"}</strong>
                <span>PENCAPAIAN TERKUMPUL</span>
              </div>
            </div>
            <div className={styles.syllabusStats}>
              <div><strong>{syllabusPerformance?.summary.assessed_topics??0}/{syllabusPerformance?.summary.total_topics??16}</strong><span>SUBBAB DINILAI</span></div>
              <div><strong>{syllabusPerformance?.summary.best_quizzes??0}</strong><span>KUIZ SELESAI DINILAI</span></div>
              <div><strong>{syllabusPerformance?.summary.pending_review_attempts??0}</strong><span>MENUNGGU SEMAKAN</span></div>
            </div>
            <div className={styles.syllabusChapterGrid}>
              {(syllabusPerformance?.chapters??[]).map(chapter=>{
                const chapterTopics=(syllabusPerformance?.topics??[]).filter(topic=>topic.chapter_id===chapter.id);
                const assessed=chapterTopics.filter(topic=>topic.assessed);
                const earned=assessed.reduce((sum,topic)=>sum+topic.earned,0);
                const maximum=assessed.reduce((sum,topic)=>sum+topic.maximum,0);
                const chapterPercent=maximum>0?Math.round((earned/maximum)*1000)/10:null;
                return (
                  <article className={styles.syllabusChapterCard} key={chapter.id}>
                    <div className={styles.syllabusChapterHeading}>
                      <div><span>BAB {chapter.chapter_number}</span><h4>{chapter.title}</h4></div>
                      <strong>{chapterPercent===null?"—":chapterPercent+"%"}</strong>
                    </div>
                    <div className={styles.syllabusTopicList}>
                      {chapterTopics.map(topic=>(
                        <div className={styles.syllabusTopicRow} key={topic.topic_id}>
                          <div className={styles.syllabusTopicTop}>
                            <span><b>{topic.topic_code}</b> · {topic.topic_title}</span>
                            <strong>{topic.assessed?formatScore(topic.earned)+" / "+formatScore(topic.maximum):"Belum diuji"}</strong>
                          </div>
                          {topic.assessed?(
                            <div className={styles.syllabusTopicTrack}>
                              <span style={{width:Math.max(0,Math.min(100,topic.percentage??0))+"%"}}/>
                            </div>
                          ):(
                            <div className={styles.syllabusTopicNotTested}>Belum ada kuiz atau latihan yang selesai dinilai untuk subbab ini.</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <div className={styles.progressCard}>
            <div>
              <span className={styles.sectionEyebrow}>PERKEMBANGAN DIRI</span>
              <h3>Perubahan daripada PPT ke PAT</h3>
              <p>{progressMessage}</p>
            </div>
            <div className={styles.progressValue}>
              {canCompare ? (
                <>
                  <strong className={scoreChange! > 0 ? styles.positiveText : scoreChange! < 0 ? styles.urgentText : ""}>
                    {scoreChange! > 0 ? "+" : ""}{formatScore(scoreChange)}
                  </strong>
                  <span>markah</span>
                </>
              ) : <strong className={styles.progressPending}>—</strong>}
            </div>
            {canCompare ? (
              <div className={styles.progressDetail}>
                <span>PPT: {formatScore(pptScore)} ({pptGrade})</span>
                <span>PAT: {formatScore(patScore)} ({patGrade})</span>
              </div>
            ) : (
              <div className={`${styles.progressDetail} ${progressTone}`}>
                {isPatCekalPending ? "Perbandingan akan dipaparkan selepas markah PAT disahkan." : "Perbandingan memerlukan markah angka bagi kedua-dua pentaksiran."}
              </div>
            )}
          </div>

          <div className={`${styles.actionPlan} ${actionPlan.tone === "positive" ? styles.actionPositive : actionPlan.tone === "urgent" ? styles.actionUrgent : actionPlan.tone === "focus" ? styles.actionFocus : styles.actionNeutral}`}>
            <div className={styles.actionHead}>
              <div>
                <span className={styles.sectionEyebrow}>PANDUAN TINDAKAN PERIBADI</span>
                <h3>{actionPlan.heading}</h3>
                <p>{isPatCekalPending ? "Cadangan sementara berdasarkan markah PPT 2026 yang telah direkodkan." : "Cadangan ini dijana berdasarkan markah pentaksiran terkini yang telah boleh digunakan."}</p>
              </div>
              <span className={styles.actionScore}>{latestScore === null ? "—" : formatScore(latestScore)}</span>
            </div>
            <p className={styles.actionExplanation}>{actionPlan.explanation}</p>
            <ol className={styles.actionList}>
              {actionPlan.tasks.map((task, index) => <li key={index}>{task}</li>)}
            </ol>
          </div>

          <div className={styles.studentGuidance}>
            <strong>Bagaimana cadangan ini ditentukan?</strong>
            <p>Sistem menggunakan markah peperiksaan serta markah latihan/kuiz yang telah selesai dinilai. Analisis bab dan subbab memaparkan kutipan sebenar mengikut soalan yang dipautkan kepada silibus; subbab yang belum diuji kekal ditandakan belum diuji.</p>
          </div>

          <p className={styles.updatedNote}>Rekod peribadi dikemas kini terakhir: {updatedLabel}. Data yang dipaparkan adalah milik akaun anda sahaja.</p>
        </>
      ) : null}
    </section>
  );
}
