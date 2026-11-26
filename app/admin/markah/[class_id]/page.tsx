import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "../../../../lib/auth/get-current-profile";
import styles from "../../../guru/guru.module.css";
import marksStyles from "../marks.module.css";
import TeacherLogoutButton from "../../../guru/dashboard/logout-button";
import MobileHeaderMenu from "../../../shared/navigation/mobile-header-menu";
import ClassMarksManager from "./class-marks-manager";

export const metadata: Metadata = {
  title: "Kemas Kini Markah Kelas | Ekonomi Smart SMKTM",
  description: "Rekod markah PPT2026 dan PAT2026 bagi setiap murid."
};

export default async function ClassMarksPage({ params }: { params: Promise<{ class_id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") {
    redirect(profile.role === "teacher" ? "/guru/dashboard" : "/murid/dashboard");
  }
  const { class_id: classId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(classId)) notFound();

  return (
    <main className={styles.dashboardShell}>
      <header className={styles.dashboardHeader}>
        <Link className={styles.brand} href="/" aria-label="Ekonomi Smart SMKTM">
          <span className={styles.brandMark}><img src="/smk-taman-medan-logo.png" alt="Logo SMK Taman Medan" /></span>
          <span className={styles.brandText}>
            <strong>EKONOMI<span>SMART</span></strong>
            <small>KEMAS KINI MARKAH · SMK TAMAN MEDAN</small>
          </span>
        </Link>
        <div className={styles.dashboardActions}>
          <Link className={marksStyles.classBack} href="/admin/markah">← SEMUA KELAS</Link>
          <span className={styles.teacherBadge}>PENTADBIR</span>
          <TeacherLogoutButton />
        </div>
      <div className="mobile-header-actions"><MobileHeaderMenu roleLabel="PENTADBIR" items={[{label:"Dashboard pentadbir",href:"/admin/dashboard"},{label:"Pengurusan pengguna",href:"/admin/pengguna"},{label:"Pengurusan kelas",href:"/admin/kelas"},{label:"Rekod markah",href:"/admin/markah"},{label:"Analitik pencapaian",href:"/admin/analitik"},{label:"Bahan pembelajaran",href:"/admin/pembelajaran"},{label:"Pentaksiran dan kuiz",href:"/admin/kuiz"}]} /></div>
      </header>
      <section className={styles.dashboardMain}>
        <span className={styles.dashboardKicker}>PPT2026 · PAT2026</span>
        <h1 className={styles.dashboardTitle}>Kemas kini<br /><em>markah murid.</em></h1>
        <p className={styles.dashboardIntro}>Masukkan markah secara individu atau import keputusan seluruh kelas.</p>
        <ClassMarksManager classId={classId}/>
      </section>
    </main>
  );
}
