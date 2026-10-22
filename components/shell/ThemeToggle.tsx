"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const subscribe = (cb: () => void) => {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => obs.disconnect();
};
const isDark = () => document.documentElement.classList.contains("dark");

export function useDarkMode() {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);
  const toggle = () => {
    const next = !isDark();
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  };
  return { dark, toggle };
}

export default function ThemeToggle({ withLabel = false }: { withLabel?: boolean }) {
  const { dark, toggle } = useDarkMode();
  const Icon = dark ? Sun : Moon;
  return withLabel ? (
    <button onClick={toggle} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted hover:bg-panel2 hover:text-fg">
      <Icon className="h-[18px] w-[18px]" />
      {dark ? "Light mode" : "Dark mode"}
    </button>
  ) : (
    <button onClick={toggle} className="icon-btn" aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title={dark ? "Light mode" : "Dark mode"}>
      <Icon className="h-[18px] w-[18px]" />
    </button>
  );
}
