import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import styles from "../guru.module.css";
import TeacherLogoutButton from "./logout-button";

export const metadata: Metadata = {
  title: "Dashboard Guru | Ekonomi Smart SMKTM",
  description: "Ruang pengurusan guru EKONOMI SMART SMKTM."
};

const modules = [
  {
    number: "01",
    title: "Pengurusan kelas",
    description: "Urus kelas Ekonomi Tingkatan 4 dan Tingkatan 5.",
    status: "DALAM PEMBANGUNAN"
  },
  {
    number: "02",
    title: "Bahan pembelajaran",
    description: "Susun nota, video dan bahan mengikut bab.",
    status: "DALAM PEMBANGUNAN"
  },
  {
    number: "03",
    title: "Pentaksiran dan kuiz",
    description: "Sediakan latihan, kuiz dan penilaian murid.",
    status: "DALAM PEMBANGUNAN"
  }
];

export default async function TeacherDashboardPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const authUserId =
    typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;

  if (!authUserId) {
    redirect("/guru/login");
  }

  const { data: teacher, error } = await supabase
    .from("teacher_accounts")
    .select("username, display_name")
    .eq("user_id", authUserId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !teacher) {
    redirect("/guru/login?status=unauthorized");
  }

  return (
    <main className={styles.dashboardShell}>
      <header className={styles.dashboardHeader}>
        <Link className={styles.brand} href="/" aria-label="Ekonomi Smart SMKTM">
          <span className={styles.brandMark}>ES</span>
          <span className={styles.brandText}>
            <strong>EKONOMI<span>SMART</span></strong>
            <small>PORTAL GURU · SMK TAMAN MEDAN</small>
          </span>
        </Link>
        <div className={styles.dashboardActions}>
          <span className={styles.teacherBadge}>AKSES GURU</span>
          <TeacherLogoutButton />
        </div>
      </header>

      <section className={styles.dashboardMain}>
        <span className={styles.dashboardKicker}>PUSAT PENGURUSAN PEMBELAJARAN</span>
        <h1 className={styles.dashboardTitle}>
          Selamat datang,<br /><em>{teacher.display_name}</em>
        </h1>
        <p className={styles.dashboardIntro}>
          Ini ruang kerja guru EKONOMI SMART SMKTM. Modul akan diaktifkan secara berperingkat.
        </p>

        <div className={styles.accountCard}>
          <div>
            <small>AKAUN GURU AKTIF</small>
            <strong>{teacher.display_name}</strong>
          </div>
          <span>@{teacher.username}</span>
        </div>

        <div className={styles.dashboardGrid}>
          {modules.map((module) => (
            <article className={styles.moduleCard} key={module.number}>
              <span className={styles.moduleNumber}>{module.number} / MODUL</span>
              <h3>{module.title}</h3>
              <p>{module.description}</p>
              <span className={styles.coming}>{module.status}</span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
