import { redirect } from "next/navigation";

// Backward compatibility: the former teacher-only login now uses the shared portal.
export default function LegacyTeacherLoginRedirect() {
  redirect("/login");
}
