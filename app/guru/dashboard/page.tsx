import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "../../../lib/auth/get-current-profile";
import styles from "../guru.module.css";
import TeacherLogoutButton from "./logout-button";

export const metadata: Metadata = {
  title: "Dashboard Guru | Ekonomi Smart SMKTM",
  description: "Ruang pengurusan guru EKONOMI SMART SMKTM."
};

const modules = [
  { number: "01", title: "Pengurusan kelas", description: "Urus kelas Ekonomi Tingkatan 4 dan Tingkatan 5.", href: null, status: "DALAM PEMBANGUNAN" },
  { number: "02", title: "Bahan pembelajaran", description: "Susun bab, nota, PDF, video dan pautan mengikut tingkatan.", href: "/guru/pembelajaran", status: "BUKA PERPUSTAKAAN BAHAN →" },
  { number: "03", title: "Pentaksiran dan kuiz", description: "Bina kuiz objektif dan struktur, semak jawapan serta urus markah murid.", href: "/guru/kuiz", status: "BUKA PENGURUSAN KUIZ →" }
];

export default async function TeacherDashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "teacher") redirect(profile.role === "admin" ? "/admin/dashboard" : "/murid/dashboard");

  return (
    <main className={styles.dashboardShell}>
      <header className={styles.dashboardHeader}>
        <Link className={styles.brand} href="/" aria-label="Ekonomi Smart SMKTM">
          <span className={styles.brandMark}>ES</span>
          <span className={styles.brandText}><strong>EKONOMI<span>SMART</span></strong><small>PORTAL GURU · SMK TAMAN MEDAN</small></span>
        </Link>
        <div className={styles.dashboardActions}><span className={styles.teacherBadge}>AKSES GURU</span><TeacherLogoutButton /></div>
      </header>
      <section className={styles.dashboardMain}>
        <span className={styles.dashboardKicker}>PUSAT PENGURUSAN PEMBELAJARAN</span>
        <h1 className={styles.dashboardTitle}>Selamat datang,<br /><em>{profile.full_name}</em></h1>
        <p className={styles.dashboardIntro}>Ini ruang kerja guru EKONOMI SMART SMKTM. Modul akan diaktifkan secara berperingkat.</p>
        <div className={styles.accountCard}>
          <div><small>AKAUN GURU AKTIF</small><strong>{profile.full_name}</strong></div>
          <span>@{profile.username}</span>
        </div>
        <div className={styles.dashboardGrid}>
          {modules.map((module) => module.href ? (
            <Link className={styles.moduleCard} href={module.href} key={module.number}>
              <span className={styles.moduleNumber}>{module.number} / MODUL</span><h3>{module.title}</h3><p>{module.description}</p><span className={styles.coming}>{module.status}</span>
            </Link>
          ) : (
            <article className={styles.moduleCard} key={module.number}>
              <span className={styles.moduleNumber}>{module.number} / MODUL</span><h3>{module.title}</h3><p>{module.description}</p><span className={styles.coming}>{module.status}</span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
