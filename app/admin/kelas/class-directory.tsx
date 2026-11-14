"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";
import styles from "./kelas.module.css";

type ClassRecord = {
  id: string;
  form_level: number;
  class_name: string;
  is_active: boolean;
  total_students: number;
  active_students: number;
  inactive_students: number;
};
type ClassApiResponse = {
  classes?: ClassRecord[];
  total_classes?: number;
  total_students?: number;
  active_students?: number;
  message?: string;
  error?: string;
};

async function callAdmin(payload: Record<string, unknown>): Promise<ClassApiResponse> {
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
  const result = (await response.json()) as ClassApiResponse;
  if (!response.ok) throw new Error(result.error ?? "Permintaan pengurusan kelas gagal.");
  return result;
}

export default function ClassDirectory() {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [activeStudents, setActiveStudents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newLevel, setNewLevel] = useState("4");
  const [newClassName, setNewClassName] = useState("");
  const [savingClass, setSavingClass] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await callAdmin({ action: "list_classes" });
      setClasses(result.classes ?? []);
      setTotalStudents(result.total_students ?? 0);
      setActiveStudents(result.active_students ?? 0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Senarai kelas gagal dimuatkan.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleCreateClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingClass(true);
    setNotice(null);
    try {
      const result = await callAdmin({
        action: "create_class",
        form_level: Number(newLevel),
        class_name: newClassName.trim()
      });
      setNotice({ kind: "success", text: result.message ?? "Kelas berjaya dicipta." });
      setNewClassName("");
      await refresh();
    } catch (cause) {
      setNotice({ kind: "error", text: cause instanceof Error ? cause.message : "Kelas gagal dicipta." });
    } finally {
      setSavingClass(false);
    }
  }

  const formFour = useMemo(() => classes.filter((item) => item.form_level === 4), [classes]);
  const formFive = useMemo(() => classes.filter((item) => item.form_level === 5), [classes]);

  function renderClassCards(items: ClassRecord[]) {
    return (
      <div className={styles.classGrid}>
        {items.map((item) => (
          <Link
            className={`${styles.classCard} ${!item.is_active ? styles.classCardInactive : ""}`}
            href={`/admin/kelas/${item.form_level}?kelas=${encodeURIComponent(item.class_name)}&class_id=${item.id}`}
            key={item.id}
          >
            <div className={styles.classCardTop}>
              <span className={styles.classLevel}>TINGKATAN {item.form_level}</span>
              <span className={styles.classBadge}>{item.is_active ? "KELAS AKTIF" : "DINYAH-AKTIFKAN"}</span>
            </div>
            <h2 className={styles.className}>{item.class_name}</h2>
            <span className={styles.classCardSub}>EKONOMI SMART · SMKTM</span>
            <div className={styles.classCardBottom}>
              <div className={styles.classCount}>
                <strong>{item.total_students}</strong>
                <span>ORANG MURID</span>
              </div>
              <span className={styles.classArrow}>→</span>
            </div>
            <span className={styles.classStateNote}>
              {item.active_students} aktif · {item.inactive_students} tidak aktif
            </span>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className={styles.classPageIntro}>
        <div className={styles.classSummary}>
          <div className={styles.summaryPill}>
            <strong>{classes.length}</strong>
            <span>JUMLAH KELAS</span>
          </div>
          <div className={styles.summaryPill}>
            <strong>{totalStudents}</strong>
            <span>JUMLAH MURID</span>
          </div>
          <div className={styles.summaryPill}>
            <strong>{activeStudents}</strong>
            <span>AKAUN AKTIF</span>
          </div>
        </div>
      </div>

      <section className={styles.classCreatePanel}>
        <div>
          <span className={styles.classLevel}>PENGURUSAN STRUKTUR KELAS</span>
          <h2 className={styles.createClassTitle}>Daftar kelas baharu</h2>
          <p className={styles.createClassDescription}>Cipta kelas kosong terlebih dahulu. Murid boleh ditetapkan ke kelas ini semasa pendaftaran atau dipindahkan kemudian.</p>
        </div>
        <form className={styles.createClassForm} onSubmit={handleCreateClass}>
          <select className={styles.classFormInput} value={newLevel} onChange={(event) => setNewLevel(event.target.value)} aria-label="Tingkatan kelas">
            <option value="4">Tingkatan 4</option>
            <option value="5">Tingkatan 5</option>
          </select>
          <input
            className={styles.classFormInput}
            value={newClassName}
            onChange={(event) => setNewClassName(event.target.value)}
            placeholder="Nama kelas, contoh: Bestari"
            maxLength={60}
            required
          />
          <button className={styles.classCreateButton} type="submit" disabled={savingClass}>
            {savingClass ? "MENYIMPAN..." : "+ CIPTA KELAS"}
          </button>
        </form>
        {notice ? <div className={`${styles.classNotice} ${notice.kind === "success" ? styles.classNoticeSuccess : styles.classNoticeError}`} role="status">{notice.text}</div> : null}
      </section>

      {loading ? (
        <div className={styles.classLoading}>Sedang memuatkan kelas daripada pangkalan data...</div>
      ) : error ? (
        <div className={styles.classError}>{error}</div>
      ) : classes.length === 0 ? (
        <div className={styles.classEmpty}>Belum ada kelas. Daftarkan kelas pertama melalui borang di atas.</div>
      ) : (
        <>
          {formFour.length > 0 ? (
            <section className={styles.classGroupSection}>
              <div className={styles.classLevel}>TINGKATAN 4</div>
              {renderClassCards(formFour)}
            </section>
          ) : null}
          {formFive.length > 0 ? (
            <section className={styles.classGroupSection}>
              <div className={styles.classLevel}>TINGKATAN 5</div>
              {renderClassCards(formFive)}
            </section>
          ) : null}
        </>
      )}

      <div className={styles.classRefreshRow}>
        <button className={styles.classBack} type="button" onClick={() => void refresh()} disabled={loading}>
          {loading ? "MEMUAT..." : "SEGARKAN SENARAI ↻"}
        </button>
      </div>
    </>
  );
}
