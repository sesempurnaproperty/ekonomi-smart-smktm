import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "../../../lib/auth/get-current-profile";
import styles from "../../guru/guru.module.css";
import pageStyles from "./users.module.css";
import TeacherLogoutButton from "../../guru/dashboard/logout-button";
import MobileHeaderMenu from "../../shared/navigation/mobile-header-menu";
import UserManagement from "./user-management";

export const metadata: Metadata = {
  title: "Pengurusan Pengguna | Ekonomi Smart SMKTM",
  description: "Pengurusan akaun pentadbir, guru dan murid EKONOMI SMART SMKTM."
};

export default async function UserManagementPage() {
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
            <small>PENGURUSAN SISTEM · SMK TAMAN MEDAN</small>
          </span>
        </Link>
        <div className={styles.dashboardActions}>
          <Link className={pageStyles.backButton} href="/admin/dashboard">← DASHBOARD</Link>
          <span className={styles.teacherBadge}>PENTADBIR</span>
          <TeacherLogoutButton />
        </div>
      <div className="mobile-header-actions"><MobileHeaderMenu roleLabel="PENTADBIR" items={[{label:"Dashboard pentadbir",href:"/admin/dashboard"},{label:"Pengurusan pengguna",href:"/admin/pengguna"},{label:"Pengurusan kelas",href:"/admin/kelas"},{label:"Rekod markah",href:"/admin/markah"},{label:"Analitik pencapaian",href:"/admin/analitik"},{label:"Bahan pembelajaran",href:"/admin/pembelajaran"},{label:"Pentaksiran dan kuiz",href:"/admin/kuiz"}]} /></div>
      </header>

      <section className={styles.dashboardMain}>
        <span className={styles.dashboardKicker}>KAWALAN AKSES PENGGUNA</span>
        <h1 className={styles.dashboardTitle}>Pengurusan<br /><em>pengguna.</em></h1>
        <p className={styles.dashboardIntro}>
          Cipta akaun, tetapkan peranan dan urus status akses guru serta murid EKONOMI SMART SMKTM.
        </p>
        <UserManagement />
      </section>
    </main>
  );
}
