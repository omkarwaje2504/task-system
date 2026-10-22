'use client';
import { useState } from 'react';
import FileDropZone from './FileDropZone';
import JobList from './JobList';
import { downloadBlob, replaceExt, loadImageBitmap, bitmapToCanvas, canvasToBlob } from '@/lib/mediaTools';

const FORMATS = {
    png: { label: 'PNG', mime: 'image/png', ext: 'png', lossy: false },
    jpeg: { label: 'JPEG', mime: 'image/jpeg', ext: 'jpg', lossy: true },
    webp: { label: 'WebP', mime: 'image/webp', ext: 'webp', lossy: true },
};

let nextId = 1;

/** Image format conversion via the Canvas API — no library needed for this one. */
export default function ImageConvertTab() {
    const [format, setFormat] = useState('jpeg');
    const [quality, setQuality] = useState(0.85);
    const [jobs, setJobs] = useState([]);
    const [running, setRunning] = useState(false);

    function addFiles(files) {
        setJobs((prev) => [
            ...prev,
            ...files.map((f) => ({ id: nextId++, file: f, name: f.name, status: 'queued', progress: 0, originalSize: f.size })),
        ]);
    }

    async function processOne(job) {
        setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: 'processing', progress: 0.3 } : j)));
        try {
            const target = FORMATS[format];
            const bitmap = await loadImageBitmap(job.file);
            const canvas = bitmapToCanvas(bitmap);
            const blob = await canvasToBlob(canvas, target.mime, target.lossy ? quality : undefined);
            const resultName = replaceExt(job.name, target.ext);
            setJobs((prev) => prev.map((j) => (j.id === job.id
                ? { ...j, status: 'done', progress: 1, resultBlob: blob, resultName, resultSize: blob.size }
                : j)));
        } catch (err) {
            setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: 'error', error: err.message || 'Conversion failed.' } : j)));
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
    const target = FORMATS[format];

    return (
        <div className="space-y-3">
            <p className="text-xs text-muted">Convert images between PNG, JPEG and WebP — runs entirely in your browser.</p>
            <FileDropZone
                accept="image/*"
                onFiles={addFiles}
                label="Drop image files here, or click to browse"
                hint="JPG, PNG, WebP, GIF, BMP, TIFF…"
            />
            <div className="flex flex-wrap items-end gap-3">
                <div>
                    <label className="label">Convert to</label>
                    <select className="input w-auto" value={format} onChange={(e) => setFormat(e.target.value)}>
                        {Object.entries(FORMATS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
                    </select>
                </div>
                {target.lossy && (
                    <div>
                        <label className="label">Quality — {Math.round(quality * 100)}%</label>
                        <input
                            type="range" min="0.1" max="1" step="0.05" className="w-40"
                            value={quality} onChange={(e) => setQuality(Number(e.target.value))}
                        />
                    </div>
                )}
            </div>
            {jobs.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    <button className="btn-primary" onClick={runAll} disabled={running || queuedCount === 0}>
                        {running ? 'Converting…' : `Convert ${queuedCount || jobs.length} file${(queuedCount || jobs.length) === 1 ? '' : 's'}`}
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
