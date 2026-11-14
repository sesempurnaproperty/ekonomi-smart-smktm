"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createClient } from "../../../lib/supabase/client";
import styles from "./users.module.css";
import BulkStudentImport from "./bulk-student-import";

type Role = "admin" | "teacher" | "student";
type UserRecord = {
  user_id: string;
  username: string;
  full_name: string;
  role: Role;
  form_level: number | null;
  class_name: string | null;
  is_active: boolean;
  created_at: string;
};
type ClassOption = {
  id: string;
  form_level: number;
  class_name: string;
  is_active: boolean;
  total_students: number;
};
type ApiResponse = {
  users?: UserRecord[];
  user?: UserRecord[];
  classes?: ClassOption[];
  message?: string;
  error?: string;
};

async function callManagementApi(payload: Record<string, unknown>): Promise<ApiResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) throw new Error("Konfigurasi Supabase belum lengkap.");

  const supabase = createClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (sessionError || !accessToken) {
    throw new Error("Sesi pentadbir tiada atau telah tamat. Sila log masuk semula.");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/admin-user-management`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const result = (await response.json()) as ApiResponse;
  if (!response.ok) throw new Error(result.error ?? "Permintaan tidak berjaya.");
  return result;
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"teacher" | "student">("teacher");
  const [password, setPassword] = useState("");
  const [formLevel, setFormLevel] = useState("4");
  const [classId, setClassId] = useState("");
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [listError, setListError] = useState("");

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    setListError("");
    try {
      const [result, classResult] = await Promise.all([
        callManagementApi({ action: "list" }),
        callManagementApi({ action: "list_classes" })
      ]);
      setUsers(result.users ?? []);
      setClassOptions(classResult.classes ?? []);
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Senarai pengguna gagal dimuatkan.");
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);

    try {
      const selectedClass = classOptions.find((item) => item.id === classId && item.is_active);
      if (role === "student" && !selectedClass) {
        throw new Error("Pilih kelas aktif yang telah didaftarkan dalam Modul Pengurusan Kelas.");
      }
      const result = await callManagementApi({
        action: "create",
        username,
        full_name: fullName,
        role,
        password,
        form_level: role === "student" ? selectedClass?.form_level : null,
        class_name: role === "student" ? selectedClass?.class_name : null
      });

      setNotice({
        kind: "success",
        text: `Akaun ${result.user?.username ?? username} berjaya dicipta sebagai ${role === "teacher" ? "guru" : "murid"}. Password tidak dipaparkan semula selepas ini.`
      });
      setUsername("");
      setFullName("");
      setPassword("");
      setClassId("");
      await loadUsers();
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Akaun gagal dicipta."
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(user: UserRecord) {
    const nextStatus = !user.is_active;
    const confirmed = window.confirm(
      `${nextStatus ? "Aktifkan" : "Nyahaktifkan"} akaun ${user.username}?`
    );
    if (!confirmed) return;

    setNotice(null);
    try {
      await callManagementApi({
        action: "set_status",
        user_id: user.user_id,
        is_active: nextStatus
      });
      setNotice({
        kind: "success",
        text: `Status akaun ${user.username} telah dikemaskini.`
      });
      await loadUsers();
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Status akaun gagal dikemaskini."
      });
    }
  }

  const studentCount = users.filter((user) => user.role === "student").length;
  const teacherCount = users.filter((user) => user.role === "teacher").length;

  return (
    <section className={styles.userManagement}>
      <div className={styles.userPanel}>
        <span className={styles.panelKicker}>DAFTAR PENGGUNA BAHARU</span>
        <h2 className={styles.panelTitle}>Cipta akaun</h2>
        <p className={styles.panelDescription}>
          Cikgu tentukan username dan password. Akaun akan terus didaftarkan dalam Supabase Auth.
        </p>

        <form className={styles.userForm} onSubmit={handleCreate}>
          <div className={styles.userField}>
            <label htmlFor="new-role">JENIS AKAUN</label>
            <select
              id="new-role"
              className={styles.userSelect}
              value={role}
              onChange={(event) => setRole(event.target.value as "teacher" | "student")}
            >
              <option value="teacher">Guru</option>
              <option value="student">Murid</option>
            </select>
          </div>

          <div className={styles.userField}>
            <label htmlFor="new-full-name">NAMA PENUH</label>
            <input
              id="new-full-name"
              className={styles.userInput}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Nama penuh pengguna"
              required
              minLength={2}
              maxLength={150}
            />
          </div>

          <div className={styles.userField}>
            <label htmlFor="new-username">USERNAME</label>
            <input
              id="new-username"
              className={styles.userInput}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Contoh: guru01 atau username DELIMa"
              autoCapitalize="none"
              spellCheck={false}
              required
              minLength={3}
              maxLength={254}
            />
            <span className={styles.userFieldHint}>Username biasa 3–32 aksara, atau alamat e-mel DELIMa.</span>
          </div>

          <div className={styles.userField}>
            <label htmlFor="new-password">PASSWORD</label>
            <div className={styles.userPasswordWrap}>
              <input
                id="new-password"
                className={styles.userInput}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Tetapkan password pengguna"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={256}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? "SEMBUNYI" : "PAPAR"}
              </button>
            </div>
            <span className={styles.userFieldHint}>Minimum 8 aksara. Password tidak disimpan dalam jadual profil atau dipaparkan semula.</span>
          </div>

          {role === "student" ? (
            <>
              <div className={styles.userField}>
                <label htmlFor="new-form-level">TINGKATAN</label>
                <select
                  id="new-form-level"
                  className={styles.userSelect}
                  value={formLevel}
                  onChange={(event) => {
                    setFormLevel(event.target.value);
                    setClassId("");
                  }}
                >
                  <option value="4">Tingkatan 4</option>
                  <option value="5">Tingkatan 5</option>
                </select>
              </div>
              <div className={styles.userField}>
                <label htmlFor="new-class-id">KELAS</label>
                <select
                  id="new-class-id"
                  className={styles.userSelect}
                  value={classId}
                  onChange={(event) => setClassId(event.target.value)}
                  required
                >
                  <option value="">Pilih kelas Tingkatan {formLevel}</option>
                  {classOptions
                    .filter((item) => item.is_active && item.form_level === Number(formLevel))
                    .map((item) => (
                      <option key={item.id} value={item.id}>{item.class_name}</option>
                    ))}
                </select>
                <span className={styles.userFieldHint}>Jika kelas belum ada, cipta dahulu melalui Modul Pengurusan Kelas.</span>
              </div>
            </>
          ) : null}

          <button className={styles.userSubmit} type="submit" disabled={saving}>
            {saving ? "SEDANG MENCIPTA AKAUN..." : "CIPTA AKAUN PENGGUNA"}
          </button>
        </form>

        {notice ? (
          <div
            className={`${styles.userNotice} ${notice.kind === "success" ? styles.userNoticeSuccess : styles.userNoticeError}`}
            role="status"
          >
            {notice.text}
          </div>
        ) : null}
      </div>

      <div className={styles.userPanel}>
        <div className={styles.userTableTop}>
          <div>
            <span className={styles.panelKicker}>DIREKTORI AKAUN</span>
            <h2 className={styles.panelTitle}>Senarai pengguna</h2>
            <span className={styles.userCount}>
              {users.length} pengguna · {teacherCount} guru · {studentCount} murid
            </span>
          </div>
          <button className={styles.refreshButton} type="button" onClick={() => void loadUsers()} disabled={loadingUsers}>
            {loadingUsers ? "MEMUAT..." : "SEGARKAN ↻"}
          </button>
        </div>

        {listError ? (
          <div className={`${styles.userNotice} ${styles.userNoticeError}`}>{listError}</div>
        ) : null}

        <div className={styles.userTableWrap}>
          <table className={styles.userTable}>
            <thead>
              <tr>
                <th>NAMA / USERNAME</th>
                <th>ROLE</th>
                <th>KELAS</th>
                <th>STATUS</th>
                <th>TINDAKAN</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.user_id}>
                  <td>
                    <span className={styles.userName}>{user.full_name}</span><br />
                    <span>@{user.username}</span>
                  </td>
                  <td>
                    <span className={`${styles.rolePill} ${user.role === "admin" ? styles.roleAdmin : user.role === "teacher" ? styles.roleTeacher : styles.roleStudent}`}>
                      {user.role === "admin" ? "ADMIN" : user.role === "teacher" ? "GURU" : "MURID"}
                    </span>
                  </td>
                  <td>{user.role === "student" ? `T${user.form_level ?? "—"} · ${user.class_name ?? "—"}` : "—"}</td>
                  <td>
                    <span className={`${styles.statusPill} ${user.is_active ? styles.statusActive : styles.statusInactive}`}>
                      {user.is_active ? "AKTIF" : "NYAHAKTIF"}
                    </span>
                  </td>
                  <td>
                    {user.role === "admin" ? "—" : (
                      <button
                        type="button"
                        className={styles.statusButton}
                        onClick={() => void handleStatusChange(user)}
                      >
                        {user.is_active ? "NYAHAKTIF" : "AKTIFKAN"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!loadingUsers && users.length === 0 ? (
                <tr><td colSpan={5} className={styles.emptyUsers}>Tiada rekod pengguna untuk dipaparkan.</td></tr>
              ) : null}
              {loadingUsers ? (
                <tr><td colSpan={5} className={styles.emptyUsers}>Sedang memuatkan senarai akaun...</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className={styles.bulkNotice}>
          <strong>IMPORT PUKAL 61 MURID — SEDIA DIGUNAKAN</strong>
          <p>Muat naik template Excel/CSV di bawah. Sistem menyemak rekod, username pendua dan format data sebelum mencipta akaun Supabase Auth.</p>
        </div>
      </div>
      <BulkStudentImport onImported={loadUsers} />
    </section>
  );
}
