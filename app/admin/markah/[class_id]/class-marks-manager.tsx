"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { createClient } from "../../../../lib/supabase/client";
import styles from "../marks.module.css";

type MarkCode = "PPT2026" | "PAT2026";
type Assessment = {
  code: MarkCode;
  title: string;
  max_score: number;
  is_active: boolean;
};
type Student = {
  user_id: string;
  username: string;
  full_name: string;
  form_level: number;
  class_name: string;
  is_active: boolean;
  marks: Partial<Record<MarkCode, number | string | null>>;
};
type ApiResponse = {
  class?: { id: string; form_level: number; class_name: string; is_active: boolean };
  assessments?: Assessment[];
  students?: Student[];
  message?: string;
  error?: string;
  updated?: number;
  failed?: number;
  results?: Array<{ row_number: number; username: string; full_name?: string; success: boolean; message: string }>;
};
type DraftMarks = Record<string, { PPT2026: string; PAT2026: string }>;
type ImportRow = {
  row_number: number;
  username: string;
  PPT2026: string;
  PAT2026: string;
  full_name: string;
  errors: string[];
};

async function callAdmin(payload: Record<string, unknown>): Promise<ApiResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) throw new Error("Konfigurasi Supabase belum lengkap.");

  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) throw new Error("Sesi pentadbir tamat. Sila log masuk semula.");

  const response = await fetch(`${supabaseUrl}/functions/v1/admin-user-management`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });
  const result = (await response.json()) as ApiResponse;
  if (!response.ok) throw new Error(result.error ?? "Operasi rekod markah gagal.");
  return result;
}

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
function cellText(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}
function scoreText(value: number | string | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

function gradeFor(rawValue: string): string {
  const raw = rawValue.trim().toUpperCase();
  if (!raw) return "—";
  if (raw === "TH") return "T";
  if (raw === "X") return "x";
  const score = Number(raw);
  if (!Number.isFinite(score)) return "—";
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

function validMarkValue(rawValue: string, maximum: number): boolean {
  const raw = rawValue.trim().toUpperCase();
  if (raw === "TH" || raw === "X" || raw === "") return true;
  const score = Number(raw);
  return Number.isFinite(score) && score >= 0 && score <= maximum;
}

export default function ClassMarksManager({
  classId
}: {
  classId: string;
}) {
  const [students, setStudents] = useState<Student[]>([]);
  const [assessmentList, setAssessmentList] = useState<Assessment[]>([]);
  const [className, setClassName] = useState("");
  const [formLevel, setFormLevel] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<DraftMarks>({});
  const [savingStudent, setSavingStudent] = useState("");
  const [rowMessages, setRowMessages] = useState<Record<string, { text: string; ok: boolean }>>({});
  const [maxDrafts, setMaxDrafts] = useState<Record<MarkCode, string>>({ PPT2026: "100", PAT2026: "100" });
  const [savingMax, setSavingMax] = useState<MarkCode | "">("");
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<ApiResponse | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await callAdmin({ action: "list_class_marks", class_id: classId });
      const roster = result.students ?? [];
      const catalogue = (result.assessments ?? []).filter((item) => item.is_active);
      setStudents(roster);
      setAssessmentList(catalogue);
      setClassName(result.class?.class_name ?? "");
      setFormLevel(result.class?.form_level ?? 0);
      setMaxDrafts({
        PPT2026: String(catalogue.find((item) => item.code === "PPT2026")?.max_score ?? 100),
        PAT2026: String(catalogue.find((item) => item.code === "PAT2026")?.max_score ?? 100)
      });
      setDrafts(Object.fromEntries(roster.map((student) => [
        student.user_id,
        {
          PPT2026: scoreText(student.marks?.PPT2026),
          PAT2026: scoreText(student.marks?.PAT2026)
        }
      ])));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rekod markah gagal dimuatkan.");
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const maximumFor = useCallback((code: MarkCode) => {
    return Number(assessmentList.find((item) => item.code === code)?.max_score ?? 100);
  }, [assessmentList]);

  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return students;
    return students.filter((student) =>
      student.full_name.toLowerCase().includes(term) ||
      student.username.toLowerCase().includes(term)
    );
  }, [students, search]);

  const submittedCounts = useMemo(() => ({
    PPT2026: students.filter((item) => item.marks?.PPT2026 !== null && item.marks?.PPT2026 !== undefined).length,
    PAT2026: students.filter((item) => item.marks?.PAT2026 !== null && item.marks?.PAT2026 !== undefined).length
  }), [students]);

  function changeDraft(userId: string, code: MarkCode, value: string) {
    setDrafts((previous) => ({
      ...previous,
      [userId]: {
        PPT2026: previous[userId]?.PPT2026 ?? "",
        PAT2026: previous[userId]?.PAT2026 ?? "",
        [code]: value
      }
    }));
    setRowMessages((previous) => ({ ...previous, [userId]: { text: "Belum disimpan", ok: false } }));
  }

  async function saveStudent(student: Student) {
    const draft = drafts[student.user_id] ?? { PPT2026: "", PAT2026: "" };
    const marks: Record<MarkCode, string | null> = { PPT2026: null, PAT2026: null };

    for (const code of ["PPT2026", "PAT2026"] as MarkCode[]) {
      const raw = draft[code].trim().toUpperCase();
      if (raw !== "" && !validMarkValue(raw, maximumFor(code))) {
        setRowMessages((previous) => ({
          ...previous,
          [student.user_id]: { text: code + ": masukkan 0 hingga " + maximumFor(code) + ", atau TH/X.", ok: false }
        }));
        return;
      }
      marks[code] = raw === "" ? null : raw;
    }

    setSavingStudent(student.user_id);
    setNotice(null);
    try {
      const result = await callAdmin({
        action: "save_student_marks",
        user_id: student.user_id,
        marks
      });
      setRowMessages((previous) => ({
        ...previous,
        [student.user_id]: { text: result.message ?? "Disimpan", ok: true }
      }));
      await refresh();
    } catch (cause) {
      setRowMessages((previous) => ({
        ...previous,
        [student.user_id]: {
          text: cause instanceof Error ? cause.message : "Markah gagal disimpan.",
          ok: false
        }
      }));
    } finally {
      setSavingStudent("");
    }
  }

  async function saveMaximum(code: MarkCode) {
    const value = Number(maxDrafts[code]);
    if (!Number.isFinite(value) || value <= 0 || value > 1000) {
      setNotice({ text: "Markah maksimum mesti lebih daripada 0 dan tidak melebihi 1000.", ok: false });
      return;
    }
    setSavingMax(code);
    setNotice(null);
    try {
      const result = await callAdmin({ action: "set_assessment_max", assessment_code: code, max_score: value });
      setNotice({ text: result.message ?? "Skala markah dikemaskini.", ok: true });
      await refresh();
    } catch (cause) {
      setNotice({ text: cause instanceof Error ? cause.message : "Skala markah gagal dikemaskini.", ok: false });
    } finally {
      setSavingMax("");
    }
  }

  async function downloadTemplate() {
    const XLSX = await import("@keep-lts/xlsx");
    const records = students.map((student) => ({
      "Nama Penuh": student.full_name,
      "Username": student.username,
      "PPT2026": scoreText(student.marks?.PPT2026),
      "PAT2026": scoreText(student.marks?.PAT2026)
    }));
    const sheet = XLSX.utils.json_to_sheet(records, {
      header: ["Nama Penuh", "Username", "PPT2026", "PAT2026"]
    });
    sheet["!cols"] = [{ wch: 42 }, { wch: 32 }, { wch: 15 }, { wch: 15 }];
    const guide = XLSX.utils.aoa_to_sheet([
      ["PANDUAN KEMAS KINI MARKAH"],
      ["Isi markah pada lajur PPT2026 dan/atau PAT2026."],
      ["Lajur kosong tidak mengubah markah sedia ada."],
      ["Nilai markah mestilah antara 0 hingga had maksimum setiap pentaksiran."],
      ["Murid tidak hadir: isi TH. Sistem memberikan gred T."],
      ["Kod X juga diterima dan sistem memberikan gred x."],
      ["Gred angka: 0-39 G, 40-44 E, 45-49 D, 50-54 C, 55-59 C+, 60-64 B, 65-69 B+, 70-79 A-, 80-89 A, 90 ke atas A+."],
      ["Jangan ubah username kerana sistem menggunakannya untuk padanan rekod murid."],
      ["Jangan tambah password. Fail ini tidak memerlukan password."]
    ]);
    guide["!cols"] = [{ wch: 95 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Markah Murid");
    XLSX.utils.book_append_sheet(workbook, guide, "Panduan");
    XLSX.writeFile(workbook, `Templat_Markah_T${formLevel}_${className.replace(/\s+/g, "_")}.xlsx`);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setFileName(selected?.name ?? "");
    setImportRows([]);
    setImportResults(null);
    setNotice(null);
    if (!selected) return;

    const ext = selected.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext ?? "")) {
      setNotice({ text: "Format fail tidak disokong. Pilih .xlsx, .xls atau .csv.", ok: false });
      setFile(null);
      return;
    }
    if (selected.size > 3 * 1024 * 1024) {
      setNotice({ text: "Saiz fail melebihi 3 MB.", ok: false });
      setFile(null);
      return;
    }

    setParsing(true);
    try {
      const XLSX = await import("@keep-lts/xlsx");
      const workbook = XLSX.read(await selected.arrayBuffer(), { type: "array", raw: false });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!firstSheet) throw new Error("Helaian data tidak ditemui.");
      const table = XLSX.utils.sheet_to_json(firstSheet, {
        header: 1, raw: false, defval: "", blankrows: false
      }) as unknown[][];
      if (table.length < 2) throw new Error("Fail tidak mengandungi rekod markah.");

      const headers = table[0].map(normalizeHeader);
      const col = {
        username: headers.findIndex((h) => ["username", "user name", "user_name"].includes(h)),
        ppt: headers.findIndex((h) => ["ppt2026", "ppt 2026", "markah ppt2026", "markah ppt 2026"].includes(h)),
        pat: headers.findIndex((h) => ["pat2026", "pat 2026", "markah pat2026", "markah pat 2026"].includes(h))
      };
      if (col.username < 0 || col.ppt < 0 || col.pat < 0) {
        throw new Error("Lajur wajib: Username, PPT2026 dan PAT2026.");
      }

      const rosterMap = new Map(students.map((item) => [item.username.toLowerCase(), item]));
      const rows: ImportRow[] = [];
      const seen = new Set<string>();
      table.slice(1).forEach((rawRow, index) => {
        const row = rawRow.map(cellText);
        if (row.every((cell) => cell === "")) return;
        const username = row[col.username].toLowerCase();
        const student = rosterMap.get(username);
        const ppt = row[col.ppt];
        const pat = row[col.pat];
        const errors: string[] = [];
        if (!username) errors.push("Username kosong.");
        if (student && seen.has(username)) errors.push("Username berulang dalam fail.");
        if (student && !seen.has(username)) seen.add(username);
        if (!student) errors.push("Username tidak ditemui dalam kelas ini.");

        for (const [code, rawScore] of [["PPT2026", ppt], ["PAT2026", pat]] as Array<[MarkCode, string]>) {
          if (rawScore === "") continue;
          if (!validMarkValue(rawScore, maximumFor(code))) {
            errors.push(code + ": markah mesti antara 0 hingga " + maximumFor(code) + ", atau TH/X.");
          }
        }
        if (ppt === "" && pat === "") errors.push("Tiada markah diisi untuk rekod ini.");

        rows.push({
          row_number: index + 2,
          username,
          PPT2026: ppt,
          PAT2026: pat,
          full_name: student?.full_name ?? "",
          errors
        });
      });
      if (rows.length === 0) throw new Error("Tiada rekod yang boleh diproses.");
      if (rows.length > 500) throw new Error("Maksimum 500 baris untuk satu import.");
      setImportRows(rows);
    } catch (cause) {
      setNotice({ text: cause instanceof Error ? cause.message : "Fail gagal dibaca.", ok: false });
      setFile(null);
    } finally {
      setParsing(false);
    }
  }

  async function runImport() {
    if (!file || importRows.length === 0 || importRows.some((row) => row.errors.length > 0)) return;
    setImporting(true);
    setNotice(null);
    try {
      const result = await callAdmin({
        action: "bulk_save_class_marks",
        class_id: classId,
        rows: importRows.map((row) => ({
          row_number: row.row_number,
          username: row.username,
          PPT2026: row.PPT2026,
          PAT2026: row.PAT2026
        }))
      });
      setImportResults(result);
      setNotice({
        text: `Import selesai. ${result.updated ?? 0} rekod murid dikemas kini; ${result.failed ?? 0} gagal.`,
        ok: (result.failed ?? 0) === 0
      });
      await refresh();
    } catch (cause) {
      setNotice({ text: cause instanceof Error ? cause.message : "Import markah gagal.", ok: false });
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <div className={styles.markPanelHeader}>
        <div>
          <span className={styles.classLevel}>TINGKATAN {formLevel} · REKOD KELAS</span>
          <h2 className={styles.markClassNameHeader}>{className}</h2>
        </div>
        <span className={styles.classLevel}>{students.length} MURID</span>
      </div>
      <div className={styles.markSummary}>
        <div className={styles.markSummaryCard}><strong>{students.length}</strong><span>JUMLAH MURID</span></div>
        <div className={styles.markSummaryCard}><strong>{submittedCounts.PPT2026}/{students.length}</strong><span>PPT2026 DIREKOD</span></div>
        <div className={styles.markSummaryCard}><strong>{submittedCounts.PAT2026}/{students.length}</strong><span>PAT2026 DIREKOD</span></div>
      </div>

      <section className={styles.markPanel}>
        <div className={styles.markPanelHeader}>
          <div>
            <span className={styles.classLevel}>TETAPAN PENTAKSIRAN</span>
            <h2 className={styles.markPanelTitle}>Markah maksimum</h2>
            <p className={styles.markPanelDescription}>Tetapkan jumlah markah penuh mengikut kertas/format pentaksiran sebelum memasukkan keputusan.</p>
          </div>
        </div>
        <div className={styles.markSettingsGrid}>
          {assessmentList.map((assessment) => (
            <div className={styles.markSettingCard} key={assessment.code}>
              <label htmlFor={`max-${assessment.code}`}>{assessment.code} · {assessment.title}</label>
              <div className={styles.markSettingRow}>
                <input
                  id={`max-${assessment.code}`}
                  className={styles.markSettingInput}
                  type="number"
                  min="0.01"
                  max="1000"
                  step="0.01"
                  value={maxDrafts[assessment.code]}
                  onChange={(event) => setMaxDrafts((old) => ({ ...old, [assessment.code]: event.target.value }))}
                />
                <button className={styles.markSettingButton} type="button" disabled={savingMax === assessment.code} onClick={() => void saveMaximum(assessment.code)}>
                  {savingMax === assessment.code ? "SIMPAN..." : "SIMPAN HAD"}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.markToolbar}>
          <input className={styles.markSearch} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama atau username murid..." aria-label="Cari murid"/>
          <div className={styles.markToolbarActions}>
            <button className={styles.markToolButton} type="button" onClick={() => void refresh()} disabled={loading}>SEGARKAN ↻</button>
            <button className={styles.markToolButton} type="button" onClick={() => window.print()}>CETAK</button>
          </div>
        </div>

        {error ? <div className={styles.markError}>{error}</div> : null}
        {loading ? <div className={styles.markLoading}>Memuatkan markah murid...</div> : (
          <div className={styles.markTableWrap}>
            <table className={styles.markTable}>
              <thead>
                <tr>
                  <th>BIL.</th>
                  <th>NAMA MURID / USERNAME</th>
                  <th>PPT2026 / GRED ({maximumFor("PPT2026")})</th>
                  <th>PAT2026 / GRED ({maximumFor("PAT2026")})</th>
                  <th className="noPrint">TINDAKAN</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student, index) => {
                  const draft = drafts[student.user_id] ?? { PPT2026: "", PAT2026: "" };
                  const rowMessage = rowMessages[student.user_id];
                  return (
                    <tr key={student.user_id}>
                      <td>{index + 1}</td>
                      <td>
                        <span className={styles.markStudentName}>{student.full_name}</span><br/>
                        <span>@{student.username}</span>
                      </td>
                      <td>
                        <div className={styles.markInputGroup}>
                          <input className={styles.markCellInput} type="text" inputMode="decimal" placeholder="Markah / TH / X" value={draft.PPT2026} onChange={(event) => changeDraft(student.user_id, "PPT2026", event.target.value.toUpperCase())} aria-label={`Markah PPT2026 ${student.full_name}`}/>
                          <span className={`${styles.gradePill} ${draft.PPT2026.trim().toUpperCase() === "TH" ? styles.gradeT : draft.PPT2026.trim().toUpperCase() === "X" ? styles.gradeX : ""}`}>GRED {gradeFor(draft.PPT2026)}</span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.markInputGroup}>
                          <input className={styles.markCellInput} type="text" inputMode="decimal" placeholder="Markah / TH / X" value={draft.PAT2026} onChange={(event) => changeDraft(student.user_id, "PAT2026", event.target.value.toUpperCase())} aria-label={`Markah PAT2026 ${student.full_name}`}/>
                          <span className={`${styles.gradePill} ${draft.PAT2026.trim().toUpperCase() === "TH" ? styles.gradeT : draft.PAT2026.trim().toUpperCase() === "X" ? styles.gradeX : ""}`}>GRED {gradeFor(draft.PAT2026)}</span>
                        </div>
                      </td>
                      <td className="noPrint">
                        <button className={styles.markSaveButton} type="button" disabled={savingStudent === student.user_id} onClick={() => void saveStudent(student)}>
                          {savingStudent === student.user_id ? "SIMPAN..." : "SIMPAN"}
                        </button>
                        {rowMessage ? <div className={rowMessage.ok ? styles.markStatusSaved : styles.markStatusError}>{rowMessage.text}</div> : null}
                      </td>
                    </tr>
                  );
                })}
                {filteredStudents.length === 0 ? <tr><td colSpan={5}>Tiada murid sepadan dengan carian.</td></tr> : null}
              </tbody>
            </table>
          </div>
        )}
        <p className={styles.markFootnote}>Masukkan angka, TH (tidak hadir) atau X. Gred dikira secara automatik. Kosongkan medan dan tekan SIMPAN untuk memadam rekod markah peperiksaan tersebut; nilai 0 ialah markah sah dan berbeza daripada medan kosong.</p>
        <div className={styles.gradeScale}>
          <strong>JULAT GRED</strong>
          <span>0–39 G</span><span>40–44 E</span><span>45–49 D</span><span>50–54 C</span><span>55–59 C+</span><span>60–64 B</span><span>65–69 B+</span><span>70–79 A-</span><span>80–89 A</span><span>90 ke atas A+</span><span>TH = T</span><span>X = x</span>
        </div>
      </section>

      <section className={styles.markImportBox}>
        <span className={styles.classLevel}>KEMAS KINI SECARA PUKAL</span>
        <h2 className={styles.markImportTitle}>Import markah seluruh kelas</h2>
        <p className={styles.markImportDescription}>Muat turun fail yang sudah mengandungi nama dan username semua murid kelas ini. Isi markah PPT2026 dan PAT2026, kemudian muat naik semula. Lajur kosong akan mengekalkan markah sedia ada.</p>
        <div className={styles.markToolbarActions} style={{ marginTop: 13 }}>
          <button className={styles.markToolButton} type="button" onClick={() => void downloadTemplate()} disabled={students.length === 0}>↓ MUAT TURUN TEMPLATE EXCEL</button>
          <label className={styles.markToolButton} htmlFor="marks-import-file">PILIH FAIL EXCEL / CSV</label>
          <input id="marks-import-file" className={styles.markTemplateInput} type="file" accept=".xlsx,.xls,.csv" onChange={(event) => void handleFileChange(event)}/>
        </div>
        {fileName ? <p className={styles.markFootnote}>Fail dipilih: {fileName}</p> : null}
        {parsing ? <div className={styles.markLoading}>Membaca dan menyemak fail...</div> : null}
        {importRows.length > 0 ? (
          <>
            <div className={styles.markSummary} style={{ marginTop: 15 }}>
              <div className={styles.markSummaryCard}><strong>{importRows.length}</strong><span>JUMLAH BARIS</span></div>
              <div className={styles.markSummaryCard}><strong>{importRows.filter((row) => row.errors.length === 0).length}</strong><span>SAH DIIMPORT</span></div>
              <div className={styles.markSummaryCard}><strong>{importRows.filter((row) => row.errors.length > 0).length}</strong><span>PERLU DIBETULKAN</span></div>
            </div>
            <div className={styles.markPreviewWrap}>
              <table className={styles.markPreviewTable}>
                <thead><tr><th>BARIS</th><th>NAMA MURID</th><th>USERNAME</th><th>PPT2026</th><th>GRED</th><th>PAT2026</th><th>GRED</th><th>SEMAKAN</th></tr></thead>
                <tbody>
                  {importRows.map((row) => (
                    <tr key={row.row_number}>
                      <td>{row.row_number}</td>
                      <td>{row.full_name || "—"}</td>
                      <td>@{row.username}</td>
                      <td>{row.PPT2026 || "—"}</td>
                      <td>{gradeFor(row.PPT2026)}</td>
                      <td>{row.PAT2026 || "—"}</td>
                      <td>{gradeFor(row.PAT2026)}</td>
                      <td>
                        {row.errors.length === 0 ? <span className={styles.markValid}>LULUS</span> :
                          <span className={styles.markInvalid}>{row.errors.join(" ")}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 13 }}>
              <button className={styles.markImportSubmit} type="button" disabled={importing || importRows.some((row) => row.errors.length > 0)} onClick={() => void runImport()}>
                {importing ? "SEDANG MENGEMAS KINI..." : `IMPORT MARKAH ${importRows.length} BARIS`}
              </button>
            </div>
          </>
        ) : null}
        {notice ? <div className={`${styles.markMessage} ${notice.ok ? "" : styles.markMessageError}`} role="status">{notice.text}</div> : null}
        {importResults?.results ? (
          <div className={styles.markPreviewWrap}>
            <table className={styles.markPreviewTable}>
              <thead><tr><th>BARIS</th><th>USERNAME</th><th>KEPUTUSAN</th></tr></thead>
              <tbody>
                {importResults.results.map((item) => (
                  <tr key={item.row_number + item.username}>
                    <td>{item.row_number}</td><td>@{item.username}</td>
                    <td className={item.success ? styles.markValid : styles.markInvalid}>{item.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <p className={styles.markFootnote}>Fail eksport markah tidak mengandungi password. Import mengemas kini rekod berdasarkan username dalam kelas yang dipilih sahaja.</p>
      </section>
    </>
  );
}
