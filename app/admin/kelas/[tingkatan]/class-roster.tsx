"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../../lib/supabase/client";
import styles from "../kelas.module.css";

type Student = {
  user_id: string;
  username: string;
  full_name: string;
  form_level: number;
  class_name: string;
  academic_class_id: string;
  is_active: boolean;
};
type ClassOption = {
  id: string;
  form_level: number;
  class_name: string;
  is_active: boolean;
  total_students: number;
};
type ApiResponse = {
  students?: Student[];
  classes?: ClassOption[];
  message?: string;
  error?: string;
  class?: { id: string; form_level: number; class_name: string; is_active: boolean };
};

async function callAdmin(payload: Record<string, unknown>): Promise<ApiResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) throw new Error("Konfigurasi Supabase belum lengkap.");
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) throw new Error("Sesi pentadbir tamat. Sila log masuk semula.");

  const res = await fetch(`${supabaseUrl}/functions/v1/admin-user-management`, {
    method: "POST",
    headers: { apikey: publishableKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store"
  });
  const result = (await res.json()) as ApiResponse;
  if (!res.ok) throw new Error(result.error ?? "Operasi kelas gagal.");
  return result;
}

export default function ClassRoster({
  classId,
  formLevel,
  className
}: {
  classId: string;
  formLevel: number;
  className: string;
}) {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [newClassName, setNewClassName] = useState(className);
  const [savingRename, setSavingRename] = useState(false);
  const [movingStudent, setMovingStudent] = useState("");
  const [targetClasses, setTargetClasses] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [roster, directory] = await Promise.all([
        callAdmin({ action: "list_class_students", class_id: classId }),
        callAdmin({ action: "list_classes" })
      ]);
      setStudents(roster.students ?? []);
      setClasses((directory.classes ?? []).filter((item) => item.is_active));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Senarai murid gagal dimuatkan.");
    } finally {
      setLoading(false);
    }
  }, [classId]);

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

  async function handleRename() {
    const nextName = newClassName.trim();
    if (!nextName || nextName === className) return;
    setSavingRename(true);
    setNotice("");
    try {
      const result = await callAdmin({
        action: "rename_class",
        class_id: classId,
        new_class_name: nextName
      });
      setNotice(result.message ?? "Nama kelas berjaya dikemaskini.");
      router.replace(`/admin/kelas/${formLevel}?kelas=${encodeURIComponent(nextName)}&class_id=${classId}`);
      router.refresh();
      await refresh();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Nama kelas gagal dikemaskini.");
    } finally {
      setSavingRename(false);
    }
  }

  async function handleClassStatus(active: boolean) {
    const actionText = active ? "aktifkan" : "nyahaktifkan";
    if (!window.confirm(`Adakah cikgu pasti mahu ${actionText} kelas ${className}?`)) return;
    try {
      const result = await callAdmin({ action: "set_class_status", class_id: classId, is_active: active });
      setNotice(result.message ?? "Status kelas dikemaskini.");
      router.refresh();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Status kelas gagal dikemaskini.");
    }
  }

  async function handleDeleteClass() {
    if (!window.confirm(`Padam kelas kosong ${className}? Tindakan ini tidak boleh dibatalkan.`)) return;
    try {
      const result = await callAdmin({ action: "delete_class", class_id: classId });
      setNotice(result.message ?? "Kelas berjaya dipadam.");
      router.push("/admin/kelas");
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Kelas gagal dipadam.");
    }
  }

  async function handleTransfer(student: Student) {
    const targetId = targetClasses[student.user_id];
    if (!targetId) {
      setNotice("Pilih kelas sasaran terlebih dahulu.");
      return;
    }
    const target = classes.find((item) => item.id === targetId);
    if (!target) {
      setNotice("Kelas sasaran tidak ditemui.");
      return;
    }
    if (!window.confirm(`Pindahkan ${student.full_name} ke Tingkatan ${target.form_level} ${target.class_name}?`)) return;

    setMovingStudent(student.user_id);
    setNotice("");
    try {
      const result = await callAdmin({ action: "transfer_student", user_id: student.user_id, class_id: targetId });
      setNotice(result.message ?? "Murid berjaya dipindahkan.");
      await refresh();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Murid gagal dipindahkan.");
    } finally {
      setMovingStudent("");
    }
  }

  function exportCsv() {
    const rows = [
      ["Bil", "Nama Penuh", "Username", "Tingkatan", "Kelas", "Status"],
      ...filtered.map((student, index) => [
        String(index + 1),
        student.full_name,
        student.username,
        String(student.form_level),
        student.class_name,
        student.is_active ? "Aktif" : "Tidak aktif"
      ])
    ];
    const csv = "\uFEFF" + rows
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `Senarai_${formLevel}_${className.replace(/\s+/g, "_")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className={styles.rosterPanel}>
      <div className={styles.classManagementPanel}>
        <div>
          <span className={styles.classLevel}>MAKLUMAT DAN TINDAKAN KELAS</span>
          <p className={styles.classCardSub}>Kelas ini mempunyai {students.length} murid berdaftar, {activeCount} akaun aktif.</p>
        </div>
        <div className={styles.classManagementActions}>
          <button className={styles.classActionButton} type="button" onClick={() => void handleClassStatus(false)}>NYAHAKTIFKAN KELAS</button>
          {students.length === 0 ? (
            <button className={styles.classDangerButton} type="button" onClick={() => void handleDeleteClass()}>PADAM KELAS KOSONG</button>
          ) : null}
        </div>
      </div>

      <div className={styles.renameClassForm}>
        <label htmlFor="rename-class">NAMA KELAS</label>
        <input id="rename-class" className={styles.rosterSearch} value={newClassName} onChange={(event) => setNewClassName(event.target.value)} maxLength={60}/>
        <button className={styles.classCreateButton} type="button" disabled={savingRename || !newClassName.trim() || newClassName.trim() === className} onClick={() => void handleRename()}>
          {savingRename ? "MENYIMPAN..." : "KEMASKINI NAMA"}
        </button>
      </div>

      <div className={styles.rosterTools}>
        <div>
          <span className={styles.classLevel}>SENARAI MURID · TINGKATAN {formLevel}</span>
          <h2 className={styles.className}>{className}</h2>
          <p className={styles.classCardSub}>{students.length} murid · {activeCount} akaun aktif</p>
        </div>
        <div className={styles.rosterToolButtons}>
          <input className={styles.rosterSearch} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama atau username murid..." aria-label="Cari nama atau username murid"/>
          <button className={styles.classActionButton} type="button" onClick={() => window.print()}>CETAK SENARAI</button>
          <button className={styles.classActionButton} type="button" onClick={exportCsv}>EKSPORT CSV</button>
        </div>
      </div>

      {notice ? <div className={styles.classNotice} role="status">{notice}</div> : null}

      {loading ? (
        <div className={styles.classLoading}>Sedang memuatkan senarai murid...</div>
      ) : error ? (
        <div className={styles.classError}>{error}</div>
      ) : (
        <>
          <div className={styles.rosterTableWrap}>
            <table className={styles.rosterTable}>
              <thead>
                <tr><th>BIL.</th><th>NAMA MURID</th><th>USERNAME</th><th>STATUS AKAUN</th><th className={styles.noPrint}>PINDAH KELAS</th></tr>
              </thead>
              <tbody>
                {filtered.map((student, index) => {
                  const destinations = classes.filter((item) => item.id !== classId);
                  return (
                    <tr key={student.user_id}>
                      <td className={styles.rosterIndex}>{index + 1}</td>
                      <td className={styles.rosterName}>{student.full_name}</td>
                      <td>@{student.username}</td>
                      <td><span className={`${styles.rosterStatus} ${student.is_active ? styles.rosterActive : styles.rosterInactive}`}>{student.is_active ? "AKTIF" : "TIDAK AKTIF"}</span></td>
                      <td className={styles.noPrint}>
                        <div className={styles.transferCell}>
                          <select
                            className={styles.transferSelect}
                            value={targetClasses[student.user_id] ?? ""}
                            onChange={(event) => setTargetClasses((previous) => ({ ...previous, [student.user_id]: event.target.value }))}
                            aria-label={`Pilih kelas baharu untuk ${student.full_name}`}
                          >
                            <option value="">Pilih kelas...</option>
                            {destinations.map((item) => <option key={item.id} value={item.id}>T{item.form_level} · {item.class_name}</option>)}
                          </select>
                          <button className={styles.transferButton} type="button" disabled={movingStudent === student.user_id || destinations.length === 0} onClick={() => void handleTransfer(student)}>
                            {movingStudent === student.user_id ? "..." : "PINDAH"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 ? <tr><td colSpan={5} className={styles.emptyUsers}>{search ? "Tiada murid sepadan dengan carian." : "Tiada murid dalam kelas ini."}</td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className={styles.rosterFooter}>
            <span>Memaparkan {filtered.length} daripada {students.length} murid</span>
            <span>Password dan maklumat pengesahan tidak dipaparkan.</span>
          </div>
        </>
      )}
      <style jsx global>{`
        @media print {
          body { background: #fff !important; }
          header, .noPrint, button, input, select { display: none !important; }
          main { background: #fff !important; }
          table { width: 100% !important; }
        }
      `}</style>
    </section>
  );
}
