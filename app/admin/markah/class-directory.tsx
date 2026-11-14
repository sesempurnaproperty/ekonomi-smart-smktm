"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";
import styles from "./marks.module.css";

type MarkClass = {
  id: string;
  form_level: number;
  class_name: string;
  is_active: boolean;
  total_students: number;
  active_students: number;
  marks_PPT2026: number;
  marks_PAT2026: number;
};
type Assessment = { code: string; title: string; max_score: number; is_active: boolean };
type ApiResponse = { classes?: MarkClass[]; assessments?: Assessment[]; error?: string };

async function getData(): Promise<ApiResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Konfigurasi Supabase belum lengkap.");
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Sesi pentadbir tamat. Sila log masuk semula.");
  const response = await fetch(`${url}/functions/v1/admin-user-management`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "list_mark_classes" }),
    cache: "no-store"
  });
  const result = (await response.json()) as ApiResponse;
  if (!response.ok) throw new Error(result.error ?? "Data rekod markah gagal dimuatkan.");
  return result;
}

export default function MarkClassDirectory() {
  const [classes, setClasses] = useState<MarkClass[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getData();
      setClasses(data.classes ?? []);
      setAssessments((data.assessments ?? []).filter((item) => item.is_active));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Data gagal dimuatkan.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const studentTotal = classes.reduce((sum, item) => sum + item.total_students, 0);

  return (
    <>
      <div className={styles.markSummary}>
        <div className={styles.markSummaryCard}><strong>{classes.length}</strong><span>JUMLAH KELAS</span></div>
        <div className={styles.markSummaryCard}><strong>{studentTotal}</strong><span>MURID AKTIF</span></div>
        <div className={styles.markSummaryCard}><strong>{assessments.length}</strong><span>PENTAKSIRAN AKTIF</span></div>
      </div>

      {loading ? <div className={styles.markLoading}>Memuatkan rekod kelas dan status markah...</div> : null}
      {error ? <div className={styles.markError}>{error}</div> : null}
      {!loading && !error && classes.length === 0 ? <div className={styles.markEmpty}>Tiada kelas dijumpai.</div> : null}

      {!loading && !error && classes.length > 0 ? (
        <div className={styles.markClassGrid}>
          {classes.map((item) => (
            <Link className={styles.markClassCard} key={item.id} href={`/admin/markah/${item.id}`}>
              <span className={styles.classLevel}>TINGKATAN {item.form_level} · {item.is_active ? "KELAS AKTIF" : "KELAS TIDAK AKTIF"}</span>
              <h2 className={styles.markClassTitle}>{item.class_name}</h2>
              <div className={styles.markCardFoot}>
                <span>{item.total_students} murid aktif</span>
                <span>BUKA →</span>
              </div>
              <div className={styles.markExamStats}>
                <div className={styles.markExamStat}>
                  <strong>{item.marks_PPT2026}/{item.total_students}</strong>
                  <span>MARKAH PPT2026</span>
                </div>
                <div className={styles.markExamStat}>
                  <strong>{item.marks_PAT2026}/{item.total_students}</strong>
                  <span>MARKAH PAT2026</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : null}

      <p className={styles.markFootnote}>
        Kiraan pada kad menunjukkan bilangan murid yang mempunyai rekod markah bagi setiap pentaksiran. Klik kad untuk mengemas kini markah individu atau mengimport markah seluruh kelas.
      </p>
    </>
  );
}
