import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "../../../lib/auth/get-current-profile";
import styles from "../../guru/guru.module.css";
import TeacherLogoutButton from "../../guru/dashboard/logout-button";

export const metadata: Metadata = {
  title: "Dashboard Pentadbir | Ekonomi Smart SMKTM",
  description: "Pusat kawalan pentadbir EKONOMI SMART SMKTM."
};

const adminModules = [
  {
    number: "01",
    title: "Pengurusan pengguna",
    description: "Daftar guru, tetapkan peranan dan import akaun murid secara pukal.",
    status: "MODUL SETERUSNYA"
  },
  {
    number: "02",
    title: "Pengurusan kelas",
    description: "Lihat kad kelas dan senarai murid mengikut Tingkatan 4 dan Tingkatan 5.",
    status: "BUKA DIREKTORI KELAS"
  },
  {
    number: "03",
    title: "Rekod markah murid",
    description: "Kemas kini keputusan PPT2026 dan PAT2026 bagi setiap murid.",
    status: "BUKA REKOD MARKAH"
  },
  {
    number: "04",
    title: "Pengurusan pembelajaran",
    description: "Urus kandungan Ekonomi Tingkatan 4 dan Tingkatan 5.",
    status: "DALAM PEMBANGUNAN"
  },
  {
    number: "05",
    title: "Pentaksiran dan kuiz",
    description: "Sediakan latihan, kuiz dan penilaian murid.",
    status: "DALAM PEMBANGUNAN"
  }
];

export default async function AdminDashboardPage() {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login");
  if (profile.role !== "admin") {
    redirect(profile.role === "teacher" ? "/guru/dashboard" : "/murid/dashboard");
  }

  return (
    <main className={styles.dashboardShell}>
      <header className={styles.dashboardHeader}>
        <Link className={styles.brand} href="/" aria-label="Ekonomi Smart SMKTM">
          <span className={styles.brandMark}>ES</span>
          <span className={styles.brandText}>
            <strong>EKONOMI<span>SMART</span></strong>
            <small>PORTAL PENTADBIR · SMK TAMAN MEDAN</small>
          </span>
        </Link>
        <div className={styles.dashboardActions}>
          <span className={styles.teacherBadge}>PENTADBIR</span>
          <TeacherLogoutButton />
        </div>
      </header>

      <section className={styles.dashboardMain}>
        <span className={styles.dashboardKicker}>PUSAT KAWALAN SISTEM</span>
        <h1 className={styles.dashboardTitle}>
          Selamat datang,<br /><em>{profile.full_name}</em>
        </h1>
        <p className={styles.dashboardIntro}>
          Urus akaun, pembelajaran dan operasi EKONOMI SMART SMKTM dari satu ruang.
        </p>

        <div className={styles.accountCard}>
          <div>
            <small>AKAUN PENTADBIR AKTIF</small>
            <strong>{profile.full_name}</strong>
          </div>
          <span>@{profile.username}</span>
        </div>

        <div className={styles.dashboardGrid}>
          {adminModules.map((module) => (
            ["01", "02", "03"].includes(module.number) ? (
              <Link
                className={styles.moduleCard}
                href={module.number === "01" ? "/admin/pengguna" : module.number === "02" ? "/admin/kelas" : "/admin/markah"}
                key={module.number}
              >
                <span className={styles.moduleNumber}>{module.number} / MODUL</span>
                <h3>{module.title}</h3>
                <p>{module.description}</p>
                <span className={styles.coming}>{module.number === "01" ? "BUKA MODUL →" : module.number === "02" ? "BUKA DIREKTORI KELAS →" : "BUKA REKOD MARKAH →"}</span>
              </Link>
            ) : (
              <article className={styles.moduleCard} key={module.number}>
                <span className={styles.moduleNumber}>{module.number} / MODUL</span>
                <h3>{module.title}</h3>
                <p>{module.description}</p>
                <span className={styles.coming}>{module.status}</span>
              </article>
            )
          ))}
        </div>
      </section>
    </main>
  );
}
