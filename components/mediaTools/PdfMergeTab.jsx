'use client';
import { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import FileDropZone from './FileDropZone';
import { toast } from '@/lib/toast';
import { downloadBlob } from '@/lib/mediaTools';

/** Merges multiple PDFs into one, in the order listed — pure pdf-lib, no server round-trip. */
export default function PdfMergeTab() {
    const [files, setFiles] = useState([]);
    const [merging, setMerging] = useState(false);

    function addFiles(newFiles) {
        setFiles((prev) => [...prev, ...newFiles]);
    }

    function removeAt(i) {
        setFiles((prev) => prev.filter((_, idx) => idx !== i));
    }

    function move(i, dir) {
        setFiles((prev) => {
            const next = [...prev];
            const j = i + dir;
            if (j < 0 || j >= next.length) return prev;
            [next[i], next[j]] = [next[j], next[i]];
            return next;
        });
    }

    async function merge() {
        if (files.length < 2) return;
        setMerging(true);
        try {
            const merged = await PDFDocument.create();
            for (const file of files) {
                const bytes = new Uint8Array(await file.arrayBuffer());
                const src = await PDFDocument.load(bytes);
                const pages = await merged.copyPages(src, src.getPageIndices());
                pages.forEach((p) => merged.addPage(p));
            }
            const bytes = await merged.save();
            downloadBlob(new Blob([bytes], { type: 'application/pdf' }), 'merged.pdf');
            toast.success('PDFs merged.');
        } catch (err) {
            toast.error(err.message || 'Failed to merge PDFs. Are all files valid PDFs?');
        } finally {
            setMerging(false);
        }
    }

    return (
        <div className="space-y-3">
            <p className="text-xs text-muted">Combine multiple PDFs into one, in the order below — runs entirely in your browser.</p>
            <FileDropZone
                accept="application/pdf"
                onFiles={addFiles}
                label="Drop PDF files here, or click to browse"
                hint="Add two or more PDFs"
            />
            {files.length > 0 && (
                <ul className="space-y-1">
                    {files.map((f, i) => (
                        <li key={i} className="flex items-center justify-between gap-2 rounded-md border border-line px-2.5 py-1 text-[13px]">
                            <span className="truncate">{i + 1}. {f.name}</span>
                            <div className="flex shrink-0 items-center gap-1">
                                <button className="text-xs text-muted hover:text-fg disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                                <button className="text-xs text-muted hover:text-fg disabled:opacity-30" disabled={i === files.length - 1} onClick={() => move(i, 1)}>↓</button>
                                <button className="text-xs text-muted hover:text-danger" onClick={() => removeAt(i)}>✕</button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            <div className="flex flex-wrap gap-2">
                <button className="btn-primary" onClick={merge} disabled={merging || files.length < 2}>
                    {merging ? 'Merging…' : `Merge ${files.length} PDFs`}
                </button>
                {files.length > 0 && <button className="btn-ghost" onClick={() => setFiles([])} disabled={merging}>Clear</button>}
            </div>
        </div>
    );
}
