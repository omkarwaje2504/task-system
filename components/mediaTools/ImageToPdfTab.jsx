'use client';
import { useState } from 'react';
import { PDFDocument, PageSizes } from 'pdf-lib';
import FileDropZone from './FileDropZone';
import { toast } from '@/lib/toast';
import { downloadBlob, loadImageBitmap, bitmapToCanvas, canvasToBlob } from '@/lib/mediaTools';

const A4 = PageSizes.A4; // [595.28, 841.89] pt

/** Bundles one or more images into a single PDF, one image per page. */
export default function ImageToPdfTab() {
    const [files, setFiles] = useState([]);
    const [pageMode, setPageMode] = useState('fit'); // 'fit' | 'a4'
    const [building, setBuilding] = useState(false);

    function addFiles(newFiles) {
        setFiles((prev) => [...prev, ...newFiles]);
    }

    function removeAt(i) {
        setFiles((prev) => prev.filter((_, idx) => idx !== i));
    }

    async function build() {
        if (!files.length) return;
        setBuilding(true);
        try {
            const pdfDoc = await PDFDocument.create();
            for (const file of files) {
                const bitmap = await loadImageBitmap(file);
                const canvas = bitmapToCanvas(bitmap);
                const jpegBlob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
                const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
                const embedded = await pdfDoc.embedJpg(jpegBytes);

                if (pageMode === 'a4') {
                    const page = pdfDoc.addPage(A4);
                    const margin = 24;
                    const maxW = A4[0] - margin * 2, maxH = A4[1] - margin * 2;
                    const scale = Math.min(maxW / embedded.width, maxH / embedded.height, 1);
                    const w = embedded.width * scale, h = embedded.height * scale;
                    page.drawImage(embedded, { x: (A4[0] - w) / 2, y: (A4[1] - h) / 2, width: w, height: h });
                } else {
                    // Fit-to-image: page dimensions follow the photo, at a
                    // print-reasonable 150dpi assumption instead of using
                    // raw pixel counts as PDF points (which would print huge).
                    const dpi = 150;
                    const w = (embedded.width * 72) / dpi;
                    const h = (embedded.height * 72) / dpi;
                    const page = pdfDoc.addPage([w, h]);
                    page.drawImage(embedded, { x: 0, y: 0, width: w, height: h });
                }
            }
            const bytes = await pdfDoc.save();
            downloadBlob(new Blob([bytes], { type: 'application/pdf' }), 'images.pdf');
            toast.success('PDF created.');
        } catch (err) {
            toast.error(err.message || 'Failed to build PDF.');
        } finally {
            setBuilding(false);
        }
    }

    return (
        <div className="space-y-3">
            <p className="text-xs text-muted">Combine images into one PDF, one page per image — runs entirely in your browser.</p>
            <FileDropZone
                accept="image/*"
                onFiles={addFiles}
                label="Drop image files here, or click to browse"
                hint="Added in the order you drop them"
            />
            {files.length > 0 && (
                <ul className="space-y-1">
                    {files.map((f, i) => (
                        <li key={i} className="flex items-center justify-between gap-2 rounded-md border border-line px-2.5 py-1 text-[13px]">
                            <span className="truncate">{i + 1}. {f.name}</span>
                            <button className="shrink-0 text-xs text-muted hover:text-danger" onClick={() => removeAt(i)}>✕</button>
                        </li>
                    ))}
                </ul>
            )}
            <div>
                <label className="label">Page size</label>
                <select className="input w-auto" value={pageMode} onChange={(e) => setPageMode(e.target.value)}>
                    <option value="fit">Fit to each image</option>
                    <option value="a4">A4, image centered</option>
                </select>
            </div>
            <div className="flex flex-wrap gap-2">
                <button className="btn-primary" onClick={build} disabled={building || files.length === 0}>
                    {building ? 'Building…' : `Build PDF (${files.length} page${files.length === 1 ? '' : 's'})`}
                </button>
                {files.length > 0 && <button className="btn-ghost" onClick={() => setFiles([])} disabled={building}>Clear</button>}
            </div>
        </div>
    );
}
