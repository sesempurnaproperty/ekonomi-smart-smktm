"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "../guru.module.css";
import { createClient } from "../../../lib/supabase/client";

type LoginResponse = {
  access_token?: string;
  refresh_token?: string;
  error?: string;
};

export default function TeacherLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    const normalizedUsername = username.trim().toLowerCase();
    if (!normalizedUsername || !password) {
      setErrorMessage("Sila lengkapkan username dan kata laluan.");
      return;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !publishableKey) {
      setErrorMessage("Konfigurasi log masuk belum lengkap. Sila hubungi pentadbir.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/teacher-username-login`,
        {
          method: "POST",
          headers: {
            apikey: publishableKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            username: normalizedUsername,
            password
          })
        }
      );

      const result = (await response.json()) as LoginResponse;

      if (!response.ok || !result.access_token || !result.refresh_token) {
        setErrorMessage(
          result.error ?? "Username atau kata laluan tidak sah."
        );
        return;
      }

      const supabase = createClient();
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token
      });

      if (sessionError) {
        setErrorMessage("Sesi log masuk gagal diwujudkan. Sila cuba lagi.");
        return;
      }

      router.replace("/guru/dashboard");
      router.refresh();
    } catch {
      setErrorMessage("Tidak dapat menghubungi perkhidmatan log masuk. Semak sambungan internet.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label htmlFor="teacher-username">USERNAME</label>
        <input
          className={styles.input}
          id="teacher-username"
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Masukkan username guru"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
          minLength={3}
          maxLength={32}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="teacher-password">KATA LALUAN</label>
        <div className={styles.inputWrap}>
          <input
            className={`${styles.input} ${styles.passwordInput}`}
            id="teacher-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Masukkan kata laluan"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            maxLength={256}
          />
          <button
            className={styles.showPassword}
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? "Sembunyikan kata laluan" : "Papar kata laluan"}
          >
            {showPassword ? "SEMBUNYI" : "PAPAR"}
          </button>
        </div>
      </div>

      {errorMessage ? (
        <div className={styles.error} role="alert">{errorMessage}</div>
      ) : null}

      <button className={styles.submit} type="submit" disabled={loading}>
        {loading ? "SEDANG LOG MASUK..." : "LOG MASUK KE PORTAL"}
        {!loading ? <span aria-hidden="true">→</span> : null}
      </button>
      <p className={styles.helper}>
        Terlupa kata laluan? Hubungi pentadbir sistem untuk bantuan akses.
      </p>
    </form>
  );
}
