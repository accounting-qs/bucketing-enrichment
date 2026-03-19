"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { useTheme } from "./ThemeProvider";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { theme, cycleTheme } = useTheme();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const themeLabel = theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System";

  return (
    <aside
      className={`sidebar ${collapsed ? "sidebar--collapsed" : ""}`}
      data-collapsed={collapsed}
    >
      {/* Logo / Brand */}
      <div className="sidebar__brand">
        <div className="sidebar__logo">
          <Sparkles size={24} />
        </div>
        {!collapsed && (
          <div className="sidebar__brand-text">
            <span className="sidebar__title">Quantum</span>
            <span className="sidebar__subtitle">Enricher</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="sidebar__nav">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar__link ${active ? "sidebar__link--active" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={20} className="sidebar__link-icon" />
              {!collapsed && (
                <span className="sidebar__link-label">{item.label}</span>
              )}
              {active && <div className="sidebar__link-indicator" />}
            </Link>
          );
        })}
      </nav>

      {/* Theme Toggle */}
      <button
        onClick={cycleTheme}
        className="sidebar__theme-toggle"
        aria-label={`Theme: ${themeLabel}`}
        title={`Theme: ${themeLabel}. Click to cycle.`}
      >
        <ThemeIcon size={16} />
        {!collapsed && <span className="sidebar__theme-label">{themeLabel}</span>}
      </button>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="sidebar__toggle"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  );
}
