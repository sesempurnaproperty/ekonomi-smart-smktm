import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "../../../lib/auth/get-current-profile";
import styles from "../../guru/guru.module.css";
import TeacherLogoutButton from "../../guru/dashboard/logout-button";

export const metadata: Metadata = {
  title: "Dashboard Murid | Ekonomi Smart SMKTM",
  description: "Ruang pembelajaran murid EKONOMI SMART SMKTM."
};

export default async function StudentDashboardPage() {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login");
  if (profile.role !== "student") {
    redirect(profile.role === "admin" ? "/admin/dashboard" : "/guru/dashboard");
  }

  return (
    <main className={styles.dashboardShell}>
      <header className={styles.dashboardHeader}>
        <Link className={styles.brand} href="/" aria-label="Ekonomi Smart SMKTM">
          <span className={styles.brandMark}>ES</span>
          <span className={styles.brandText}>
            <strong>EKONOMI<span>SMART</span></strong>
            <small>RUANG PEMBELAJARAN MURID</small>
          </span>
        </Link>
        <div className={styles.dashboardActions}>
          <span className={styles.teacherBadge}>MURID</span>
          <TeacherLogoutButton />
        </div>
      </header>

      <section className={styles.dashboardMain}>
        <span className={styles.dashboardKicker}>RUANG PEMBELAJARAN ANDA</span>
        <h1 className={styles.dashboardTitle}>Selamat datang,<br /><em>{profile.full_name}</em></h1>
        <p className={styles.dashboardIntro}>
          {profile.form_level ? `Tingkatan ${profile.form_level}` : "Pembelajaran Ekonomi"} 
          {profile.class_name ? ` · ${profile.class_name}` : ""} 
          {" "}— ruang pembelajaran anda sedang disediakan.
        </p>

        <div className={styles.dashboardGrid}>
          {[
            ["01", "Nota pembelajaran", "Nota Ekonomi mengikut bab."],
            ["02", "Video dan penerangan", "Kandungan visual untuk membantu kefahaman."],
            ["03", "Latihan dan kuiz", "Uji kefahaman dan semak pencapaian."]
          ].map(([number, title, description]) => (
            <article className={styles.moduleCard} key={number}>
              <span className={styles.moduleNumber}>{number} / PEMBELAJARAN</span>
              <h3>{title}</h3>
              <p>{description}</p>
              <span className={styles.coming}>AKAN DATANG</span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
