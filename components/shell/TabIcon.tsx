import { useId, type ReactNode } from "react";

export type TabIconName = "home" | "projects" | "tasks" | "assets" | "more";

/*
 * iOS tab-bar icons: an outline version and a filled one (like SF Symbols'
 * ".fill" variants). Both are rendered; CSS in globals.css shows the filled
 * one when the link is the current page, pressed or keyboard-focused.
 * Details inside a filled shape (the tick, the photo's sun) are cut out with
 * a mask so they stay readable.
 */
const SHAPES: Record<TabIconName, { body: ReactNode; detail?: ReactNode }> = {
  home: {
    body: (
      <>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </>
    ),
  },
  projects: {
    body: <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />,
    detail: <path d="M8 11v5M12 11v3M16 11v4" />,
  },
  tasks: {
    body: <rect x="3" y="3" width="18" height="18" rx="4.5" />,
    detail: <path d="m8.5 12 2.5 2.5 5-5" />,
  },
  assets: {
    body: <rect x="3" y="3" width="18" height="18" rx="3.5" />,
    detail: (
      <>
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
      </>
    ),
  },
  more: {
    body: <circle cx="12" cy="12" r="9.5" />,
    detail: (
      <>
        <circle cx="7.75" cy="12" r="0.6" />
        <circle cx="12" cy="12" r="0.6" />
        <circle cx="16.25" cy="12" r="0.6" />
      </>
    ),
  },
};

const svgProps = {
  viewBox: "0 0 24 24",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export default function TabIcon({ name, className = "h-[22px] w-[22px]" }: { name: TabIconName; className?: string }) {
  const mask = `tab-ico-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const { body, detail } = SHAPES[name];
  return (
    <span className="tab-ico inline-flex">
      <svg {...svgProps} className={`tab-ico-line ${className}`} fill="none" stroke="currentColor">
        {body}
        {detail}
      </svg>
      <svg {...svgProps} className={`tab-ico-fill ${className}`} fill="currentColor" stroke="currentColor">
        {detail && (
          <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
            <rect width="24" height="24" fill="#fff" stroke="none" />
            <g fill="none" stroke="#000" strokeWidth={2.1}>{detail}</g>
          </mask>
        )}
        <g mask={detail ? `url(#${mask})` : undefined}>{body}</g>
      </svg>
    </span>
  );
}
