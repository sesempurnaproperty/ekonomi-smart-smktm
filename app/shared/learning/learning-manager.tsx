"use client";

import Link from "next/link";
import MobileHeaderMenu from "../navigation/mobile-header-menu";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import styles from "./learning.module.css";

type Chapter = {
  id: string;
  form_level: number;
  chapter_number: number;
  title: string;
  description: string | null;
  is_active: boolean;
};
type MaterialType = "note" | "pdf" | "video" | "link";
type Material = {
  id: string;
  chapter_id: string;
  title: string;
  description: string | null;
  material_type: MaterialType;
  content: string | null;
  resource_url: string | null;
  storage_path: string | null;
  display_order: number;
  is_published: boolean;
  created_at: string;
};
type ManagerProps = { dashboardHref: string; roleLabel: string };

const emptyMaterial = {
  chapter_id: "",
  title: "",
  description: "",
  material_type: "note" as MaterialType,
  content: "",
  resource_url: "",
  display_order: "0",
  is_published: false
};

function safeFileName(value: string) {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-90);
}

function getMobileMenuItems(roleLabel: string) {
  if (roleLabel === "PENTADBIR") return [
    {label:"Dashboard pentadbir",href:"/admin/dashboard"},
    {label:"Pengurusan pengguna",href:"/admin/pengguna"},
    {label:"Pengurusan kelas",href:"/admin/kelas"},
    {label:"Rekod markah",href:"/admin/markah"},
    {label:"Analitik pencapaian",href:"/admin/analitik"},
    {label:"Bahan pembelajaran",href:"/admin/pembelajaran"},
    {label:"Pentaksiran dan kuiz",href:"/admin/kuiz"}
  ];
  if (roleLabel === "GURU") return [
    {label:"Dashboard guru",href:"/guru/dashboard"},
    {label:"Bahan pembelajaran",href:"/guru/pembelajaran"},
    {label:"Pentaksiran dan kuiz",href:"/guru/kuiz"}
  ];
  return [
    {label:"Dashboard murid",href:"/murid/dashboard"},
    {label:"Nota dan bahan pembelajaran",href:"/murid/pembelajaran"},
    {label:"Latihan dan kuiz",href:"/murid/kuiz"}
  ];
}

export default function LearningManager({ dashboardHref, roleLabel }: ManagerProps) {
  const supabase = useMemo(() => createClient(), []);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingChapterId, setDeletingChapterId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [chapterForm, setChapterForm] = useState({ form_level: "4", chapter_number: "1", title: "", description: "" });
  const [materialForm, setMaterialForm] = useState(emptyMaterial);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [previewMaterial, setPreviewMaterial] = useState<Material | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    const [{ data: userResult, error: userError }, chapterResult, materialResult] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("learning_chapters").select("*").order("form_level").order("chapter_number"),
      supabase.from("learning_materials").select("*").order("created_at", { ascending: false })
    ]);
    if (userError || !userResult.user) {
      setError("Sesi tidak sah. Sila log masuk semula.");
      setLoading(false);
      return;
    }
    if (chapterResult.error || materialResult.error) {
      setError(chapterResult.error?.message ?? materialResult.error?.message ?? "Data bahan pembelajaran gagal dimuatkan.");
      setLoading(false);
      return;
    }
    setUserId(userResult.user.id);
    const nextChapters = (chapterResult.data ?? []) as Chapter[];
    setChapters(nextChapters);
    setMaterials((materialResult.data ?? []) as Material[]);
    setMaterialForm((current) => ({
      ...current,
      chapter_id: current.chapter_id || nextChapters.find((item) => item.is_active)?.id || ""
    }));
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void refresh(); }, [refresh]);

  const chapterMap = useMemo(() => new Map(chapters.map((chapter) => [chapter.id, chapter])), [chapters]);
  const materialCount = materials.length;
  const publishedCount = materials.filter((material) => material.is_published).length;
  const availableChapters = chapters.filter((chapter) => chapter.is_active);

  async function addChapter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const { error: insertError } = await supabase.from("learning_chapters").insert({
      form_level: Number(chapterForm.form_level),
      chapter_number: Number(chapterForm.chapter_number),
      title: chapterForm.title.trim(),
      description: chapterForm.description.trim() || null,
      created_by: userId
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message.includes("unique") ? "Nombor bab ini sudah digunakan untuk tingkatan tersebut." : insertError.message);
      return;
    }
    setNotice("Bab berjaya ditambah.");
    setChapterForm((current) => ({ ...current, title: "", description: "" }));
    await refresh();
  }

  function startEdit(material: Material) {
    setEditingId(material.id);
    setEditingPath(material.storage_path);
    setSelectedFile(null);
    setMaterialForm({
      chapter_id: material.chapter_id,
      title: material.title,
      description: material.description ?? "",
      material_type: material.material_type,
      content: material.content ?? "",
      resource_url: material.resource_url ?? "",
      display_order: String(material.display_order ?? 0),
      is_published: material.is_published
    });
    setError("");
    setNotice("Mod bahan sedang diedit. Simpan untuk mengesahkan perubahan.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetMaterialForm() {
    setEditingId(null);
    setEditingPath(null);
    setSelectedFile(null);
    setMaterialForm({ ...emptyMaterial, chapter_id: availableChapters[0]?.id ?? "" });
    setNotice("");
  }

  async function saveMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    let newStoragePath: string | null = null;
    let nextStoragePath: string | null = null;

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error("Sesi tidak sah. Sila log masuk semula.");
      if (!materialForm.chapter_id) throw new Error("Sila pilih bab terlebih dahulu.");
      if (materialForm.title.trim().length < 2) throw new Error("Tajuk bahan mesti sekurang-kurangnya dua aksara.");

      if (materialForm.material_type === "note" && !materialForm.content.trim()) {
        throw new Error("Sila masukkan kandungan nota.");
      }
      if (materialForm.material_type === "video" || materialForm.material_type === "link") {
        const url = new URL(materialForm.resource_url.trim());
        if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Pautan mesti bermula dengan https:// atau http://.");
      }
      if (materialForm.material_type === "pdf") {
        if (selectedFile) {
          if (selectedFile.type !== "application/pdf" || selectedFile.size > 20 * 1024 * 1024) {
            throw new Error("Fail mestilah PDF dan tidak melebihi 20 MB.");
          }
          const fileName = safeFileName(selectedFile.name);
          nextStoragePath = authData.user.id + "/" + crypto.randomUUID() + "-" + (fileName || "bahan.pdf");
          const { error: uploadError } = await supabase.storage
            .from("learning-materials")
            .upload(nextStoragePath, selectedFile, { contentType: "application/pdf", upsert: false });
          if (uploadError) throw new Error("Muat naik PDF gagal: " + uploadError.message);
          newStoragePath = nextStoragePath;
        } else if (editingId && editingPath) {
          nextStoragePath = editingPath;
        } else {
          throw new Error("Sila pilih fail PDF untuk dimuat naik.");
        }
      }

      const payload = {
        chapter_id: materialForm.chapter_id,
        title: materialForm.title.trim(),
        description: materialForm.description.trim() || null,
        material_type: materialForm.material_type,
        content: materialForm.material_type === "note" ? materialForm.content.trim() : null,
        resource_url: materialForm.material_type === "video" || materialForm.material_type === "link" ? materialForm.resource_url.trim() : null,
        storage_path: materialForm.material_type === "pdf" ? nextStoragePath : null,
        display_order: Number(materialForm.display_order) || 0,
        is_published: materialForm.is_published
      };

      const result = editingId
        ? await supabase.from("learning_materials").update(payload).eq("id", editingId)
        : await supabase.from("learning_materials").insert({ ...payload, created_by: authData.user.id });

      if (result.error) throw new Error(result.error.message);

      if (editingPath && editingPath !== payload.storage_path) {
        const { error: removeOldError } = await supabase.storage.from("learning-materials").remove([editingPath]);
        if (removeOldError) console.warn("Old learning PDF could not be removed:", removeOldError.message);
      }

      setNotice(editingId ? "Bahan berjaya dikemas kini." : "Bahan berjaya ditambah.");
      setEditingId(null);
      setEditingPath(null);
      setSelectedFile(null);
      setMaterialForm({ ...emptyMaterial, chapter_id: materialForm.chapter_id });
      await refresh();
    } catch (cause) {
      if (newStoragePath) {
        await supabase.storage.from("learning-materials").remove([newStoragePath]);
      }
      setError(cause instanceof Error ? cause.message : "Bahan gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleChapter(chapter: Chapter) {
    setError("");
    const { error: updateError } = await supabase.from("learning_chapters")
      .update({ is_active: !chapter.is_active }).eq("id", chapter.id);
    if (updateError) setError(updateError.message);
    else {
      setNotice(chapter.is_active ? "Bab dinyahaktifkan. Bahan sedia ada dikekalkan." : "Bab diaktifkan semula.");
      await refresh();
    }
  }

  async function deleteChapter(chapter: Chapter) {
    if (deletingChapterId) return;

    setDeletingChapterId(chapter.id);
    setError("");
    setNotice("");

    try {
      // Preserve content integrity: a chapter with materials or quizzes must be
      // cleared or reassigned before its catalogue row can be removed.
      const [materialCheck, quizCheck] = await Promise.all([
        supabase.from("learning_materials").select("id", { count: "exact", head: true }).eq("chapter_id", chapter.id),
        supabase.from("learning_quizzes").select("id", { count: "exact", head: true }).eq("chapter_id", chapter.id)
      ]);

      if (materialCheck.error) throw new Error("Bahan yang berkaitan dengan bab gagal disemak: " + materialCheck.error.message);
      if (quizCheck.error) throw new Error("Kuiz yang berkaitan dengan bab gagal disemak: " + quizCheck.error.message);

      const materialCount = materialCheck.count ?? 0;
      const quizCount = quizCheck.count ?? 0;

      if (materialCount > 0 || quizCount > 0) {
        const reasons = [
          materialCount > 0 ? materialCount + " bahan pembelajaran" : "",
          quizCount > 0 ? quizCount + " kuiz" : ""
        ].filter(Boolean).join(" dan ");
        setError(
          "Bab Tingkatan " + chapter.form_level + " · Bab " + chapter.chapter_number +
          " tidak boleh dipadam kerana masih mempunyai " + reasons +
          ". Padam atau pindahkan kandungan tersebut dahulu. Bab dan kandungannya kekal selamat."
        );
        return;
      }

      const confirmed = window.confirm(
        "Padam bab Tingkatan " + chapter.form_level + " · Bab " + chapter.chapter_number +
        ": " + chapter.title + "?\n\nTindakan ini tidak boleh dibatalkan."
      );
      if (!confirmed) return;

      const { data: deletedChapter, error: deleteError } = await supabase
        .from("learning_chapters")
        .delete()
        .eq("id", chapter.id)
        .select("id")
        .maybeSingle();

      if (deleteError) {
        const message = deleteError.message.toLowerCase();
        if (message.includes("foreign key") || message.includes("violates")) {
          throw new Error("Bab ini masih digunakan oleh bahan atau kuiz. Padam atau pindahkan kandungan berkaitan dahulu.");
        }
        throw new Error("Bab gagal dipadam: " + deleteError.message);
      }
      if (!deletedChapter) {
        throw new Error("Bab tidak dipadam. Sila pastikan akaun anda mempunyai akses pentadbir atau guru yang aktif.");
      }

      if (materialForm.chapter_id === chapter.id) {
        const nextChapterId = chapters.find((item) => item.id !== chapter.id && item.is_active)?.id ?? "";
        setMaterialForm((current) => ({ ...current, chapter_id: nextChapterId }));
      }

      setNotice("Bab Tingkatan " + chapter.form_level + " · Bab " + chapter.chapter_number + " berjaya dipadam.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Bab gagal dipadam. Sila cuba lagi.");
    } finally {
      setDeletingChapterId(null);
    }
  }

  async function togglePublished(material: Material) {
    setError("");
    const { error: updateError } = await supabase.from("learning_materials")
      .update({ is_published: !material.is_published }).eq("id", material.id);
    if (updateError) setError(updateError.message);
    else {
      setNotice(material.is_published ? "Bahan ditukar kepada draf." : "Bahan berjaya diterbitkan.");
      await refresh();
    }
  }

  async function deleteMaterial(material: Material) {
    if (!window.confirm("Padam bahan '" + material.title + "'? Tindakan ini tidak boleh dibatalkan.")) return;
    setError("");
    const { error: deleteError } = await supabase.from("learning_materials").delete().eq("id", material.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    if (material.storage_path) {
      const { error: removeError } = await supabase.storage.from("learning-materials").remove([material.storage_path]);
      if (removeError) console.warn("PDF orphaned in private storage:", removeError.message);
    }
    if (editingId === material.id) resetMaterialForm();
    setNotice("Bahan telah dipadam.");
    await refresh();
  }

  async function openMaterialPreview(material: Material) {
    setError("");
    setNotice("");

    if (material.material_type === "video" || material.material_type === "link") {
      if (!material.resource_url) {
        setError("Pautan bahan tidak tersedia.");
        return;
      }
      window.open(material.resource_url, "_blank", "noopener,noreferrer");
      return;
    }

    setPreviewMaterial(material);
    setPreviewPdfUrl(null);
    if (material.material_type === "note") return;

    if (!material.storage_path) {
      setPreviewMaterial(null);
      setError("Fail PDF tidak mempunyai laluan storan yang sah.");
      return;
    }

    setPreviewLoading(true);
    try {
      const { data, error: signedError } = await supabase.storage
        .from("learning-materials")
        .createSignedUrl(material.storage_path, 3600);
      if (signedError || !data?.signedUrl) {
        throw new Error(signedError?.message ?? "Pautan PDF gagal dijana.");
      }
      setPreviewPdfUrl(data.signedUrl);
    } catch (cause) {
      setPreviewMaterial(null);
      setError(cause instanceof Error ? "PDF gagal dibuka: " + cause.message : "PDF gagal dibuka. Sila cuba lagi.");
    } finally {
      setPreviewLoading(false);
    }
  }

  function closeMaterialPreview() {
    setPreviewMaterial(null);
    setPreviewPdfUrl(null);
    setPreviewLoading(false);
  }

  return (
    <main className={styles.pageShell}>
      <header className={styles.topBar}>
        <Link className={styles.brand} href={dashboardHref}>
          <span className={styles.brandMark}><img src="/smk-taman-medan-logo.png" alt="Logo SMK Taman Medan" /></span>
          <span><strong>EKONOMI SMART</strong><small>PERPUSTAKAAN BAHAN PEMBELAJARAN</small></span>
        </Link>
        <div className={styles.topActions}>
          <span className={styles.roleBadge}>{roleLabel}</span>
          <Link className={styles.backLink} href={dashboardHref}>Dashboard</Link>
        </div>
        <div className="mobile-header-actions"><MobileHeaderMenu roleLabel={roleLabel} items={getMobileMenuItems(roleLabel)} /></div>
      </header>

      <section className={styles.pageContent}>
        <div className={styles.hero}>
          <span className={styles.eyebrow}>PENGURUSAN KANDUNGAN</span>
          <h1>Perpustakaan bahan pembelajaran</h1>
          <p>Urus bab Ekonomi Tingkatan 4 dan Tingkatan 5. Sediakan nota, PDF, video dan pautan untuk dikongsi dengan murid.</p>
        </div>

        <div className={styles.statGrid}>
          <article><span>JUMLAH BAB</span><strong>{chapters.length}</strong></article>
          <article><span>JUMLAH BAHAN</span><strong>{materialCount}</strong></article>
          <article><span>DITERBITKAN</span><strong>{publishedCount}</strong></article>
        </div>

        {error ? <div className={styles.errorBox}>{error}</div> : null}
        {notice ? <div className={styles.noticeBox}>{notice}</div> : null}

        <div className={styles.managerGrid}>
          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div><span className={styles.eyebrow}>LANGKAH 1</span><h2>Daftar bab</h2></div>
            </div>
            <form className={styles.form} onSubmit={addChapter}>
              <label>Tingkatan
                <select value={chapterForm.form_level} onChange={(event) => setChapterForm({ ...chapterForm, form_level: event.target.value })}>
                  <option value="4">Tingkatan 4</option><option value="5">Tingkatan 5</option>
                </select>
              </label>
              <label>Nombor bab
                <input type="number" min="1" max="30" required value={chapterForm.chapter_number} onChange={(event) => setChapterForm({ ...chapterForm, chapter_number: event.target.value })} />
              </label>
              <label className={styles.fullWidth}>Nama bab
                <input required minLength={2} maxLength={160} placeholder="Contoh: Pengenalan kepada Ekonomi" value={chapterForm.title} onChange={(event) => setChapterForm({ ...chapterForm, title: event.target.value })} />
              </label>
              <label className={styles.fullWidth}>Penerangan ringkas <span>(pilihan)</span>
                <textarea rows={3} maxLength={600} placeholder="Penerangan ringkas tentang skop bab..." value={chapterForm.description} onChange={(event) => setChapterForm({ ...chapterForm, description: event.target.value })} />
              </label>
              <button className={styles.primaryButton} disabled={saving || loading}>{saving ? "Menyimpan..." : "Tambah bab"}</button>
            </form>

            <div className={styles.chapterList}>
              <h3>Senarai bab berdaftar</h3>
              {chapters.length === 0 ? <p className={styles.emptyText}>Belum ada bab. Daftarkan bab terlebih dahulu.</p> : chapters.map((chapter) => (
                <div className={styles.chapterRow} key={chapter.id}>
                  <div className={styles.chapterInfo}><strong>T{chapter.form_level} · Bab {chapter.chapter_number}: {chapter.title}</strong><small>{chapter.description || "Tiada penerangan"} · {chapter.is_active ? "Aktif" : "Tidak aktif"}</small></div>
                  <div className={styles.chapterActions}>
                    <button type="button" className={styles.smallButton} onClick={() => void toggleChapter(chapter)} disabled={Boolean(deletingChapterId)}>{chapter.is_active ? "Nyahaktif" : "Aktifkan"}</button>
                    <button type="button" className={styles.dangerButton} onClick={() => void deleteChapter(chapter)} disabled={Boolean(deletingChapterId)}>{deletingChapterId === chapter.id ? "Memadam..." : "Padam"}</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div><span className={styles.eyebrow}>LANGKAH 2</span><h2>{editingId ? "Kemaskini bahan" : "Tambah bahan"}</h2></div>
              {editingId ? <button type="button" className={styles.textButton} onClick={resetMaterialForm}>Batal edit</button> : null}
            </div>
            {availableChapters.length === 0 ? <p className={styles.emptyText}>Daftarkan sekurang-kurangnya satu bab aktif untuk mula menambah bahan.</p> : (
              <form className={styles.form} onSubmit={saveMaterial}>
                <label className={styles.fullWidth}>Bab
                  <select required value={materialForm.chapter_id} onChange={(event) => setMaterialForm({ ...materialForm, chapter_id: event.target.value })}>
                    <option value="">Pilih bab</option>
                    {availableChapters.map((chapter) => <option key={chapter.id} value={chapter.id}>Tingkatan {chapter.form_level} · Bab {chapter.chapter_number}: {chapter.title}</option>)}
                  </select>
                </label>
                <label className={styles.fullWidth}>Tajuk bahan
                  <input required minLength={2} maxLength={200} value={materialForm.title} onChange={(event) => setMaterialForm({ ...materialForm, title: event.target.value })} placeholder="Contoh: Nota ringkas konsep asas" />
                </label>
                <label className={styles.fullWidth}>Penerangan <span>(pilihan)</span>
                  <textarea rows={2} maxLength={800} value={materialForm.description} onChange={(event) => setMaterialForm({ ...materialForm, description: event.target.value })} placeholder="Terangkan kegunaan bahan ini..." />
                </label>
                <label>Jenis bahan
                  <select value={materialForm.material_type} onChange={(event) => { setMaterialForm({ ...materialForm, material_type: event.target.value as MaterialType }); setSelectedFile(null); }}>
                    <option value="note">Nota teks</option><option value="pdf">Fail PDF</option><option value="video">Video / YouTube</option><option value="link">Pautan luar</option>
                  </select>
                </label>
                <label>Susunan paparan
                  <input type="number" min="0" max="9999" value={materialForm.display_order} onChange={(event) => setMaterialForm({ ...materialForm, display_order: event.target.value })} />
                </label>

                {materialForm.material_type === "note" ? (
                  <label className={styles.fullWidth}>Kandungan nota
                    <textarea required rows={8} value={materialForm.content} onChange={(event) => setMaterialForm({ ...materialForm, content: event.target.value })} placeholder="Tulis nota atau penerangan pembelajaran di sini..." />
                  </label>
                ) : null}
                {materialForm.material_type === "pdf" ? (
                  <label className={styles.fullWidth}>Fail PDF <span>(maksimum 20 MB)</span>
                    <input type="file" accept="application/pdf,.pdf" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} />
                    {editingId && editingPath && !selectedFile ? <small>Fail PDF sedia ada dikekalkan. Pilih fail baharu untuk menggantikannya.</small> : null}
                    {selectedFile ? <small>Dipilih: {selectedFile.name}</small> : null}
                  </label>
                ) : null}
                {materialForm.material_type === "video" || materialForm.material_type === "link" ? (
                  <label className={styles.fullWidth}>{materialForm.material_type === "video" ? "Pautan video" : "URL bahan"}
                    <input required type="url" value={materialForm.resource_url} onChange={(event) => setMaterialForm({ ...materialForm, resource_url: event.target.value })} placeholder="https://..." />
                  </label>
                ) : null}

                <label className={styles.publishOption}>
                  <input type="checkbox" checked={materialForm.is_published} onChange={(event) => setMaterialForm({ ...materialForm, is_published: event.target.checked })} />
                  Terbitkan terus kepada murid selepas disimpan
                </label>
                <button className={styles.primaryButton} disabled={saving || loading}>{saving ? "Menyimpan..." : editingId ? "Simpan perubahan" : "Simpan bahan"}</button>
              </form>
            )}
          </section>
        </div>

        <section className={styles.materialPanel}>
          <div className={styles.panelHeading}>
            <div><span className={styles.eyebrow}>KANDUNGAN SEDIA ADA</span><h2>Semua bahan pembelajaran</h2></div>
            <button type="button" className={styles.textButton} onClick={() => void refresh()} disabled={loading}>{loading ? "Memuatkan..." : "Muat semula"}</button>
          </div>
          {loading ? <p className={styles.emptyText}>Sedang memuatkan kandungan...</p> : materials.length === 0 ? <p className={styles.emptyText}>Belum ada bahan. Tambahkan bahan pertama menggunakan borang di atas.</p> : (
            <div className={styles.materialList}>
              {materials.map((material) => {
                const chapter = chapterMap.get(material.chapter_id);
                return (
                  <article className={styles.materialRow} key={material.id}>
                    <div className={styles.materialInfo}>
                      <div className={styles.materialMeta}>
                        <span>{material.material_type.toUpperCase()}</span>
                        <span className={material.is_published ? styles.publishedTag : styles.draftTag}>{material.is_published ? "DITERBITKAN" : "DRAF"}</span>
                      </div>
                      <h3>{material.title}</h3>
                      <p>{chapter ? "Tingkatan " + chapter.form_level + " · Bab " + chapter.chapter_number + ": " + chapter.title : "Bab tidak ditemui"}</p>
                      {material.description ? <small>{material.description}</small> : null}
                    </div>
                    <div className={styles.materialActions}>
                      <button type="button" className={styles.smallButton} onClick={() => void openMaterialPreview(material)}>Semak</button>
                      <button type="button" className={styles.smallButton} onClick={() => startEdit(material)}>Edit</button>
                      <button type="button" className={styles.smallButton} onClick={() => void togglePublished(material)}>{material.is_published ? "Jadikan draf" : "Terbitkan"}</button>
                      <button type="button" className={styles.dangerButton} onClick={() => void deleteMaterial(material)}>Padam</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>

      {previewMaterial ? (
        <div className={styles.previewOverlay}>
          <section className={styles.previewDialog} role="dialog" aria-modal="true" aria-labelledby="learning-preview-title">
            <header className={styles.previewHeader}>
              <div>
                <span className={styles.eyebrow}>{previewMaterial.material_type === "note" ? "SEMAKAN NOTA" : "SEMAKAN PDF"} · {previewMaterial.is_published ? "DITERBITKAN" : "DRAF"}</span>
                <h2 id="learning-preview-title">{previewMaterial.title}</h2>
                {previewMaterial.description ? <p>{previewMaterial.description}</p> : null}
              </div>
              <button type="button" className={styles.smallButton} onClick={closeMaterialPreview}>Tutup</button>
            </header>
            <div className={styles.previewBody}>
              {previewMaterial.material_type === "note" ? (
                <div className={styles.previewNote}>{previewMaterial.content || "Tiada kandungan nota."}</div>
              ) : previewLoading ? (
                <div className={styles.emptyState}>Sedang menyediakan pratonton PDF...</div>
              ) : previewPdfUrl ? (
                <iframe className={styles.previewFrame} src={previewPdfUrl} title={"Pratonton PDF: " + previewMaterial.title} />
              ) : (
                <div className={styles.emptyState}>Pratonton PDF tidak tersedia.</div>
              )}
            </div>
            {previewMaterial.material_type === "pdf" && previewPdfUrl ? (
              <div className={styles.previewFooter}>
                <a className={styles.primaryLink} href={previewPdfUrl} target="_blank" rel="noreferrer">Buka PDF dalam tab baharu ↗</a>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </main>
  );
}
