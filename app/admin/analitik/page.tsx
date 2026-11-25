import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "../../../lib/auth/get-current-profile";
import styles from "../../guru/guru.module.css";
import TeacherLogoutButton from "../../guru/dashboard/logout-button";
import AnalyticsDashboard from "./analytics-dashboard";
import analyticsStyles from "./analytics.module.css";

export const metadata: Metadata = {
  title: "Analitik Pencapaian | Ekonomi Smart SMKTM",
  description: "Infografik dan analisis pencapaian murid Ekonomi mengikut tingkatan, kelas dan individu."
};

export default async function AnalyticsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") {
    redirect(profile.role === "teacher" ? "/guru/dashboard" : "/murid/dashboard");
  }

  return (
    <main className={styles.dashboardShell}>
      <header className={styles.dashboardHeader}>
        <Link className={styles.brand} href="/" aria-label="Ekonomi Smart SMKTM">
          <span className={styles.brandMark}><img src="/smk-taman-medan-logo.png" alt="Logo SMK Taman Medan" /></span>
          <span className={styles.brandText}>
            <strong>EKONOMI<span>SMART</span></strong>
            <small>ANALITIK PENCAPAIAN · SMK TAMAN MEDAN</small>
          </span>
        </Link>
        <div className={styles.dashboardActions}>
          <Link className={analyticsStyles.actionButton} href="/admin/dashboard">← DASHBOARD</Link>
          <span className={styles.teacherBadge}>PENTADBIR</span>
          <TeacherLogoutButton />
        </div>
      </header>
      <section className={styles.dashboardMain}>
        <span className={styles.dashboardKicker}>PUSAT RUJUKAN DATA AKADEMIK</span>
        <h1 className={styles.dashboardTitle}>Analitik<br /><em>pencapaian murid.</em></h1>
        <p className={styles.dashboardIntro}>Rumusan dinamik pencapaian Ekonomi mengikut tingkatan, kelas dan individu. Semua angka dijana daripada rekod semasa dalam pangkalan data sekolah.</p>
        <AnalyticsDashboard />
      </section>
    </main>
  );
}
