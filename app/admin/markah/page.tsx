import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "../../../lib/auth/get-current-profile";
import styles from "../../guru/guru.module.css";
import marksStyles from "./marks.module.css";
import TeacherLogoutButton from "../../guru/dashboard/logout-button";
import MobileHeaderMenu from "../../shared/navigation/mobile-header-menu";
import MarkClassDirectory from "./class-directory";

export const metadata: Metadata = {
  title: "Rekod Markah | Ekonomi Smart SMKTM",
  description: "Pengurusan markah PPT2026 dan PAT2026 bagi murid Ekonomi SMK Taman Medan."
};

export default async function MarksDirectoryPage() {
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
            <small>REKOD MARKAH · SMK TAMAN MEDAN</small>
          </span>
        </Link>
        <div className={styles.dashboardActions}>
          <Link className={marksStyles.classBack ?? ""} href="/admin/dashboard">← DASHBOARD</Link>
          <span className={styles.teacherBadge}>PENTADBIR</span>
          <TeacherLogoutButton />
        </div>
      <div className="mobile-header-actions"><MobileHeaderMenu roleLabel="PENTADBIR" items={[{label:"Dashboard pentadbir",href:"/admin/dashboard"},{label:"Pengurusan pengguna",href:"/admin/pengguna"},{label:"Pengurusan kelas",href:"/admin/kelas"},{label:"Rekod markah",href:"/admin/markah"},{label:"Analitik pencapaian",href:"/admin/analitik"},{label:"Bahan pembelajaran",href:"/admin/pembelajaran"},{label:"Pentaksiran dan kuiz",href:"/admin/kuiz"}]} /></div>
      </header>

      <section className={styles.dashboardMain}>
        <span className={styles.dashboardKicker}>PUSAT DATA PENTAKSIRAN</span>
        <h1 className={styles.dashboardTitle}>Rekod markah<br /><em>murid.</em></h1>
        <p className={styles.dashboardIntro}>
          Kemas kini markah PPT2026 dan PAT2026 bagi setiap murid. Pilih kelas untuk melihat dan mengurus rekod mereka.
        </p>
        <MarkClassDirectory />
      </section>
    </main>
  );
}
