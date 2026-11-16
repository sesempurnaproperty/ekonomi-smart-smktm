import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "../../../lib/auth/get-current-profile";
import StudentLearningLibrary from "../../shared/learning/student-library";

export const metadata: Metadata = {
  title: "Bahan Pembelajaran | Ekonomi Smart SMKTM",
  description: "Nota, PDF, video dan pautan pembelajaran Ekonomi untuk murid."
};

export default async function StudentLearningPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "student") redirect(profile.role === "admin" ? "/admin/pembelajaran" : "/guru/pembelajaran");
  return <StudentLearningLibrary formLevel={profile.form_level} className={profile.class_name} />;
}
