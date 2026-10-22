"use client";

import { useEffect } from "react";

const TAPPABLE = ".btn, .btn-primary, .btn-ghost, .btn-soft, .btn-danger, .icon-btn, .tap";

/**
 * Feeds the press point to the CSS so the liquid-glass bloom starts under the
 * finger. The touchstart listener also makes iOS Safari apply :active.
 */
export default function TapGlow() {
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>(TAPPABLE);
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--tap-x", `${e.clientX - r.left}px`);
      el.style.setProperty("--tap-y", `${e.clientY - r.top}px`);
    };
    const noop = () => {};
    document.addEventListener("pointerdown", down, { passive: true });
    document.addEventListener("touchstart", noop, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("touchstart", noop);
    };
  }, []);
  return null;
}
