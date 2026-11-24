import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./visual-system.css";
import ThemeSwitcher from "./theme/theme-switcher";

export const metadata: Metadata = {
  title: "Ekonomi Smart SMKTM | Fahami Ekonomi, Fahami Dunia",
  description: "Platform pembelajaran digital Ekonomi Tingkatan 4 dan Tingkatan 5, SMK Taman Medan."
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#665ae8"
};
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="ms"><body>{children}<ThemeSwitcher /></body></html>;
}
