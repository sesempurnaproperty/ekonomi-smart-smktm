import { createClient } from "../supabase/server";

export type PortalRole = "admin" | "teacher" | "student";

export type CurrentProfile = {
  user_id: string;
  username: string;
  full_name: string;
  role: PortalRole;
  form_level: number | null;
  class_name: string | null;
  is_active: boolean;
};

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims) {
    return null;
  }

  const userId =
    typeof claimsData.claims.sub === "string" ? claimsData.claims.sub : null;

  if (!userId) {
    return null;
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("user_id, username, full_name, role, form_level, class_name, is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  if (!["admin", "teacher", "student"].includes(data.role)) {
    return null;
  }

  return data as CurrentProfile;
}
