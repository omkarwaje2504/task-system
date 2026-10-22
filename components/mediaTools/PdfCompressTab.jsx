'use client';
import { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import FileDropZone from './FileDropZone';
import JobList from './JobList';
import { downloadBlob, replaceExt } from '@/lib/mediaTools';

const QUALITY_OPTIONS = [
    { value: 0.4, label: 'High compression — smallest file' },
    { value: 0.65, label: 'Balanced' },
    { value: 0.85, label: 'Low compression — best quality' },
];
const SCALE_FOR_QUALITY = { 0.4: 1.25, 0.65: 1.5, 0.85: 2 };

let nextId = 1;
let pdfjsPromise = null;

// pdfjs-dist ships an ES module worker; loading it via `new URL(..., import.meta.url)`
// lets webpack/Next bundle it as a static asset instead of fetching from a CDN.
async function getPdfjs() {
    if (!pdfjsPromise) {
        pdfjsPromise = import('pdfjs-dist').then((pdfjsLib) => {
            pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
            return pdfjsLib;
        });
    }
    return pdfjsPromise;
}

/**
 * Shrinks PDF file size by rasterizing each page to a canvas and re-encoding
 * as JPEG at a chosen quality, then rebuilding the PDF with pdf-lib. Works
 * best on scan/photo-heavy PDFs; text-only PDFs won't shrink much this way
 * since they're already compact — that's an inherent tradeoff of this
 * client-side approach (no access to a true PDF content-stream recompressor).
 */
export default function PdfCompressTab() {
    const [quality, setQuality] = useState(0.65);
    const [jobs, setJobs] = useState([]);
    const [running, setRunning] = useState(false);

    function addFiles(files) {
        setJobs((prev) => [
            ...prev,
            ...files.map((f) => ({ id: nextId++, file: f, name: f.name, status: 'queued', progress: 0, originalSize: f.size })),
        ]);
    }

    async function processOne(job) {
        setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: 'processing', progress: 0.05 } : j)));
        try {
            const pdfjsLib = await getPdfjs();
            const srcBytes = new Uint8Array(await job.file.arrayBuffer());
            const pdf = await pdfjsLib.getDocument({ data: srcBytes.slice() }).promise;
            const outDoc = await PDFDocument.create();
            const scale = SCALE_FOR_QUALITY[quality] || 1.5;

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale });
                const canvas = document.createElement('canvas');
                canvas.width = Math.ceil(viewport.width);
                canvas.height = Math.ceil(viewport.height);
                const ctx = canvas.getContext('2d');
                await page.render({ canvasContext: ctx, viewport }).promise;

                const jpegBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
                const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
                const embedded = await outDoc.embedJpg(jpegBytes);
                const outPage = outDoc.addPage([viewport.width, viewport.height]);
                outPage.drawImage(embedded, { x: 0, y: 0, width: viewport.width, height: viewport.height });

                setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, progress: 0.05 + 0.9 * (i / pdf.numPages) } : j)));
            }

            const outBytes = await outDoc.save();
            const blob = new Blob([outBytes], { type: 'application/pdf' });
            const resultName = replaceExt(job.name, 'pdf');
            setJobs((prev) => prev.map((j) => (j.id === job.id
                ? { ...j, status: 'done', progress: 1, resultBlob: blob, resultName, resultSize: blob.size }
                : j)));
        } catch (err) {
            setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: 'error', error: err.message || 'Compression failed.' } : j)));
        }
    }

    async function runAll() {
        setRunning(true);
        for (const job of jobs) {
            if (job.status === 'queued') await processOne(job);
        }
        setRunning(false);
    }

    const queuedCount = jobs.filter((j) => j.status === 'queued').length;

    return (
        <div className="space-y-3">
            <p className="text-xs text-muted">
                Shrink PDF file size by re-rendering each page — works best on scanned/photo-heavy PDFs. Runs entirely in your browser.
            </p>
            <FileDropZone
                accept="application/pdf"
                onFiles={addFiles}
                label="Drop PDF files here, or click to browse"
                hint="Text-heavy PDFs may not shrink much"
            />
            <div>
                <label className="label">Compression level</label>
                <select className="input w-auto" value={quality} onChange={(e) => setQuality(Number(e.target.value))}>
                    {QUALITY_OPTIONS.map((q) => <option key={q.value} value={q.value}>{q.label}</option>)}
                </select>
            </div>
            {jobs.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    <button className="btn-primary" onClick={runAll} disabled={running || queuedCount === 0}>
                        {running ? 'Compressing…' : `Compress ${queuedCount || jobs.length} file${(queuedCount || jobs.length) === 1 ? '' : 's'}`}
                    </button>
                    {jobs.some((j) => j.status === 'done') && (
                        <button className="btn-ghost" onClick={() => jobs.filter((j) => j.status === 'done').forEach((j) => downloadBlob(j.resultBlob, j.resultName))}>
                            Download all
                        </button>
                    )}
                    <button className="btn-ghost" onClick={() => setJobs([])} disabled={running}>Clear</button>
                </div>
            )}
            <JobList jobs={jobs} />
        </div>
    );
}
