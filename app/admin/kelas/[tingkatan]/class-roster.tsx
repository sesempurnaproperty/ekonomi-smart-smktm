"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../../../../lib/supabase/client";
import styles from "../kelas.module.css";

type Student = {
  user_id: string;
  username: string;
  full_name: string;
  form_level: number;
  class_name: string;
  is_active: boolean;
};
type ApiResponse = {
  students?: Student[];
  error?: string;
};

async function loadStudents(formLevel: number, className: string): Promise<Student[]> {
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
    body: JSON.stringify({
      action: "list_class_students",
      form_level: formLevel,
      class_name: className
    }),
    cache: "no-store"
  });
  const result = (await response.json()) as ApiResponse;
  if (!response.ok) throw new Error(result.error ?? "Senarai murid gagal dimuatkan.");
  return result.students ?? [];
}

export default function ClassRoster({
  formLevel,
  className
}: {
  formLevel: number;
  className: string;
}) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setStudents(await loadStudents(formLevel, className));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Senarai murid gagal dimuatkan.");
    } finally {
      setLoading(false);
    }
  }, [formLevel, className]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return students;
    return students.filter((student) =>
      student.full_name.toLowerCase().includes(term) ||
      student.username.toLowerCase().includes(term)
    );
  }, [students, search]);

  const activeCount = students.filter((student) => student.is_active).length;

  return (
    <section className={styles.rosterPanel}>
      <div className={styles.rosterTools}>
        <div>
          <span className={styles.classLevel}>SENARAI MURID · TINGKATAN {formLevel}</span>
          <h2 className={styles.className}>{className}</h2>
          <p className={styles.classCardSub}>{students.length} murid · {activeCount} akaun aktif</p>
        </div>
        <input
          className={styles.rosterSearch}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cari nama atau username murid..."
          aria-label="Cari nama atau username murid"
        />
      </div>

      {loading ? (
        <div className={styles.classLoading}>Sedang memuatkan senarai murid...</div>
      ) : error ? (
        <div className={styles.classError}>{error}</div>
      ) : (
        <>
          <div className={styles.rosterTableWrap}>
            <table className={styles.rosterTable}>
              <thead>
                <tr>
                  <th>BIL.</th>
                  <th>NAMA MURID</th>
                  <th>USERNAME</th>
                  <th>STATUS AKAUN</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((student, index) => (
                  <tr key={student.user_id}>
                    <td className={styles.rosterIndex}>{index + 1}</td>
                    <td className={styles.rosterName}>{student.full_name}</td>
                    <td>@{student.username}</td>
                    <td>
                      <span className={`${styles.rosterStatus} ${student.is_active ? styles.rosterActive : styles.rosterInactive}`}>
                        {student.is_active ? "AKTIF" : "TIDAK AKTIF"}
                      </span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr><td colSpan={4} className={styles.emptyUsers}>{search ? "Tiada murid sepadan dengan carian." : "Tiada murid dalam kelas ini."}</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className={styles.rosterFooter}>
            <span>Memaparkan {filtered.length} daripada {students.length} murid</span>
            <span>Password dan maklumat pengesahan tidak dipaparkan.</span>
          </div>
        </>
      )}
    </section>
  );
}
