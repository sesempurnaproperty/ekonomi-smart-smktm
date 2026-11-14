const courses = [
  { level: "TINGKATAN 4", title: "Asas Pemikiran Ekonomi", detail: "Bina kefahaman tentang konsep, pilihan dan keputusan ekonomi dalam kehidupan seharian.", label: "ASAS PEMBELAJARAN", color: "mint", number: "04" },
  { level: "TINGKATAN 5", title: "Ekonomi Dalam Dunia Sebenar", detail: "Teroka isu ekonomi, analisis maklumat dan persediaan menghadapi SPM.", label: "PERSEDIAAN SPM", color: "gold", number: "05" }
];
const modules = [
  ["01", "Nota pembelajaran", "Nota tersusun mengikut bab", "▤"],
  ["02", "Video & penerangan", "Belajar melalui kandungan visual", "▷"],
  ["03", "Latihan kendiri", "Uji kefahaman selepas belajar", "✎"],
  ["04", "Kuiz interaktif", "Semak pemahaman secara pantas", "◎"]
];
function Arrow() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M10 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
export default function Home() {
  return (
    <main>
      <div className="announcement"><i /> RUANG PEMBELAJARAN DIGITAL EKONOMI · SMK TAMAN MEDAN <span>TINGKATAN 4 &amp; 5</span></div>
      <header className="header">
        <a className="brand" href="#utama"><b className="mark">ES</b><span><strong>EKONOMI<span>SMART</span></strong><small>SMK TAMAN MEDAN</small></span></a>
        <nav><a className="selected" href="#utama">Utama</a><a href="#pembelajaran">Pembelajaran</a><a href="#modul">Akses pantas</a><a href="#tentang">Tentang</a></na¶»§q«^