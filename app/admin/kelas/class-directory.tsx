"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";
import styles from "./kelas.module.css";

type ClassRecord = {
  form_level: number;
  class_name: string;
  total_students: number;
  active_students: number;
  inactive_students: number;
};
type ClassApiResponse = {
  classes?: ClassRecord[];
  total_classes?: number;
  total_students?: number;
  active_students?: number;
  error?: string;
};

async function loadClassDirectory(): Promise<ClassApiResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) throw new Error("Konfigurasi Supabase belum lengkap.");

  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) throw new Error("Sesi pentadbir telah tamat. Sila log masuk semula.");

  const response = await fetch(`${supabaseUrl}/functions/v1/admin-user-management`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ action: "list_classes" }),
    cache: "no-store"
  });
  const result = (await response.json()) as ClassApiResponse;
  if (!response.ok) throw new Error(result.error ?? "Senarai kelas gagal dimuatkan.");
  return result;
}

export default function ClassDirectory() {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [activeStudents, setActiveStudents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await loadClassDirectory();
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

  const formFour = useMemo(() => classes.filter((item) => item.form_level === 4), [classes]);
  const formFive = useMemo(() => classes.filter((item) => item.form_level === 5), [classes]);

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

      {loading ? (
        <div className={styles.classLoading}>Sedang memuatkan kelas daripada pangkalan data...</div>
      ) : error ? (
        <div className={styles.classError}>{error}</div>
      ) : classes.length === 0 ? (
        <div className={styles.classEmpty}>
          Belum ada kelas yang mempunyai akaun murid. Daftarkan murid terlebih dahulu melalui Pengurusan Pengguna.
        </div>
      ) : (
        <>
          {formFour.length > 0 ? (
            <section>
              <div className="section-kicker">TINGKATAN 4</div>
              <div className={styles.classGrid}>
                {formFour.map((item) => (
                  <Link
                    className={styles.classCard}
                    href={`/admin/kelas/4?kelas=${encodeURIComponent(item.class_name)}`}
                    key={item.form_level + "-" + item.class_name}
                  >
                    <div className={styles.classCardTop}>
                      <span className={styles.classLevel}>TINGKATAN 4</span>
                      <span className={styles.classBadge}>KELAS</span>
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
                      {item.active_students} aktif{item.inactive_students > 0 ? ` · ${item.inactive_students} tidak aktif` : ""}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {formFive.length > 0 ? (
            <section style={{ marginTop: formFour.length > 0 ? 38 : 0 }}>
              <div className="section-kicker">TINGKATAN 5</div>
              <div className={styles.classGrid}>
                {formFive.map((item) => (
                  <Link
                    className={styles.classCard}
                    href={`/admin/kelas/5?kelas=${encodeURIComponent(item.class_name)}`}
                    key={item.form_level + "-" + item.class_name}
                  >
                    <div className={styles.classCardTop}>
                      <span className={styles.classLevel}>TINGKATAN 5</span>
                      <span className={styles.classBadge}>KELAS</span>
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
                      {item.active_students} aktif{item.inactive_students > 0 ? ` · ${item.inactive_students} tidak aktif` : ""}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 22 }}>
        <button className={styles.classBack} type="button" onClick={() => void refresh()} disabled={loading}>
          {loading ? "MEMUAT..." : "SEGARKAN SENARAI ↻"}
        </button>
      </div>
    </>
  );
}
