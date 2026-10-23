import { ImageResponse } from "next/og";

// The preview shown when a Task System link is shared (WhatsApp, Slack, LinkedIn…).
export const alt = "Task System — projects, tasks and design assets for the studio team";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CHIPS = ["RxPad", "EVideo", "AI Video", "Frames", "Calendars", "Apps & Websites"];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#000", color: "#f5f5f7", position: "relative" }}>
        {/* Soft colour glow behind the glass card */}
        <div style={{ position: "absolute", top: -180, left: -120, width: 620, height: 620, borderRadius: 9999, background: "radial-gradient(circle, rgba(94,92,230,.55), rgba(94,92,230,0) 70%)", display: "flex" }} />
        <div style={{ position: "absolute", bottom: -220, right: -140, width: 720, height: 720, borderRadius: 9999, background: "radial-gradient(circle, rgba(10,132,255,.45), rgba(10,132,255,0) 70%)", display: "flex" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ width: 96, height: 96, borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #5e5ce6, #0a84ff)", boxShadow: "0 20px 50px rgba(10,132,255,.45)" }}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z" />
              <path d="m6.2 5.3 3.1 3.9" />
              <path d="m12.4 3.4 3.1 4" />
              <path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
            </svg>
          </div>
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>Task System</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, padding: 44, borderRadius: 36, background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.16)" }}>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>Every project, one clear next step.</div>
          <div style={{ fontSize: 28, color: "rgba(235,235,245,.65)" }}>Projects, tasks and the design library for the whole studio team.</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
            {CHIPS.map((c) => (
              <div key={c} style={{ display: "flex", fontSize: 22, padding: "8px 18px", borderRadius: 9999, background: "rgba(10,132,255,.18)", color: "#6cb6ff" }}>{c}</div>
            ))}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
