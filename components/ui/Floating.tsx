"use client";

import { useLayoutEffect, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

const MIN_WIDTH = 208;
const GAP = 4;

/**
 * A dropdown panel drawn in <body> and pinned to its anchor, so cards with
 * overflow-hidden, scrolling modals and tables can't clip it. Opens upward
 * when there's no room below, and follows the anchor while the page scrolls.
 */
export default function FloatingPanel({ anchor, panelRef, children, className = "", estHeight = 300 }: {
  anchor: RefObject<HTMLElement | null>;
  panelRef?: RefObject<HTMLDivElement | null>;
  children: ReactNode;
  className?: string;
  /** Roughly how tall the panel gets — decides when to flip upward. */
  estHeight?: number;
}) {
  const [style, setStyle] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const el = anchor.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const width = Math.max(r.width, MIN_WIDTH);
      const below = window.innerHeight - r.bottom;
      const up = below < estHeight && r.top > below;
      setStyle({
        position: "fixed",
        width,
        left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)),
        ...(up ? { bottom: window.innerHeight - r.top + GAP, maxHeight: r.top - 16 } : { top: r.bottom + GAP, maxHeight: below - 16 }),
      });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [anchor, estHeight]);

  if (!style) return null;
  return createPortal(
    <div ref={panelRef} style={style} className={`glass animate-pop z-[100] flex flex-col overflow-hidden rounded-2xl p-1 ${className}`}>
      {children}
    </div>,
    document.body,
  );
}
