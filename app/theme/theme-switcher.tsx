"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const STORAGE_KEY = "ekonomi-smart-theme";

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 2v2.2M12 19.8V22M4.93 4.93l1.55 1.55m11.04 11.04 1.55 1.55M2 12h2.2m15.6 0H22M4.93 19.07l1.55-1.55M17.52 6.48l1.55-1.55" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.2 15.2A8.7 8.7 0 0 1 8.8 3.8 8.8 8.8 0 1 0 20.2 15.2Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m16.5 3 .55 1.45L18.5 5l-1.45.55L16.5 7l-.55-1.45L14.5 5l1.45-.55L16.5 3Z" fill="currentColor" />
    </svg>
  );
}

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let initial: Theme = "light";
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark") initial = stored;
      else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) initial = "dark";
    } catch {
      initial = "light";
    }
    document.documentElement.dataset.theme = initial;
    setTheme(initial);
    setReady(true);
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Theme still works for the current session when storage is unavailable.
    }
  }

  return (
    <button
      className="theme-switcher"
      type="button"
      onClick={toggleTheme}
      aria-label={ready ? (theme === "light" ? "Aktifkan mod gelap" : "Aktifkan mod cerah") : "Tukar mod paparan"}
      aria-pressed={theme === "dark"}
      title={theme === "light" ? "Tukar kepada Dark Mode" : "Tukar kepada Light Mode"}
    >
      <span className="theme-switcher-icon">{theme === "light" ? <MoonIcon /> : <SunIcon />}</span>
      <span className="theme-switcher-label">{theme === "light" ? "Light" : "Dark"}</span>
      <span className="theme-switcher-track"><span className="theme-switcher-thumb" /></span>
    </button>
  );
}
