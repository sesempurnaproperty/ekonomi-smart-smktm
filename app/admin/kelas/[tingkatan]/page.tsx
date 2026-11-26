import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentProfile } from "../../../../lib/auth/get-current-profile";
import styles from "../../../guru/guru.module.css";
import classStyles from "../kelas.module.css";
import TeacherLogoutButton from "../../../guru/dashboard/logout-button";
import MobileHeaderMenu from "../../../shared/navigation/mobile-header-menu";
import ClassRoster from "./class-roster";

export const metadata: Metadata = {
  title: "Senarai Murid Kelas | Ekonomi Smart SMKTM"
};

export default async function ClassDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ tingkatan: string }>;
  searchParams: Promise<{ kelas?: string; class_id?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") {
    redirect(profile.role === "teacher" ? "/guru/dashboard" : "/murid/dashboard");
  }

  const [{ tingkatan }, query] = await Promise.all([params, searchParams]);
  const formLevel = Number(tingkatan);
  const className = typeof query.kelas === "string" ? query.kelas.trim() : "";
  const classId = typeof query.class_id === "string" ? query.class_id : "";

  if (![4, 5].includes(formLevel) || !className || className.length > 60 || !classId) notFound();

  return (
    <main className={styles.dashboardShell}>
      <header className={styles.dashboardHeader}>
        <Link className={styles.brand} href="/" aria-label="Ekonomi Smart SMKTM">
          <span className={styles.brandMark}><img src="/smk-taman-medan-logo.png" alt="Logo SMK Taman Medan" /></span>
          <span className={styles.brandText}>
            <strong>EKONOMI<span>SMART</span></strong>
            <small>PENGURUSAN KELAS · SMK TAMAN MEDAN</small>
          </span>
        </Link>
        <div className={styles.dashboardActions}>
          <Link className={classStyles.classBack} href="/admin/kelas">← SEMUA KELAS</Link>
          <span className={styles.teacherBadge}>PENTADBIR</span>
          <TeacherLogoutButton />
        </div>
      <div className="mobile-header-actions"><MobileHeaderMenu roleLabel="PENTADBIR" items={[{label:"Dashboard pentadbir",href:"/admin/dashboard"},{label:"Pengurusan pengguna",href:"/admin/pengguna"},{label:"Pengurusan kelas",href:"/admin/kelas"},{label:"Rekod markah",href:"/admin/markah"},{label:"Analitik pencapaian",href:"/admin/analitik"},{label:"Bahan pembelajaran",href:"/admin/pembelajaran"},{label:"Pentaksiran dan kuiz",href:"/admin/kuiz"}]} /></div>
      </header>

      <section className={styles.dashboardMain}>
        <span className={styles.dashboardKicker}>DIREKTORI KELAS · TINGKATAN {formLevel}</span>
        <h1 className={styles.dashboardTitle}>Kelas <em>{className}.</em></h1>
        <p className={styles.dashboardIntro}>Urus nama kelas, pindahkan murid, cetak atau eksport senarai kelas.</p>
        <ClassRoster classId={classId} formLevel={formLevel} className={className}/>
      </section>
    </main>
  );
}
