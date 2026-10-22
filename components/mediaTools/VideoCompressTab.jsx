'use client';
import { useState } from 'react';
import { Input, Output, Conversion, ALL_FORMATS, BlobSource, Mp4OutputFormat, WebMOutputFormat, BufferTarget, Quality } from 'mediabunny';
import FileDropZone from './FileDropZone';
import JobList from './JobList';
import { downloadBlob, replaceExt } from '@/lib/mediaTools';

const QUALITY_OPTIONS = [
    { value: 'high', label: 'High — sharper image, larger file' },
    { value: 'medium', label: 'Medium — balanced quality & size' },
    { value: 'low', label: 'Low — smallest file, fastest' },
];

let nextId = 1;

/**
 * Re-encodes video to shrink file size, entirely in the browser via
 * Mediabunny (WebCodecs) — nothing is ever uploaded. Mirrors the desktop
 * app's VideoCrunch tab: pick a quality preset, queue files, compress.
 */
export default function VideoCompressTab() {
    const [quality, setQuality] = useState('medium');
    const [format, setFormat] = useState('mp4');
    const [jobs, setJobs] = useState([]);
    const [running, setRunning] = useState(false);

    function addFiles(files) {
        setJobs((prev) => [
            ...prev,
            ...files.map((f) => ({ id: nextId++, file: f, name: f.name, status: 'queued', progress: 0, originalSize: f.size })),
        ]);
    }

    async function processOne(job) {
        setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: 'processing', progress: 0 } : j)));
        try {
            const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(job.file) });
            const outputFormat = format === 'webm' ? new WebMOutputFormat() : new Mp4OutputFormat();
            const output = new Output({ format: outputFormat, target: new BufferTarget() });
            const conversion = await Conversion.init({
                input, output,
                video: { quality: new Quality(quality) },
                audio: { quality: new Quality(quality) },
            });
            if (!conversion.isValid) throw new Error('No track in this file could be encoded to the chosen format.');
            conversion.onProgress = (p) => setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, progress: p } : j)));
            await conversion.execute();
            const blob = new Blob([output.target.buffer], { type: format === 'webm' ? 'video/webm' : 'video/mp4' });
            const resultName = replaceExt(job.name, format);
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
                Shrink video file size by re-encoding — runs entirely in your browser, nothing is uploaded.
            </p>
            <FileDropZone
                accept="video/*"
                onFiles={addFiles}
                label="Drop video files here, or click to browse"
                hint="MP4, MOV, MKV, WebM, AVI…"
            />
            <div className="flex flex-wrap gap-3">
                <div>
                    <label className="label">Quality</label>
                    <select className="input w-auto" value={quality} onChange={(e) => setQuality(e.target.value)}>
                        {QUALITY_OPTIONS.map((q) => <option key={q.value} value={q.value}>{q.label}</option>)}
                    </select>
                </div>
                <div>
                    <label className="label">Output format</label>
                    <select className="input w-auto" value={format} onChange={(e) => setFormat(e.target.value)}>
                        <option value="mp4">MP4</option>
                        <option value="webm">WebM</option>
                    </select>
                </div>
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
