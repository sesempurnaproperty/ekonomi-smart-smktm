import type { Metadata } from "next";
import Link from "next/link";
import styles from "../guru.module.css";
import TeacherLoginForm from "./login-form";

export const metadata: Metadata = {
  title: "Log Masuk Guru | Ekonomi Smart SMKTM",
  description: "Log masuk ruang pengurusan guru EKONOMI SMART SMKTM."
};

export default function TeacherLoginPage() {
  return (
    <main className={styles.pageShell}>
      <div className={styles.loginLayout}>
        <section className={styles.brandPanel}>
          <Link className={styles.brand} href="/" aria-label="Ekonomi Smart SMKTM">
            <span className={styles.brandMark}>ES</span>
            <span className={styles.brandText}>
              <strong>EKONOMI<span>SMART</span></strong>
              <small>SMK TAMAN MEDAN</small>
            </span>
          </Link>

          <div className={styles.brandMessage}>
            <div className={styles.kicker}><i /> PORTAL PENGURUSAN GURU</div>
            <h1>Ruang untuk<br /><em>memimpin pembelajaran.</em></h1>
            <p>
              Pusat kawalan pengajaran Ekonomi Tingkatan 4 dan Tingkatan 5.
              Urus pembelajaran, pantau perkembangan dan bimbing murid dengan lebih terarah.
            </p>
            <div className={styles.signalCard}>
              <span className={styles.signalIcon}>↗</span>
              <span>
                <strong>Ilmu tersusun, pengurusan lebih jelas</strong>
                <small>EKONOMI SMART · SMK TAMAN MEDAN</small>
              </span>
            </div>
          </div>

          <div className={styles.brandFoot}>
            <span>AKSES KHAS GURU</span>
            <span>SMKTM · 2026</span>
          </div>
        </section>

        <section className={styles.formPanel}>
          <div className={styles.formTopline}>
            <span>SELAMAT DATANG KEMBALI</span>
            <Link className={styles.backLink} href="/">← Halaman utama</Link>
          </div>

          <div className={styles.formHeading}>
            <small>LOG MASUK GURU</small>
            <h2>Teruskan tugas<br />anda dengan bijak.</h2>
            <p>Masukkan username dan kata laluan guru untuk mengakses portal.</p>
          </div>

          <TeacherLoginForm />

          <div className={styles.securityNote}>
            <span>♢</span>
            <div>Akses ini dikhaskan untuk akaun guru yang telah didaftarkan oleh pentadbir sistem.</div>
          </div>
        </section>
      </div>
    </main>
  );
}
