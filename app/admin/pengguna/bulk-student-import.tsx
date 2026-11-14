"use client";

import { useState, type ChangeEvent } from "react";
import { createClient } from "../../../lib/supabase/client";
import styles from "./users.module.css";

type StudentRow = {
  row_number: number;
  full_name: string;
  username: string;
  password: string;
  form_level: number;
  class_name: string;
  errors: string[];
};
type PreviewResult = {
  total: number;
  valid: number;
  invalid: number;
  rows: StudentRow[];
};
type ImportResultRow = {
  row_number: number;
  username: string;
  full_name: string;
  success: boolean;
  message: string;
};
type ImportApiResult = {
  created?: number;
  failed?: number;
  total?: number;
  results?: ImportResultRow[];
  error?: string;
  message?: string;
};

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$|^[a-z0-9][a-z0-9._+-]{0,63}@[a-z0-9][a-z0-9.-]{0,187}\.[a-z]{2,24}$/;

function cleanCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/^\uFEFF/, "").trim();
}

function normalizeHeader(value: unknown): string {
  return cleanCell(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseFormLevel(value: string): number {
  const match = value.match(/\b(4|5)\b/);
  return match ? Number(match[1]) : Number.NaN;
}

export default function BulkStudentImport({
  onImported
}: {
  onImported: () => Promise<void>;
}) {
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [results, setResults] = useState<ImportResultRow[] | null>(null);
  const [summary, setSummary] = useState<{ created: number; failed: number } | null>(null);

  async function downloadExcelTemplate() {
    const XLSX = await import("@keep-lts/xlsx");
    const headers = ["Nama Penuh", "Username", "Password", "Tingkatan", "Kelas"];
    const dataRows = Array.from({ length: 61 }, () => ["", "", "", "", ""]);
    const dataSheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    dataSheet["!cols"] = [
      { wch: 38 },
      { wch: 28 },
      { wch: 22 },
      { wch: 13 },
      { wch: 20 }
    ];

    const guideRows = [
      ["PANDUAN IMPORT 61 MURID"],
      ["Isi satu murid bagi setiap baris pada helaian Data Murid."],
      ["Nama Penuh", "Nama penuh murid seperti rekod sekolah."],
      ["Username", "Username unik yang ditentukan oleh pentadbir. Boleh juga e-mel DELIMa."],
      ["Password", "Password pilihan pentadbir. Minimum 8 aksara."],
      ["Tingkatan", "Isi nombor 4 atau 5 sahaja."],
      ["Kelas", "Contoh: 4 Cekal atau 5 Bestari."],
      ["Peringatan", "Format lajur Username dan Password sebagai Text sebelum mengisi."],
      ["Keselamatan", "Jangan kongsi fail ini melalui pautan awam. Fail mengandungi password sementara."],
      ["Nota", "Baris kosong akan diabaikan. Maksimum 100 akaun bagi satu import."]
    ];
    const guideSheet = XLSX.utils.aoa_to_sheet(guideRows);
    guideSheet["!cols"] = [{ wch: 22 }, { wch: 90 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, dataSheet, "Data Murid");
    XLSX.utils.book_append_sheet(workbook, guideSheet, "Panduan");
    XLSX.writeFile(workbook, "Templat_Import_61_Murid_EKONOMI_SMART_SMKTM.xlsx");
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setFileName(selected?.name ?? "");
    setPreview(null);
    setResults(null);
    setSummary(null);
    setMessage(null);

    if (!selected) return;

    const extension = selected.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(extension ?? "")) {
      setMessage({ kind: "error", text: "Format fail tidak disokong. Pilih fail .xlsx, .xls atau .csv." });
      setFile(null);
      return;
    }
    if (selected.size > 3 * 1024 * 1024) {
      setMessage({ kind: "error", text: "Saiz fail melebihi 3 MB. Sila kecilkan fail dan cuba semula." });
      setFile(null);
      return;
    }

    setParsing(true);
    try {
      const XLSX = await import("@keep-lts/xlsx");
      const workbook = XLSX.read(await selected.arrayBuffer(), {
        type: "array",
        cellDates: false
      });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) throw new Error("Fail tidak mengandungi helaian data.");

      const worksheet = workbook.Sheets[firstSheetName];
      const table = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        raw: false,
        defval: "",
        blankrows: false
      }) as unknown[][];

      if (table.length < 2) {
        throw new Error("Tiada rekod murid ditemui. Pastikan fail mempunyai baris tajuk dan sekurang-kurangnya satu rekod.");
      }

      const headers = table[0].map(normalizeHeader);
      const findColumn = (names: string[]) => headers.findIndex((header) => names.includes(header));
      const columns = {
        full_name: findColumn(["nama penuh", "nama", "full name", "full_name", "name"]),
        username: findColumn(["username", "user name", "user_name"]),
        password: findColumn(["password", "kata laluan", "kata_laluan"]),
        form_level: findColumn(["tingkatan", "form", "form level", "form_level"]),
        class_name: findColumn(["kelas", "class", "class name", "class_name"])
      };

      const missing = Object.entries(columns)
        .filter(([, index]) => index < 0)
        .map(([key]) => key);
      if (missing.length) {
        throw new Error("Tajuk lajur tidak lengkap. Wajib ada: Nama Penuh, Username, Password, Tingkatan dan Kelas.");
      }

      const rawRows = table.slice(1);
      const rows: StudentRow[] = [];
      rawRows.forEach((row, index) => {
        const values = row.map(cleanCell);
        if (values.every((value) => value === "")) return;

        const fullName = values[columns.full_name].trim();
        const username = values[columns.username].trim().toLowerCase();
        const password = String(row[columns.password] ?? "");
        const formLevel = parseFormLevel(values[columns.form_level]);
        const className = values[columns.class_name].trim();
        const errors: string[] = [];

        if (fullName.length < 2 || fullName.length > 150) errors.push("Nama penuh wajib diisi (2–150 aksara).");
        if (!USERNAME_PATTERN.test(username)) errors.push("Format username tidak sah atau tidak lengkap.");
        if (password.length < 8 || password.length > 256) errors.push("Password mesti sekurang-kurangnya 8 aksara.");
        if (formLevel !== 4 && formLevel !== 5) errors.push("Tingkatan mesti 4 atau 5.");
        if (className.length < 1 || className.length > 60) errors.push("Kelas wajib diisi (maksimum 60 aksara).");

        rows.push({
          row_number: index + 2,
          full_name: fullName,
          username,
          password,
          form_level: formLevel,
          class_name: className,
          errors
        });
      });

      if (rows.length === 0) throw new Error("Tiada rekod murid diisi dalam fail.");
      if (rows.length > 100) throw new Error("Maksimum 100 rekod bagi satu import. Pecahkan fail kepada beberapa batch.");

      const usernameCounts = new Map<string, number>();
      rows.forEach((row) => usernameCounts.set(row.username, (usernameCounts.get(row.username) ?? 0) + 1));
      rows.forEach((row) => {
        if (row.username && (usernameCounts.get(row.username) ?? 0) > 1) {
          row.errors.push("Username berulang dalam fail import.");
        }
      });

      const valid = rows.filter((row) => row.errors.length === 0).length;
      setPreview({
        total: rows.length,
        valid,
        invalid: rows.length - valid,
        rows
      });
    } catch (error) {
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "Fail gagal dibaca. Semak format fail."
      });
      setFile(null);
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    if (!file || !preview || preview.invalid > 0 || preview.total < 1) return;
    setImporting(true);
    setMessage(null);
    setResults(null);
    setSummary(null);

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!supabaseUrl || !publishableKey) throw new Error("Konfigurasi Supabase belum lengkap.");

      const supabase = createClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) throw new Error("Sesi pentadbir tamat. Sila log masuk semula.");

      const rows = preview.rows.map((row) => ({
        row_number: row.row_number,
        full_name: row.full_name,
        username: row.username,
        password: row.password,
        form_level: row.form_level,
        class_name: row.class_name
      }));

      const response = await fetch(`${supabaseUrl}/functions/v1/admin-user-management`, {
        method: "POST",
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "bulk_create_students",
          rows
        })
      });

      const result = (await response.json()) as ImportApiResult;
      if (!response.ok) throw new Error(result.error ?? "Import pukal gagal diproses.");

      setResults(result.results ?? []);
      setSummary({
        created: result.created ?? 0,
        failed: result.failed ?? 0
      });
      setMessage({
        kind: result.failed && result.failed > 0 ? "error" : "success",
        text: result.message ?? "Import pukal telah selesai."
      });
      await onImported();
    } catch (error) {
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "Import tidak berjaya. Sila cuba semula."
      });
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className={styles.bulkImportPanel}>
      <div className={styles.bulkImportHeader}>
        <div>
          <span className={styles.panelKicker}>PENDAFTARAN SECARA BATCH</span>
          <h2 className={styles.bulkImportTitle}>Import pukal 61 murid</h2>
          <p className={styles.bulkImportDescription}>
            Muat naik Excel atau CSV yang mengandungi username dan password pilihan cikgu.
            Sistem akan menyemak data sebelum mencipta akaun murid.
          </p>
        </div>
        <div className={styles.templateActions}>
          <button className={styles.templateButton} type="button" onClick={() => void downloadExcelTemplate()}>
            ↓ TEMPLATE EXCEL 61 MURID
          </button>
          <a className={styles.templateLink} href="/templates/ekonomi-smart-import-murid.csv" download>
            ↓ TEMPLATE CSV
          </a>
        </div>
      </div>

      <div className={styles.bulkImportBody}>
        <div>
          <label className={styles.uploadBox} htmlFor="student-bulk-file">
            <span className={styles.uploadIcon}>⇧</span>
            <strong>Pilih fail senarai murid</strong>
            <p>{fileName || "Pilih fail Excel (.xlsx/.xls) atau CSV (.csv) daripada komputer."}</p>
            <input
              id="student-bulk-file"
              className={styles.fileInput}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(event) => void handleFileChange(event)}
            />
            <span className={styles.uploadHint}>Maksimum 3 MB · Maksimum 100 rekod dalam satu batch.</span>
          </label>
          <div className={styles.bulkPrivacy}>
            <span>♢</span>
            Password tidak dipaparkan dalam pratonton atau laporan keputusan. Pastikan fail disimpan secara peribadi dan padam salinan sementara selepas import.
          </div>
        </div>

        <div>
          {parsing ? (
            <div className={styles.emptyUsers}>Sedang membaca dan menyemak fail...</div>
          ) : preview ? (
            <>
              <div className={styles.bulkSummary}>
                <span className={styles.bulkStat}><strong>{preview.total}</strong> rekod</span>
                <span className={styles.bulkStat}><strong>{preview.valid}</strong> sedia diimport</span>
                <span className={styles.bulkStat}><strong>{preview.invalid}</strong> perlu dibetulkan</span>
              </div>
              <div className={styles.bulkPreviewWrap}>
                <table className={styles.bulkPreview}>
                  <thead>
                    <tr><th>BARIS</th><th>NAMA / USERNAME</th><th>TINGKATAN / KELAS</th><th>SEMAKAN</th></tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={row.row_number}>
                        <td>{row.row_number}</td>
                        <td><strong>{row.full_name || "Nama belum diisi"}</strong><br />@{row.username || "—"}</td>
                        <td>T{Number.isFinite(row.form_level) ? row.form_level : "—"} · {row.class_name || "—"}</td>
                        <td>
                          {row.errors.length === 0 ? (
                            <span className={styles.rowValid}>LULUS</span>
                          ) : (
                            <span className={styles.rowInvalid}>
                              {row.errors.length} isu
                              {row.errors.map((issue) => <small className={styles.rowIssue} key={issue}>{issue}</small>)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={styles.importActionRow}>
                <span className={styles.importReadyNote}>
                  {preview.invalid === 0
                    ? "Semua rekod lulus semakan awal. Semakan pendua dalam pangkalan data dibuat sekali lagi ketika import."
                    : "Betulkan semua rekod bertanda isu dalam fail Excel/CSV, kemudian pilih semula fail."}
                </span>
                <button
                  className={styles.importButton}
                  type="button"
                  onClick={() => void handleImport()}
                  disabled={importing || preview.invalid > 0 || preview.valid === 0}
                >
                  {importing ? "SEDANG MENCIPTA AKAUN..." : `IMPORT ${preview.valid} AKAUN MURID`}
                </button>
              </div>
            </>
          ) : (
            <div className={styles.emptyUsers}>
              Pilih fail untuk melihat pratonton rekod dan keputusan semakan sebelum import.
            </div>
          )}
        </div>
      </div>

      {message ? (
        <div className={`${styles.bulkMessage} ${message.kind === "success" ? styles.bulkMessageSuccess : styles.bulkMessageError}`} role="status">
          {message.text}
        </div>
      ) : null}

      {summary ? (
        <div className={styles.bulkSummary} style={{ marginTop: 14 }}>
          <span className={styles.bulkStat}><strong>{summary.created}</strong> berjaya dicipta</span>
          <span className={styles.bulkStat}><strong>{summary.failed}</strong> gagal</span>
        </div>
      ) : null}

      {results ? (
        <div className={styles.bulkResultList}>
          <h4>KEPUTUSAN IMPORT SETIAP BARIS</h4>
          <div className={styles.bulkResultScroll}>
            {results.map((row) => (
              <div className={styles.bulkResultRow} key={row.row_number + "-" + row.username}>
                <span>Baris {row.row_number}</span>
                <strong>{row.full_name} · @{row.username}</strong>
                <span className={row.success ? styles.rowValid : styles.rowInvalid}>
                  {row.success ? "BERJAYA" : row.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
