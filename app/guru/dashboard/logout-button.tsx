"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import styles from "../guru.module.css";

export default function TeacherLogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/guru/login");
    router.refresh();
  }

  return (
    <button className={styles.logout} type="button" onClick={handleLogout} disabled={loading}>
      {loading ? "SEDANG KELUAR..." : "LOG KELUAR"}
    </button>
  );
}
