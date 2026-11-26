import Link from "next/link";
import styles from "./mobile-header-menu.module.css";
import TeacherLogoutButton from "../../guru/dashboard/logout-button";

export type HeaderMenuItem = { label: string; href: string };
type MobileHeaderMenuProps = {
  roleLabel: "PENTADBIR" | "GURU" | "MURID";
  items: HeaderMenuItem[];
};

export default function MobileHeaderMenu({ roleLabel, items }: MobileHeaderMenuProps) {
  return (
    <div className={styles.mobileActions}>
      <span className={styles.roleBadge}>{roleLabel}</span>
      <details className={styles.menu}>
        <summary aria-label="Buka menu lain" title="Menu lain">
          <span className={styles.dots} aria-hidden="true">•••</span>
          <span className={styles.moreLabel}>MORE</span>
        </summary>
        <nav className={styles.panel} aria-label={`Menu ${roleLabel.toLowerCase()}`}>
          <span className={styles.panelTitle}>MENU UTAMA</span>
          {items.map((item) => (
            <Link className={styles.menuItem} href={item.href} key={item.href}>
              <span>{item.label}</span>
              <span className={styles.arrow} aria-hidden="true">↗</span>
            </Link>
          ))}
          <div className={styles.separator} />
          <div className={styles.logoutRow}>
            <TeacherLogoutButton />
          </div>
        </nav>
      </details>
    </div>
  );
}
