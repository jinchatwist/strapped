"use client";

import { useEffect, useState } from "react";

type Theme = "auto" | "light" | "dark";
const NEXT: Record<Theme, Theme> = { auto: "light", light: "dark", dark: "auto" };
const LABEL: Record<Theme, string> = { auto: "◐ Auto", light: "☀ Light", dark: "☾ Dark" };

// Cycles Auto → Light → Dark. Auto follows the phone setting; the choice is remembered on this device.
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("auto");

  useEffect(() => {
    const saved = document.documentElement.dataset.theme;
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, []);

  function change() {
    const next = NEXT[theme];
    setTheme(next);
    const root = document.documentElement;
    if (next === "auto") delete root.dataset.theme;
    else root.dataset.theme = next;
    try {
      if (next === "auto") localStorage.removeItem("strapped-theme");
      else localStorage.setItem("strapped-theme", next);
    } catch {}
  }

  return (
    <button className="theme-btn" onClick={change} aria-label={`Theme: ${theme}. Tap to change.`}>
      {LABEL[theme]}
    </button>
  );
}
