import type { Metadata } from "next";
import Link from "next/link";
import styles from "../guru/guru.module.css";
import PortalLoginForm from "./portal-login-form";

export const metadata: Metadata = {
  title: "Log Masuk | Ekonomi Smart SMKTM",
  description: "Pintu masuk tunggal untuk guru dan murid EKONOMI SMART SMKTM."
};

export default function PortalLoginPage() {
  return (
    <main className={styles.pageShell}>
      <div className={styles.loginLayout}>
        <section className={styles.brandPanel}>
          <Link className={styles.brand} href="/" aria-label="Ekonomi Smart SMKTM">
            <span className={styles.brandMark}><img src="/smk-taman-medan-logo.png" alt="Logo SMK Taman Medan" /></span>
            <span className={styles.brandText}>
              <strong>EKONOMI<span>SMART</span></strong>
              <small>SMK TAMAN MEDAN</small>
            </span>
          </Link>

          <div className={styles.brandMessage}>
            <div className={styles.kicker}><i /> PORTAL PEMBELAJARAN DIGITAL</div>
            <h1>Satu pintu.<br /><em>Pelbagai peluang.</em></h1>
            <p>
              Ruang pembelajaran Ekonomi Tingkatan 4 dan Tingkatan 5.
              Log masuk untuk meneroka bahan, aktiviti dan pengalaman pembelajaran anda.
            </p>
            <div className={styles.signalCard}>
              <span className={styles.signalIcon}>↗</span>
              <span>
                <strong>Belajar, berkembang dan capai potensi</strong>
                <small>EKONOMI SMART · SMK TAMAN MEDAN</small>
              </span>
            </div>
          </div>

          <div className={styles.brandFoot}>
            <span>AKSES GURU DAN MURID</span>
            <span>SMKTM · 2026</span>
          </div>
        </section>

        <section className={styles.formPanel}>
          <div className={styles.formTopline}>
            <span>SELAMAT DATANG</span>
            <Link className={styles.backLink} href="/">← Halaman utama</Link>
          </div>

          <div className={styles.formHeading}>
            <small>PORTAL EKONOMI SMART</small>
            <h2>Teruskan perjalanan<br />pembelajaran anda.</h2>
            <p>Gunakan username dan kata laluan yang diberikan oleh pentadbir.</p>
          </div>

          <PortalLoginForm />

          <div className={styles.securityNote}>
            <span>♢</span>
            <div>Sistem akan membawa anda ke ruang yang sepadan dengan jenis akaun secara automatik.</div>
          </div>
        </section>
      </div>
    </main>
  );
}
