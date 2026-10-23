"use client";

import { useState } from "react";
import { FileArchive, FileImage, Files, Film, ImageDown, Repeat, ShieldCheck, Wrench, type LucideIcon } from "lucide-react";
import { PageHeader, PageIcon } from "@/components/ui/bits";
import VideoCompressTab from "@/components/mediaTools/VideoCompressTab";
import VideoConvertTab from "@/components/mediaTools/VideoConvertTab";
import ImageConvertTab from "@/components/mediaTools/ImageConvertTab";
import ImageToPdfTab from "@/components/mediaTools/ImageToPdfTab";
import PdfMergeTab from "@/components/mediaTools/PdfMergeTab";
import PdfCompressTab from "@/components/mediaTools/PdfCompressTab";

const TOOLS: { key: string; label: string; help: string; icon: LucideIcon; Component: React.ComponentType }[] = [
  { key: "video-compress", label: "Shrink a video", help: "Make video files smaller", icon: Film, Component: VideoCompressTab },
  { key: "video-convert", label: "Convert a video", help: "MP4, WebM, MOV, MKV", icon: Repeat, Component: VideoConvertTab },
  { key: "image-convert", label: "Convert images", help: "PNG, JPEG, WebP", icon: ImageDown, Component: ImageConvertTab },
  { key: "image-to-pdf", label: "Images → PDF", help: "One image per page", icon: FileImage, Component: ImageToPdfTab },
  { key: "pdf-merge", label: "Merge PDFs", help: "Join several into one", icon: Files, Component: PdfMergeTab },
  { key: "pdf-compress", label: "Shrink a PDF", help: "Best for scans & photos", icon: FileArchive, Component: PdfCompressTab },
];

export default function MediaToolsPage() {
  const [tool, setTool] = useState(TOOLS[0].key);
  const active = TOOLS.find((t) => t.key === tool)!;
  const Active = active.Component;

  return (
    <>
      <PageHeader title="Media Tools" subtitle="Compress and convert files right here."
        icon={<PageIcon><Wrench /></PageIcon>} />

      <p className="mb-3 flex items-center gap-1.5 rounded-md bg-accent-soft px-2.5 py-1.5 text-xs font-medium text-accent">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />Everything runs inside your browser — your files are never uploaded.
      </p>

      <div className="mb-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
        {TOOLS.map(({ key, label, help, icon: Icon }) => (
          <button key={key} onClick={() => setTool(key)}
            className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${tool === key ? "border-accent bg-accent-soft" : "border-line bg-panel hover:border-accent/50"}`}>
            <Icon className={`h-4 w-4 shrink-0 ${tool === key ? "text-accent" : "text-muted"}`} />
            <span>
              <span className="block text-[0.8125rem] font-semibold">{label}</span>
              <span className="text-[0.6875rem] text-muted">{help}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="card">
        <h2 className="mb-2 text-sm font-extrabold">{active.label}</h2>
        <Active />
      </div>
    </>
  );
}
