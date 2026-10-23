"use client";

import { useRef, useState, type ReactNode } from "react";
import { Check, ImagePlus, LoaderCircle, Moon, Palette, RotateCcw, Sun, Trash } from "lucide-react";
import { PageHeader, PageIcon, Segmented } from "@/components/ui/bits";
import { useDarkMode } from "@/components/shell/ThemeToggle";
import TabIcon from "@/components/shell/TabIcon";
import { useAppearance } from "@/components/settings/useAppearance";
import { uploadFile } from "@/lib/client";
import { toastError } from "@/lib/toast";
import { ACCENTS, DEFAULT_APPEARANCE, TEXT_SIZES, type Appearance } from "@/lib/appearance";

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="card">
      <h2 className="text-[0.9375rem] font-bold">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Row({ label, children, value }: { label: string; children: ReactNode; value?: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="label !mb-0">{label}</span>
        {value !== undefined && <span className="text-xs font-semibold text-muted tabular-nums">{value}</span>}
      </div>
      {children}
    </div>
  );
}

function Slider({ value, min, max, step = 1, onChange }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return <input type="range" className="w-full accent-accent" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />;
}

export default function SettingsPage() {
  const { appearance, update, reset } = useAppearance();
  const { dark, toggle } = useDarkMode();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<number | null>(null);
  const a = { ...DEFAULT_APPEARANCE, ...appearance } as Required<Appearance>;
  const customAccent = a.accent && !ACCENTS.some((c) => c.value === a.accent);

  async function pickWallpaper(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toastError(new Error("Pick an image file (JPG, PNG, WebP…)."));
    if (file.size > 15 * 1024 * 1024) return toastError(new Error("That image is over 15 MB — pick a smaller one."));
    setUploading(0);
    try {
      update({ wallpaper: await uploadFile(file, "wallpapers", setUploading) });
    } catch (e) {
      toastError(e);
    } finally {
      setUploading(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Make Task System look the way you like. Saved to your account." icon={<PageIcon><Palette /></PageIcon>}
        actions={<button className="btn-ghost" onClick={reset} disabled={!appearance || !Object.keys(appearance).length}><RotateCcw className="h-4 w-4" />Reset to default</button>} />

      <div className="grid max-w-5xl gap-3 lg:grid-cols-2">
        <Section title="Colour" hint="The accent used for links, highlights, progress and selected items.">
          <Row label="Theme">
            <Segmented value={dark ? "dark" : "light"} onChange={(v) => (v === "dark") !== dark && toggle()}
              items={[{ key: "dark", label: <span className="flex items-center gap-1"><Moon className="h-3.5 w-3.5" />Dark</span> }, { key: "light", label: <span className="flex items-center gap-1"><Sun className="h-3.5 w-3.5" />Light</span> }]} />
          </Row>
          <Row label="Accent colour" value={ACCENTS.find((c) => c.value === a.accent)?.name || (a.accent ? "Custom" : "Blue")}>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENTS.map((c) => {
                const on = (a.accent || ACCENTS[0].value) === c.value;
                return (
                  <button key={c.value} title={c.name} aria-label={c.name} aria-pressed={on}
                    onClick={() => update({ accent: c.value === ACCENTS[0].value ? undefined : c.value })}
                    className="tap flex h-8 w-8 items-center justify-center rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
                    style={{ background: c.value, outline: on ? "2px solid var(--fg)" : "none", outlineOffset: 2 }}>
                    {on && <Check className="h-4 w-4 text-white drop-shadow" strokeWidth={3} />}
                  </button>
                );
              })}
              <label title="Pick any colour" className={`tap relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-line bg-[conic-gradient(#ff453a,#ff9f0a,#ffd60a,#30d158,#40c8e0,#0a84ff,#bf5af2,#ff375f,#ff453a)] ${customAccent ? "outline-2 outline-offset-2 outline-fg" : ""}`}>
                <input type="color" className="absolute inset-0 cursor-pointer opacity-0" value={a.accent || ACCENTS[0].value} onChange={(e) => update({ accent: e.target.value })} aria-label="Custom accent colour" />
              </label>
            </div>
          </Row>
          <Row label="Main buttons">
            <div className="flex items-center gap-3">
              <Segmented value={a.buttons} onChange={(v) => update({ buttons: v === "white" ? undefined : v })}
                items={[{ key: "white", label: dark ? "White" : "Black" }, { key: "accent", label: "Accent colour" }]} />
              <span className="btn-primary btn-sm pointer-events-none">Preview</span>
            </div>
          </Row>
        </Section>

        <Section title="Icons" hint="How the tab bar icons and every other icon are drawn.">
          <Row label="Tab icon style">
            <Segmented value={a.iconStyle} onChange={(v) => update({ iconStyle: v === "auto" ? undefined : v })}
              items={[{ key: "auto", label: "Fill when selected" }, { key: "outline", label: "Outline" }, { key: "filled", label: "Filled" }]} />
          </Row>
          <Row label="Line weight">
            <Segmented value={a.iconWeight} onChange={(v) => update({ iconWeight: v === "regular" ? undefined : v })}
              items={[{ key: "thin", label: "Thin" }, { key: "regular", label: "Regular" }, { key: "bold", label: "Bold" }]} />
          </Row>
          <div className="flex justify-around rounded-2xl border border-line bg-panel2 p-3 text-[0.625rem] font-semibold">
            {(["home", "projects", "tasks", "assets", "more"] as const).map((n, i) => (
              <span key={n} aria-current={i === 0 ? "page" : undefined} className={`flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 capitalize ${i === 0 ? "tab-lens text-fg" : "text-muted"}`}>
                <TabIcon name={n} />{n}
              </span>
            ))}
          </div>
        </Section>

        <Section title="Text size" hint="Makes all text (and the spacing around it) smaller or bigger.">
          <Segmented value={String(a.textScale)} onChange={(v) => update({ textScale: Number(v) === 1 ? undefined : Number(v) })}
            items={TEXT_SIZES.map((t) => ({ key: String(t.value), label: t.label }))} />
          <p className="rounded-2xl border border-line bg-panel2 p-3 text-sm">
            <span className="block font-bold">The quick brown fox</span>
            <span className="text-muted">Projects, tasks and the design library for the whole team.</span>
          </p>
        </Section>

        <Section title="Glass" hint="The frosted sidebar, tab bar, menus and pop-ups.">
          <Row label="Transparency" value={a.transparency === 0 ? "Solid" : `${a.transparency}%`}>
            <Slider value={a.transparency} min={0} max={95} step={5} onChange={(v) => update({ transparency: v === 50 ? undefined : v })} />
          </Row>
          <Row label="Blur" value={`${a.blur}px`}>
            <Slider value={a.blur} min={0} max={40} onChange={(v) => update({ blur: v === 16 ? undefined : v })} />
          </Row>
        </Section>

        <Section title="Background image" hint="A picture behind everything. Cards turn into glass on top of it.">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-2xl border border-line bg-panel2 sm:w-56">
              {a.wallpaper
                // eslint-disable-next-line @next/next/no-img-element -- user-uploaded image from R2, shown as-is
                ? <img src={a.wallpaper} alt="Your background" className="h-full w-full object-cover" />
                : <span className="flex h-full items-center justify-center text-xs text-muted">No image</span>}
              {uploading !== null && (
                <span className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 text-xs font-semibold text-white">
                  <LoaderCircle className="h-4 w-4 animate-spin" />{uploading}%
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickWallpaper(e.target.files?.[0])} />
              <button className="btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading !== null}>
                <ImagePlus className="h-4 w-4" />{a.wallpaper ? "Change image" : "Add image"}
              </button>
              {a.wallpaper && <button className="btn-ghost btn-sm" onClick={() => update({ wallpaper: undefined })}><Trash className="h-4 w-4" />Remove</button>}
            </div>
          </div>
          {a.wallpaper && (
            <Row label={dark ? "Darken image" : "Lighten image"} value={`${a.wallpaperDim}%`}>
              <Slider value={a.wallpaperDim} min={0} max={80} step={5} onChange={(v) => update({ wallpaperDim: v === 35 ? undefined : v })} />
            </Row>
          )}
        </Section>
      </div>
    </>
  );
}
