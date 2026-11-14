const learningPaths = [
  {
    level: "TINGKATAN 4",
    title: "Asas Pemikiran Ekonomi",
    description:
      "Fahami konsep asas, pilihan, kos lepas dan cara membuat keputusan ekonomi dalam kehidupan.",
    label: "ASAS PEMBELAJARAN",
    number: "04",
    tone: "mint"
  },
  {
    level: "TINGKATAN 5",
    title: "Ekonomi Dalam Dunia Sebenar",
    description:
      "Teroka isu ekonomi, fahami dasar dan bina kemahiran analisis untuk persediaan SPM.",
    label: "PERSIAPAN SPM",
    number: "05",
    tone: "gold"
  }
] as const;

const learningModules = [
  { number: "01", title: "Nota pembelajaran", description: "Nota ringkas mengikut bab", symbol: "▤" },
  { number: "02", title: "Video dan penerangan", description: "Konsep melalui kandungan visual", symbol: "▷" },
  { number: "03", title: "Latihan kendiri", description: "Uji kefahaman selepas belajar", symbol: "✎" },
  { number: "04", title: "Kuiz interaktif", description: "Semak pemahaman secara pantas", symbol: "◎" }
];

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M4 10h11M10 5l5 5-5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GrowthChart() {
  return (
    <div className="chart-card" aria-label="Ilustrasi graf pertumbuhan">
      <div className="chart-heading">
        <span>IDEA <b>TO</b> NILAI</span>
        <span className="chart-status">LEARN AND GROW</span>
      </div>
      <div className="chart-plot">
        <div className="chart-axis">
          <span>100</span>
          <span>75</span>
          <span>50</span>
          <span>25</span>
        </div>
        <svg viewBox="0 0 420 190" preserveAspectRatio="none" role="img" aria-label="Graf garis menaik">
          <defs>
            <linearGradient id="growthFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#8de4bc" stopOpacity=".3" />
              <stop offset="100%" stopColor="#8de4bc" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0 155 C36 148 45 125 78 133 S125 115 150 123 S190 83 220 100 S260 67 290 79 S330 38 354 52 S390 18 420 8 L420 190 L0 190Z"
            fill="url(#growthFill)"
          />
          <path
            d="M0 155 C36 148 45 125 78 133 S125 115 150 123 S190 83 220 100 S260 67 290 79 S330 38 354 52 S390 18 420 8"
            fill="none"
            stroke="#8de4bc"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="354" cy="52" r="5" fill="#e7bd69" stroke="#153b40" strokeWidth="3" />
        </svg>
      </div>
      <div className="chart-footer">
        <span>KEFAHAMAN</span>
        <strong>BERKEMBANG SETIAP HARI</strong>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main>
      <div className="topline">
        <span className="status-dot" />
        RUANG PEMBELAJARAN DIGITAL EKONOMI · SMK TAMAN MEDAN
        <span className="topline-right">TINGKATAN 4 DAN 5</span>
      </div>

      <header className="site-header">
        <a className="brand" href="#utama" aria-label="Ekonomi Smart SMKTM">
          <span className="brand-mark">ES</span>
          <span className="brand-text">
            <strong>EKONOMI<span>SMART</span></strong>
            <small>SMK TAMAN MEDAN</small>
          </span>
        </a>
        <nav className="navigation" aria-label="Navigasi utama">
          <a className="nav-active" href="#utama">Utama</a>
          <a href="#pembelajaran">Pembelajaran</a>
          <a href="#modul">Akses pantas</a>
          <a href="#tentang">Tentang</a>
        </nav>
        <a className="student-link" href="/login">Log masuk portal <span>↗</span></a>
        <a className="mobile-nav" href="#modul" aria-label="Pergi ke modul">☰</a>
      </header>

      <section className="hero" id="utama">
        <div className="hero-grid" />
        <div className="hero-copy">
          <div className="eyebrow"><span /> ILMU EKONOMI, PELUANG TANPA HAD</div>
          <h1>Fahami ekonomi.<br /><em>Fahami dunia.</em></h1>
          <p>
            Satu ruang untuk belajar, meneroka dan menguasai Ekonomi.
            Mulakan perjalanan pembelajaran anda di sini.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#pembelajaran">Mula belajar <ArrowIcon /></a>
            <a className="text-button" href="#tentang">Kenali platform <span>↓</span></a>
          </div>
          <div className="hero-note">
            <span className="mini-bars"><i /><i /><i /><i /></span>
            Dibina untuk pembelajaran yang lebih terarah
          </div>
        </div>

        <div className="hero-visual">
          <div className="visual-label"><span className="status-dot" /> ECONOMY / LEARNING</div>
          <div className="visual-orbit orbit-one" />
          <div className="visual-orbit orbit-two" />
          <GrowthChart />
          <div className="floating-card float-top">
            <span className="floating-icon">↗</span>
            <span><strong>Fikir secara kritis</strong><small>Analisis · Fahami · Aplikasi</small></span>
          </div>
          <div className="floating-card float-bottom">
            <span className="coin-icon">RM</span>
            <span><strong>Ekonomi sekeliling kita</strong><small>Ilmu dekat dengan kehidupan</small></span>
          </div>
          <div className="visual-index">01 <i>/</i> 02</div>
        </div>

        <div className="hero-baseline">
          <span>01 — PEMBELAJARAN</span>
          <span>ILMU HARI INI, PILIHAN ESOK</span>
          <span>SMKTM · SELANGOR</span>
        </div>
      </section>

      <section className="welcome-strip" id="tentang">
        <div className="welcome-symbol">✳</div>
        <div className="welcome-copy">
          <span>SELAMAT DATANG KE EKONOMI SMART</span>
          <p>
            Belajar mengikut rentak anda. Teroka kandungan, fahami konsep
            dan bina keyakinan langkah demi langkah.
          </p>
        </div>
        <div className="welcome-motto">LEARN WITH<br /><strong>PURPOSE.</strong></div>
      </section>

      <section className="learning-section" id="pembelajaran">
        <div className="section-heading">
          <div>
            <span className="section-kicker">PILIH LALUAN PEMBELAJARAN</span>
            <h2>Dua tingkatan.<br /><em>Satu matlamat.</em></h2>
          </div>
          <p>Mulakan dengan tingkatan anda dan teruskan pembelajaran secara tersusun.</p>
        </div>
        <div className="course-grid">
          {learningPaths.map((course) => (
            <a className={"course-card " + course.tone} href="#modul" key={course.level}>
              <div className="course-meta">
                <span>{course.level}</span>
                <small>{course.label}</small>
              </div>
              <div className="course-number">{course.number}</div>
              <div className="course-bottom">
                <div>
                  <h3>{course.title}</h3>
                  <p>{course.description}</p>
                </div>
                <span className="round-arrow"><ArrowIcon /></span>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section className="modules-section" id="modul">
        <div className="modules-intro">
          <span className="section-kicker">SEGALANYA DI SATU TEMPAT</span>
          <h2>Belajar dengan<br /><em>cara yang lebih bijak.</em></h2>
          <p>
            Modul pembelajaran akan diaktifkan secara berperingkat.
            Ruang ini menjadi pusat akses untuk bahan dan aktiviti anda.
          </p>
          <div className="coming-note"><i /> MODUL AKAN DIBUKA SECARA BERPERINGKAT</div>
        </div>
        <div className="module-list">
          {learningModules.map((module) => (
            <div className="module-row" key={module.number}>
              <span className="module-number">{module.number}</span>
              <span className="module-icon">{module.symbol}</span>
              <span className="module-copy">
                <strong>{module.title}</strong>
                <small>{module.description}</small>
              </span>
              <span className="module-status">AKAN DATANG</span>
            </div>
          ))}
        </div>
      </section>

      <footer className="site-footer">
        <a className="brand footer-brand" href="#utama">
          <span className="brand-mark">ES</span>
          <span className="brand-text">
            <strong>EKONOMI<span>SMART</span></strong>
            <small>SMK TAMAN MEDAN</small>
          </span>
        </a>
        <p>Platform pembelajaran digital Ekonomi Tingkatan 4 dan 5.</p>
        <small>DIBANGUNKAN UNTUK SMK TAMAN MEDAN · © 2026</small>
      </footer>
    </main>
  );
}
