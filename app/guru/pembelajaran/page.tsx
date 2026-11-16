import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "../../../lib/auth/get-current-profile";
import LearningManager from "../../shared/learning/learning-manager";

export const metadata: Metadata = {
  title: "Bahan Pembelajaran | Ekonomi Smart SMKTM",
  description: "Pengurusan bab, nota, PDF dan pautan pembelajaran Ekonomi."
};

export default async function TeacherLearningPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "teacher") redirect(profile.role === "admin" ? "/admin/pembelajaran" : "/murid/pembelajaran");
  return <LearningManager dashboardHref="/guru/dashboard" roleLabel="GURU" />;
}
