"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import styles from "./learning.module.css";

type Chapter = {
  id: string;
  form_level: number;
  chapter_number: number;
  title: string;
  description: string | null;
};
type Material = {
  id: string;
  chapter_id: string;
  title: string;
  description: string | null;
  material_type: "note" | "pdf" | "video" | "link";
  content: string | null;
  resource_url: string | null;
  storage_path: string | null;
  display_order: number;
  created_at: string;
};
type StudentLibraryProps = { formLevel: number | null; className: string | null };

export default function StudentLearningLibrary({ formLevel, className }: StudentLibraryProps) {
  const supabase = useMemo(() => createClient(), []);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedChapter, setSelectedChapter] = useState("all");
  const [expandedNotes, setExpandedNotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (formLevel !== 4 && formLevel !== 5) {
      setError("Akaun anda belum dipautkan kepada Tingkatan 4 atau Tingkatan 5. Sila hubungi guru.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const [chapterResult, materialResult] = await Promise.all([
      supabase.from("learning_chapters").select("id,form_level,chapter_number,title,description")
        .eq("is_active", true).order("form_level").order("chapter_number"),
      supabase.from("learning_materials").select("id,chapter_id,title,description,material_type,content,resource_url,storage_path,display_order,created_at")
        .eq("is_published", true).order("display_order").order("created_at", { ascending: false })
    ]);
    if (chapterResult.error || materialResult.error) {
      setError(chapterResult.error?.message ?? materialResult.error?.message ?? "Bahan pembelajaran gagal dimuatkan.");
      setLoading(false);
      return;
    }
    const nextChapters = (chapterResult.data ?? []) as Chapter[];
    setChapters(nextChapters);
    setMaterials((materialResult.data ?? []) as Material[]);
    setSelectedChapter((current) => current === "all" || nextChapters.some((chapter) => chapter.id === current) ? current : "all");
    setLoading(false);
  }, [formLevel, supabase]);

  useEffect(() => { void refresh(); }, [refresh]);

  const chapterMap = useMemo(() => new Map(chapters.map((chapter) => [chapter.id, chapter])), [chapters]);
  const visibleMaterials = materials.filter((material) => (
    (selectedChapter === "all" || material.chapter_id === selectedChapter) && chapterMap.has(material.chapter_id)
  ));
  const chapterCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const material of materials) counts.set(material.chapter_id, (counts.get(material.chapter_id) ?? 0) + 1);
    return counts;
  }, [materials]);

  async function openPdf(material: Material) {
    if (!material.storage_path) return;
    const popup = window.open("about:blank", "_blank");
    if (!popup) {
      setError("Pelayar menyekat tetingkap baharu. Benarkan pop-up untuk membuka PDF.");
      return;
    }
    popup.opener = null;
    setOpeningId(material.id);
    setError("");
    const { data, error: signedError } = await supabase.storage
      .from("learning-materials").createSignedUrl(material.storage_path, 3600);
    if (signedError || !data?.signedUrl) {
      popup.close();
      setError(signedError?.message ?? "Pautan PDF gagal dijana. Sila cuba lagi.");
    } else {
      popup.location.href = data.signedUrl;
    }
    setOpeningId("");
  }

  function toggleNote(id: string) {
    setExpandedNotes((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <main className={styles.pageShell}>
      <header className={styles.topBar}>
        <Link className={styles.brand} href="/murid/dashboard">
          <span className={styles.brandMark}>ES</span>
          <span><strong>EKONOMI SMART</strong><small>PERPUSTAKAAN BAHAN PEMBELAJARAN</small></span>
        </Link>
        <div className={styles.topActions}>
          <span className={styles.roleBadge}>AKSES TINGKATAN 4 &amp; 5</span>
          <Link className={styles.backLink} href="/murid/dashboard">Dashboard</Link>
        </div>
      </header>

      <section className={styles.pageContent}>
        <div className={styles.hero}>
          <span className={styles.eyebrow}>RUANG PEMBELAJARAN MURID</span>
          <h1>Bahan pembelajaran Ekonomi</h1>
          <p>{formLevel ? "Tingkatan " + formLevel : "Akaun murid"}{className ? " · " + className : ""} — anda boleh mengakses semua nota, PDF, video dan pautan yang telah diterbitkan untuk Tingkatan 4 dan Tingkatan 5.</p>
        </div>

        <div className={styles.studentToolbar}>
          <label>Tapisan bab
            <select value={selectedChapter} onChange={(event) => setSelectedChapter(event.target.value)}>
              <option value="all">Semua bab</option>
              {chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>Tingkatan {chapter.form_level} · Bab {chapter.chapter_number}: {chapter.title}</option>)}
            </select>
          </label>
          <button type="button" className={styles.secondaryButton} onClick={() => void refresh()} disabled={loading}>{loading ? "Memuatkan..." : "Muat semula bahan"}</button>
        </div>

        {error ? <div className={styles.errorBox}>{error}</div> : null}
        {loading ? <div className={styles.emptyState}>Sedang mendapatkan bahan pembelajaran untuk akaun anda...</div> : null}
        {!loading && !error && chapters.length === 0 ? <div className={styles.emptyState}>Belum ada bab pembelajaran yang diterbitkan. Sila semak semula selepas guru menambah kandungan.</div> : null}
        {!loading && !error && chapters.length > 0 && visibleMaterials.length === 0 ? <div className={styles.emptyState}>Tiada bahan diterbitkan bagi pilihan ini. Pilih bab lain atau semak semula kemudian.</div> : null}

        {!loading && visibleMaterials.length > 0 ? (
          <div className={styles.studentMaterialGrid}>
            {visibleMaterials.map((material) => {
              const chapter = chapterMap.get(material.chapter_id);
              const expanded = expandedNotes.includes(material.id);
              return (
                <article className={styles.studentMaterialCard} key={material.id}>
                  <div className={styles.materialMeta}><span>{material.material_type === "note" ? "NOTA" : material.material_type === "pdf" ? "PDF" : material.material_type === "video" ? "VIDEO" : "PAUTAN LUAR"}</span>
                    <span>TINGKATAN {chapter?.form_level ?? "—"} · BAB {chapter?.chapter_number ?? "—"}</span></div>
                  <h2>{material.title}</h2>
                  {material.description ? <p>{material.description}</p> : null}
                  <small className={styles.chapterLabel}>{chapter ? "Tingkatan " + chapter.form_level + " · Bab " + chapter.chapter_number + ": " + chapter.title : ""}</small>
                  {material.material_type === "note" ? (
                    <div className={styles.noteContent}>
                      {expanded ? <div className={styles.noteText}>{material.content}</div> : null}
                      <button className={styles.secondaryButton} type="button" onClick={() => toggleNote(material.id)}>{expanded ? "Tutup nota" : "Baca nota"}</button>
                    </div>
                  ) : material.material_type === "pdf" ? (
                    <button className={styles.primaryButton} type="button" disabled={openingId === material.id} onClick={() => void openPdf(material)}>{openingId === material.id ? "Menyediakan PDF..." : "Buka / muat turun PDF"}</button>
                  ) : (
                    <a className={styles.primaryLink} href={material.resource_url ?? "#"} target="_blank" rel="noreferrer">{material.material_type === "video" ? "Tonton video" : "Buka bahan"} ↗</a>
                  )}
                </article>
              );
            })}
          </div>
        ) : null}

        <p className={styles.privacyNote}>Semua murid Tingkatan 4 dan Tingkatan 5 boleh mengakses bahan yang telah diterbitkan untuk kedua-dua tingkatan. Bahan draf dan bab tidak aktif kekal tersembunyi.</p>
      </section>
    </main>
  );
}
