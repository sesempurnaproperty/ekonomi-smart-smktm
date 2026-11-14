"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import styles from "./analytics.module.css";

type MarkValue = number | "TH" | "X" | null;
type Student = {
  user_id: string;
  full_name: string;
  form_level: number;
  class_name: string;
  academic_class_id: string | null;
  marks: Record<string, MarkValue>;
};
type ClassInfo = { id: string; form_level: number; class_name: string; is_active: boolean };
type Assessment = { code: string; title: string; max_score: number; is_active: boolean };
type AnalyticsResponse = { students?: Student[]; classes?: ClassInfo[]; assessments?: Assessment[]; last_updated?: string | null; error?: string };

async function getAnalytics(): Promise<AnalyticsResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Konfigurasi Supabase belum lengkap.");
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Sesi pentadbir tamat. Sila log masuk semula.");
  const response = await fetch(`${url}/functions/v1/admin-user-management`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "analytics_dashboard" }),
    cache: "no-store"
  });
  const result = (await response.json()) as AnalyticsResponse;
  if (!response.ok) throw new Error(result.error ?? "Data analitik gagal dimuatkan.");
  return result;
}

const gradeOrder = ["A+", "A", "A-", "B+", "B", "C+", "C", "D", "E", "G"];
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
function fmt(value: number | null, digits = 1): string {
  return value === null || !Number.isFinite(value) ? "—" : value.toFixed(digits);
}
function isNumeric(value: MarkValue): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function summarize(students: Student[], code: string, maxScore: number) {
  const values = students.map((student) => student.marks[code] ?? null);
  const numeric = values.filter(isNumeric);
  const th = values.filter((value) => value === "TH").length;
  const x = values.filter((value) => value === "X").length;
  const recorded = numeric.length + th + x;
  const pass = numeric.filter((value) => value >= 40).length;
  const fail = numeric.length - pass;
  const zeros = numeric.filter((value) => value === 0).length;
  const sorted = [...numeric].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length === 0 ? null : sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  const average = numeric.length ? numeric.reduce((sum, value) => sum + value, 0) / numeric.length : null;
  const grades = Object.fromEntries(gradeOrder.map((grade) => [grade, numeric.filter((value) => gradeFromScore(value) === grade).length])) as Record<string, number>;
  return {
    total: students.length, numeric: numeric.length, th, x, recorded, missing: Math.max(0, students.length - recorded),
    pass, fail, zeros, passRate: numeric.length ? pass / numeric.length * 100 : null,
    average, median, highest: numeric.length ? Math.max(...numeric) : null, lowest: numeric.length ? Math.min(...numeric) : null,
    coverage: students.length ? recorded / students.length * 100 : null, grades, maxScore
  };
}
type ProgressItem = { student: Student; ppt: number | null; pat: number | null; delta: number | null; status: "Meningkat" | "Merosot" | "Kekal" | "Belum lengkap" | "TH/X" };
function getProgress(student: Student): ProgressItem {
  const pptValue = student.marks.PPT2026 ?? null;
  const patValue = student.marks.PAT2026 ?? null;
  const ppt = isNumeric(pptValue) ? pptValue : null;
  const pat = isNumeric(patValue) ? patValue : null;
  if (ppt !== null && pat !== null) {
    const delta = pat - ppt;
    return { student, ppt, pat, delta, status: delta > 0 ? "Meningkat" : delta < 0 ? "Merosot" : "Kekal" };
  }
  if (pptValue === "TH" || pptValue === "X" || patValue === "TH" || patValue === "X") {
    return { student, ppt, pat, delta: null, status: "TH/X" };
  }
  return { student, ppt, pat, delta: null, status: "Belum lengkap" };
}

export default function AnalyticsDashboard() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [levelFilter, setLevelFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [assessmentCode, setAssessmentCode] = useState("PAT2026");
  const [search, setSearch] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAnalytics();
      setStudents(data.students ?? []);
      setClasses((data.classes ?? []).filter((item) => item.is_active));
      setAssessments((data.assessments ?? []).filter((item) => item.is_active));
      setLastUpdated(data.last_updated ?? null);
      if (data.assessments?.some((item) => item.code === "PAT2026" && item.is_active)) setAssessmentCode("PAT2026");
      else if (data.assessments?.length) setAssessmentCode(data.assessments[data.assessments.length - 1].code);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Data analitik gagal dimuatkan.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const currentAssessment = assessments.find((item) => item.code === assessmentCode) ?? assessments[0];
  const filteredStudents = useMemo(() => students.filter((student) => {
    const levelMatch = levelFilter === "all" || String(student.form_level) === levelFilter;
    const classMatch = classFilter === "all" || student.academic_class_id === classFilter;
    return levelMatch && classMatch;
  }), [students, levelFilter, classFilter]);

  const currentSummary = useMemo(() => summarize(filteredStudents, currentAssessment?.code ?? assessmentCode, currentAssessment?.max_score ?? 100), [filteredStudents, currentAssessment, assessmentCode]);
  const formSummaries = useMemo(() => [4, 5].map((level) => ({
    level,
    students: students.filter((student) => student.form_level === level),
    summary: summarize(students.filter((student) => student.form_level === level), assessmentCode, currentAssessment?.max_score ?? 100)
  })), [students, assessmentCode, currentAssessment]);
  const classSummaries = useMemo(() => classes
    .filter((item) => levelFilter === "all" || String(item.form_level) === levelFilter)
    .filter((item) => classFilter === "all" || item.id === classFilter)
    .map((item) => {
      const group = students.filter((student) => student.academic_class_id === item.id);
      return { item, group, summary: summarize(group, assessmentCode, currentAssessment?.max_score ?? 100) };
    }), [classes, students, levelFilter, classFilter, assessmentCode, currentAssessment]);

  const progressRows = useMemo(() => filteredStudents.map(getProgress).sort((a, b) => {
    if (a.delta === null && b.delta === null) return a.student.full_name.localeCompare(b.student.full_name);
    if (a.delta === null) return 1;
    if (b.delta === null) return -1;
    return b.delta - a.delta;
  }), [filteredStudents]);
  const searchedProgress = progressRows.filter((item) => item.student.full_name.toLowerCase().includes(search.toLowerCase()));
  const pairedProgress = progressRows.filter((item) => item.delta !== null);
  const improved = pairedProgress.filter((item) => (item.delta ?? 0) > 0).length;
  const declined = pairedProgress.filter((item) => (item.delta ?? 0) < 0).length;
  const unchanged = pairedProgress.filter((item) => item.delta === 0).length;
  const averageChange = pairedProgress.length ? pairedProgress.reduce((sum, item) => sum + (item.delta ?? 0), 0) / pairedProgress.length : null;
  const gradeMax = Math.max(1, ...gradeOrder.map((grade) => currentSummary.grades[grade] ?? 0));
  const latestLabel = lastUpdated ? new Date(lastUpdated).toLocaleString("ms-MY", { dateStyle: "medium", timeStyle: "short" }) : "Belum ada rekod";

  return (
    <div className={styles.analyticsWrap}>
      <div className={styles.analyticsToolbar}>
        <div className={styles.filterField}>
          <label htmlFor="analytics-level">TINGKATAN</label>
          <select id="analytics-level" value={levelFilter} onChange={(event) => { setLevelFilter(event.target.value); setClassFilter("all"); }}>
            <option value="all">Semua tingkatan</option><option value="4">Tingkatan 4</option><option value="5">Tingkatan 5</option>
          </select>
        </div>
        <div className={styles.filterField}>
          <label htmlFor="analytics-class">KELAS</label>
          <select id="analytics-class" value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
            <option value="all">Semua kelas</option>
            {classes.filter((item) => levelFilter === "all" || String(item.form_level) === levelFilter).map((item) => <option key={item.id} value={item.id}>T{item.form_level} · {item.class_name}</option>)}
          </select>
        </div>
        <div className={styles.filterField}>
          <label htmlFor="analytics-assessment">PENTAKSIRAN</label>
          <select id="analytics-assessment" value={assessmentCode} onChange={(event) => setAssessmentCode(event.target.value)}>
            {assessments.map((item) => <option key={item.code} value={item.code}>{item.title}</option>)}
          </select>
        </div>
        <div className={styles.toolbarActions}>
          <button className={styles.actionButton} type="button" onClick={() => void refresh()}>Muat semula</button>
          <button className={`${styles.actionButton} ${styles.actionButtonPrimary}`} type="button" onClick={() => window.print()}>Cetak / PDF</button>
        </div>
      </div>

      {loading ? <div className={styles.loadingBox}>Sedang memuatkan data pencapaian daripada pangkalan data...</div> : null}
      {error ? <div className={styles.errorBox}>{error}</div> : null}

      {!loading && !error && (
        <>
          <div className={styles.kpiGrid}>
            <article className={styles.kpiCard}><span className={styles.kpiLabel}>Murid aktif dalam pilihan</span><strong className={styles.kpiValue}>{currentSummary.total}</strong><span className={styles.kpiHint}>Murid aktif mengikut penapis tingkatan dan kelas</span></article>
            <article className={styles.kpiCard}><span className={styles.kpiLabel}>Purata markah</span><strong className={styles.kpiValue}>{fmt(currentSummary.average)}</strong><span className={styles.kpiHint}>Median {fmt(currentSummary.median)} · Tertinggi {fmt(currentSummary.highest, 0)} · Terendah {fmt(currentSummary.lowest, 0)}</span></article>
            <article className={styles.kpiCard}><span className={styles.kpiLabel}>Kadar lulus</span><strong className={styles.kpiValue}>{currentSummary.passRate === null ? "—" : fmt(currentSummary.passRate) + "%"}</strong><span className={styles.kpiHint}>{currentSummary.pass} lulus · {currentSummary.fail} belum mencapai 40 markah</span></article>
            <article className={styles.kpiCard}><span className={styles.kpiLabel}>Liputan rekod</span><strong className={styles.kpiValue}>{currentSummary.coverage === null ? "—" : fmt(currentSummary.coverage) + "%"}</strong><span className={styles.kpiHint}>{currentSummary.recorded} rekod · {currentSummary.missing} belum direkodkan</span></article>
          </div>

          {currentSummary.zeros > 0 && (
            <div className={styles.alertBox}>
              <strong>Semakan markah sifar:</strong> terdapat <strong>{currentSummary.zeros}</strong> rekod bernilai 0 bagi {currentAssessment?.title ?? assessmentCode} dalam skop pilihan ini. Markah sifar dikira dalam purata dan kadar gagal kerana ia direkodkan sebagai angka. Sahkan rekod ini sebelum membuat rumusan rasmi.
            </div>
          )}

          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div><span className={styles.sectionEyebrow}>PRESTASI MENGIKUT TINGKATAN</span><h2 className={styles.sectionTitle}>Ringkasan keseluruhan tingkatan</h2><p className={styles.sectionNote}>Menggunakan pentaksiran yang dipilih; ringkasan ini sentiasa meliputi semua kelas aktif bagi setiap tingkatan.</p></div>
            </div>
            <div className={styles.tableScroll}>
              <table className={styles.analyticsTable}>
                <thead><tr><th>TINGKATAN</th><th>MURID AKTIF</th><th>PURATA</th><th>LULUS</th><th>GAGAL</th><th>KADAR LULUS</th><th>LIPUTAN</th></tr></thead>
                <tbody>{formSummaries.map(({ level, summary }) => <tr key={level}><td className={styles.studentName}>Tingkatan {level}</td><td className={styles.numeric}>{summary.total}</td><td className={styles.numeric}>{fmt(summary.average)}</td><td className={styles.numeric}>{summary.pass}</td><td className={styles.numeric}>{summary.fail}</td><td className={styles.numeric}>{summary.passRate === null ? "—" : fmt(summary.passRate) + "%"}</td><td className={styles.numeric}>{summary.coverage === null ? "—" : fmt(summary.coverage) + "%"}</td></tr>)}</tbody>
              </table>
            </div>
          </section>

          <div className={styles.twoColumn}>
            <section className={styles.sectionCard}>
              <div className={styles.sectionHeader}><div><span className={styles.sectionEyebrow}>PRESTASI MENGIKUT KELAS</span><h2 className={styles.sectionTitle}>Perbandingan kelas</h2><p className={styles.sectionNote}>Purata, kadar lulus dan rekod bagi pentaksiran dipilih.</p></div></div>
              {classSummaries.length ? <div className={styles.tableScroll}><table className={styles.analyticsTable}><thead><tr><th>KELAS</th><th>MURID</th><th>PURATA</th><th>LULUS</th><th>KADAR LULUS</th></tr></thead><tbody>{classSummaries.map(({ item, summary }) => <tr key={item.id}><td className={styles.studentName}>T{item.form_level} {item.class_name}</td><td className={styles.numeric}>{summary.total}</td><td className={styles.numeric}>{fmt(summary.average)}</td><td className={styles.numeric}>{summary.pass}/{summary.numeric}</td><td className={styles.numeric}>{summary.passRate === null ? "—" : fmt(summary.passRate) + "%"}</td></tr>)}</tbody></table></div> : <div className={styles.emptyBox}>Tiada kelas aktif dalam pilihan.</div>}
            </section>

            <section className={styles.sectionCard}>
              <div className={styles.sectionHeader}><div><span className={styles.sectionEyebrow}>TABURAN GRED</span><h2 className={styles.sectionTitle}>Profil gred semasa</h2><p className={styles.sectionNote}>Berdasarkan julat gred yang ditetapkan dalam modul markah.</p></div></div>
              <div className={styles.gradeList}>{gradeOrder.map((grade) => <div className={styles.gradeRow} key={grade}><span className={styles.gradeLabel}>{grade}</span><div className={styles.gradeTrack}><div className={styles.gradeFill} style={{ width: `${(currentSummary.grades[grade] / gradeMax) * 100}%` }} /></div><span className={styles.gradeCount}>{currentSummary.grades[grade]}</span></div>)}</div>
              <p className={styles.footerNote}>TH: tidak hadir · X: dikecualikan. Kedua-duanya tidak dimasukkan dalam taburan gred atau purata.</p>
            </section>
          </div>

          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}><div><span className={styles.sectionEyebrow}>PERKEMBANGAN AKADEMIK</span><h2 className={styles.sectionTitle}>Perubahan PPT 2026 → PAT 2026</h2><p className={styles.sectionNote}>Perbandingan hanya mengira murid yang mempunyai markah angka bagi kedua-dua pentaksiran.</p></div></div>
            <div className={styles.insightGrid}>
              <div className={styles.insightCard}><span className={styles.insightLabel}>PURATA PERUBAHAN</span><strong className={styles.insightValue}>{averageChange === null ? "—" : (averageChange > 0 ? "+" : "") + fmt(averageChange) + " markah"}</strong></div>
              <div className={styles.insightCard}><span className={styles.insightLabel}>MURID MENINGKAT</span><strong className={styles.insightValue}>{improved} / {pairedProgress.length}</strong></div>
              <div className={styles.insightCard}><span className={styles.insightLabel}>MURID MEROSOT</span><strong className={styles.insightValue}>{declined} orang</strong></div>
            </div>
            <div className={styles.tableScroll} style={{ marginTop: 14 }}>
              <table className={styles.analyticsTable}>
                <thead><tr><th>TINGKATAN</th><th>PURATA PPT</th><th>PURATA PAT</th><th>PERUBAHAN</th><th>MENINGKAT</th><th>MEROSOT</th><th>BERPASANGAN</th></tr></thead>
                <tbody>{formSummaries.map(({ level, students: group }) => {
                  const entries = group.map(getProgress).filter((entry) => entry.delta !== null);
                  const pptAvg = entries.length ? entries.reduce((sum, entry) => sum + (entry.ppt ?? 0), 0) / entries.length : null;
                  const patAvg = entries.length ? entries.reduce((sum, entry) => sum + (entry.pat ?? 0), 0) / entries.length : null;
                  const delta = pptAvg !== null && patAvg !== null ? patAvg - pptAvg : null;
                  return <tr key={level}><td className={styles.studentName}>Tingkatan {level}</td><td className={styles.numeric}>{fmt(pptAvg)}</td><td className={styles.numeric}>{fmt(patAvg)}</td><td className={delta === null ? styles.numeric : delta > 0 ? `${styles.numeric} ${styles.changePositive}` : delta < 0 ? `${styles.numeric} ${styles.changeNegative}` : styles.numeric}>{delta === null ? "—" : (delta > 0 ? "+" : "") + fmt(delta)}</td><td className={styles.numeric}>{entries.filter((entry) => (entry.delta ?? 0) > 0).length}</td><td className={styles.numeric}>{entries.filter((entry) => (entry.delta ?? 0) < 0).length}</td><td className={styles.numeric}>{entries.length}/{group.length}</td></tr>;
                })}</tbody>
              </table>
            </div>
            <p className={styles.sectionNote} style={{ marginTop: 14, marginBottom: 8 }}>Perkembangan mengikut kelas</p>
              <table className={styles.analyticsTable}><thead><tr><th>KELAS</th><th>PURATA PPT</th><th>PURATA PAT</th><th>PERUBAHAN</th><th>MENINGKAT</th><th>MEROSOT</th><th>BERPASANGAN</th></tr></thead>
                <tbody>{classSummaries.map(({ item, group }) => {
                  const entries = group.map(getProgress).filter((entry) => entry.delta !== null);
                  const pptAvg = entries.length ? entries.reduce((sum, entry) => sum + (entry.ppt ?? 0), 0) / entries.length : null;
                  const patAvg = entries.length ? entries.reduce((sum, entry) => sum + (entry.pat ?? 0), 0) / entries.length : null;
                  const delta = pptAvg !== null && patAvg !== null ? patAvg - pptAvg : null;
                  return <tr key={item.id}><td className={styles.studentName}>T{item.form_level} {item.class_name}</td><td className={styles.numeric}>{fmt(pptAvg)}</td><td className={styles.numeric}>{fmt(patAvg)}</td><td className={delta === null ? styles.numeric : delta > 0 ? `${styles.numeric} ${styles.changePositive}` : delta < 0 ? `${styles.numeric} ${styles.changeNegative}` : styles.numeric}>{delta === null ? "—" : (delta > 0 ? "+" : "") + fmt(delta)}</td><td className={styles.numeric}>{entries.filter((entry) => (entry.delta ?? 0) > 0).length}</td><td className={styles.numeric}>{entries.filter((entry) => (entry.delta ?? 0) < 0).length}</td><td className={styles.numeric}>{entries.length}/{group.length}</td></tr>;
                })}</tbody>
              </table>
            </div>
            <p className={styles.footerNote}>Penting: nilai 0 adalah markah angka dan mempengaruhi perubahan. Semak amaran data sifar sebelum menggunakan keputusan perbandingan untuk laporan rasmi.</p>
          </section>

          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}><div><span className={styles.sectionEyebrow}>ANALISIS INDIVIDU</span><h2 className={styles.sectionTitle}>Perkembangan setiap murid</h2><p className={styles.sectionNote}>Senarai mengikut perubahan markah tertinggi ke terendah. Murid tanpa pasangan markah dikekalkan dalam senarai.</p></div></div>
            <div className={styles.searchRow}><span className={styles.sectionNote}>{searchedProgress.length} murid dipaparkan</span><input className={styles.searchInput} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama murid..." aria-label="Cari nama murid" /></div>
            <div className={styles.tableScroll}>
              <table className={styles.analyticsTable}>
                <thead><tr><th>NAMA MURID</th><th>KELAS</th><th>PPT 2026</th><th>PAT 2026</th><th>PERUBAHAN</th><th>STATUS</th></tr></thead>
                <tbody>{searchedProgress.map((entry) => {
                  const deltaClass = entry.delta === null ? styles.numeric : entry.delta > 0 ? `${styles.numeric} ${styles.changePositive}` : entry.delta < 0 ? `${styles.numeric} ${styles.changeNegative}` : `${styles.numeric} ${styles.changeNeutral}`;
                  const pillClass = entry.status === "Meningkat" ? `${styles.statusPill} ${styles.statusUp}` : entry.status === "Merosot" ? `${styles.statusPill} ${styles.statusDown}` : entry.status === "Belum lengkap" ? `${styles.statusPill} ${styles.statusPending}` : `${styles.statusPill} ${styles.statusNeutral}`;
                  return <tr key={entry.student.user_id}><td className={styles.studentName}>{entry.student.full_name}</td><td>T{entry.student.form_level} {entry.student.class_name}</td><td className={styles.numeric}>{entry.ppt === null ? "—" : fmt(entry.ppt, 0)}</td><td className={styles.numeric}>{entry.pat === null ? "—" : fmt(entry.pat, 0)}</td><td className={deltaClass}>{entry.delta === null ? "—" : (entry.delta > 0 ? "+" : "") + fmt(entry.delta, 0)}</td><td><span className={pillClass}>{entry.status}</span></td></tr>;
                })}</tbody>
              </table>
            </div>
          </section>

          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}><div><span className={styles.sectionEyebrow}>KUALITI DATA</span><h2 className={styles.sectionTitle}>Status kelengkapan rekod</h2><p className={styles.sectionNote}>Maklumat ini membantu membezakan prestasi sebenar daripada rekod yang perlu dilengkapkan atau disahkan.</p></div></div>
            <div className={styles.insightGrid}>
              <div className={styles.insightCard}><span className={styles.insightLabel}>MARKAH SIFAR</span><strong className={styles.insightValue}>{currentSummary.zeros}</strong></div>
              <div className={styles.insightCard}><span className={styles.insightLabel}>TIDAK HADIR (TH)</span><strong className={styles.insightValue}>{currentSummary.th}</strong></div>
              <div className={styles.insightCard}><span className={styles.insightLabel}>BELUM DIREKODKAN</span><strong className={styles.insightValue}>{currentSummary.missing}</strong></div>
            </div>
            <p className={styles.footerNote}>Sumber: rekod murid aktif, kelas aktif, katalog pentaksiran dan markah dalam Supabase. Murid yang dinyahaktif tidak dimasukkan dalam analisis. Rekod dikemas kini terakhir: {latestLabel}.</p>
          </section>
        </>
      )}
    </div>
  );
}
