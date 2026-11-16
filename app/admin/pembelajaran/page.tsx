import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "../../../lib/auth/get-current-profile";
import LearningManager from "../../shared/learning/learning-manager";

export const metadata: Metadata = {
  title: "Pengurusan Pembelajaran | Ekonomi Smart SMKTM",
  description: "Pengurusan bab, nota, PDF dan pautan pembelajaran Ekonomi."
};

export default async function AdminLearningPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect(profile.role === "teacher" ? "/guru/pembelajaran" : "/murid/pembelajaran");
  return <LearningManager dashboardHref="/admin/dashboard" roleLabel="PENTADBIR" />;
}
