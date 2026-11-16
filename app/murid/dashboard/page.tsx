import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "../../../lib/auth/get-current-profile";
import styles from "../../guru/guru.module.css";
import TeacherLogoutButton from "../../guru/dashboard/logout-button";
import StudentPerformance from "./student-performance";

export const metadata: Metadata = {
  title: "Dashboard Murid | Ekonomi Smart SMKTM",
  description: "Ruang pembelajaran murid EKONOMI SMART SMKTM."
};

const studentModules = [
  { number: "01", title: "Nota dan bahan pembelajaran", description: "Akses semua nota, PDF, video dan pautan Ekonomi Tingkatan 4 dan Tingkatan 5.", href: "/murid/pembelajaran", status: "BUKA PERPUSTAKAAN BAHAN →" },
  { number: "02", title: "Video dan penerangan", description: "Kandungan visual untuk membantu kefahaman.", href: null, status: "AKAN DATANG" },
  { number: "03", title: "Latihan dan kuiz", description: "Uji kefahaman dan semak pencapaian.", href: null, status: "AKAN DATANG" }
];

export default async function StudentDashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "student") redirect(profile.role === "admin" ? "/admin/dashboard" : "/guru/dashboard");

  return (
    <main className={styles.dashboardShell}>
      <header className={styles.dashboardHeader}>
        <Link className={styles.brand} href="/" aria-label="Ekonomi Smart SMKTM">
          <span className={styles.brandMark}>ES</span>
          <span className={styles.brandText}><strong>EKONOMI<span>SMART</span></strong><small>RUANG PEMBELAJARAN MURID</small></span>
        </Link>
        <div className={styles.dashboardActions}><span className={styles.teacherBadge}>MURID</span><TeacherLogoutButton /></div>
      </header>
      <section className={styles.dashboardMain}>
        <span className={styles.dashboardKicker}>RUANG PEMBELAJARAN ANDA</span>
        <h1 className={styles.dashboardTitle}>Selamat datang,<br /><em>{profile.full_name}</em></h1>
        <p className={styles.dashboardIntro}>
          {profile.form_level ? `Tingkatan ${profile.form_level}` : "Pembelajaran Ekonomi"}
          {profile.class_name ? ` · ${profile.class_name}` : ""} — akses prestasi dan bahan pembelajaran anda di sini.
        </p>

        <StudentPerformance />

        <div className={styles.dashboardGrid}>
          {studentModules.map((module) => module.href ? (
            <Link className={styles.moduleCard} href={module.href} key={module.number}>
              <span className={styles.moduleNumber}>{module.number} / PEMBELAJARAN</span><h3>{module.title}</h3><p>{module.description}</p><span className={styles.coming}>{module.status}</span>
            </Link>
          ) : (
            <article className={styles.moduleCard} key={module.number}>
              <span className={styles.moduleNumber}>{module.number} / PEMBELAJARAN</span><h3>{module.title}</h3><p>{module.description}</p><span className={styles.coming}>{module.status}</span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
