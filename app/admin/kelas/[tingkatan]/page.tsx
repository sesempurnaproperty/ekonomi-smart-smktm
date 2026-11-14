import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentProfile } from "../../../../lib/auth/get-current-profile";
import styles from "../../../guru/guru.module.css";
import classStyles from "../kelas.module.css";
import TeacherLogoutButton from "../../../guru/dashboard/logout-button";
import ClassRoster from "./class-roster";

export const metadata: Metadata = {
  title: "Senarai Murid Kelas | Ekonomi Smart SMKTM"
};

export default async function ClassDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ tingkatan: string }>;
  searchParams: Promise<{ kelas?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") {
    redirect(profile.role === "teacher" ? "/guru/dashboard" : "/murid/dashboard");
  }

  const [{ tingkatan }, query] = await Promise.all([params, searchParams]);
  const formLevel = Number(tingkatan);
  const className = typeof query.kelas === "string" ? query.kelas.trim() : "";

  if (![4, 5].includes(formLevel) || !className || className.length > 60) notFound();

  return (
    <main className={styles.dashboardShell}>
      <header className={styles.dashboardHeader}>
        <Link className={styles.brand} href="/" aria-label="Ekonomi Smart SMKTM">
          <span className={styles.brandMark}>ES</span>
          <span className={styles.brandText}>
            <strong>EKONOMI<span>SMART</span></strong>
            <small>SENARAI MURID · SMK TAMAN MEDAN</small>
          </span>
        </Link>
        <div className={styles.dashboardActions}>
          <Link className={classStyles.classBack} href="/admin/kelas">← SEMUA KELAS</Link>
          <span className={styles.teacherBadge}>PENTADBIR</span>
          <TeacherLogoutButton />
        </div>
      </header>

      <section className={styles.dashboardMain}>
        <span className={styles.dashboardKicker}>DIREKTORI KELAS · TINGKATAN {formLevel}</span>
        <h1 className={styles.dashboardTitle}>Kelas <em>{className}.</em></h1>
        <p className={styles.dashboardIntro}>
          Senarai murid, username dan status akaun bagi kelas ini.
        </p>
        <ClassRoster formLevel={formLevel} className={className} />
      </section>
    </main>
  );
}
