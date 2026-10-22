'use client';
import { useState } from 'react';
import { Input, Output, Conversion, ALL_FORMATS, BlobSource, Mp4OutputFormat, WebMOutputFormat, MovOutputFormat, MkvOutputFormat, BufferTarget } from 'mediabunny';
import FileDropZone from './FileDropZone';
import JobList from './JobList';
import { downloadBlob, replaceExt } from '@/lib/mediaTools';

const FORMATS = {
    mp4: { label: 'MP4', mime: 'video/mp4', make: () => new Mp4OutputFormat() },
    webm: { label: 'WebM', mime: 'video/webm', make: () => new WebMOutputFormat() },
    mov: { label: 'MOV', mime: 'video/quicktime', make: () => new MovOutputFormat() },
    mkv: { label: 'MKV', mime: 'video/x-matroska', make: () => new MkvOutputFormat() },
};

let nextId = 1;

/** Container/codec conversion + optional frame-rate change, no quality loss beyond format defaults. */
export default function VideoConvertTab() {
    const [format, setFormat] = useState('mp4');
    const [fps, setFps] = useState('');
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
            const target = FORMATS[format];
            const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(job.file) });
            const output = new Output({ format: target.make(), target: new BufferTarget() });
            const fpsNum = fps ? Number(fps) : undefined;
            const conversion = await Conversion.init({
                input, output,
                video: fpsNum ? { frameRate: fpsNum } : undefined,
            });
            if (!conversion.isValid) throw new Error('No track in this file is compatible with the chosen format.');
            conversion.onProgress = (p) => setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, progress: p } : j)));
            await conversion.execute();
            const blob = new Blob([output.target.buffer], { type: target.mime });
            const resultName = replaceExt(job.name, format);
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

    return (
        <div className="space-y-3">
            <p className="text-xs text-muted">
                Convert video between MP4, WebM, MOV and MKV — runs entirely in your browser.
            </p>
            <FileDropZone
                accept="video/*"
                onFiles={addFiles}
                label="Drop video files here, or click to browse"
                hint="MP4, MOV, MKV, WebM, AVI…"
            />
            <div className="flex flex-wrap gap-3">
                <div>
                    <label className="label">Convert to</label>
                    <select className="input w-auto" value={format} onChange={(e) => setFormat(e.target.value)}>
                        {Object.entries(FORMATS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
                    </select>
                </div>
                <div>
                    <label className="label">Frame rate (optional)</label>
                    <input
                        type="number" min="1" max="240" className="input w-auto" placeholder="Original"
                        value={fps} onChange={(e) => setFps(e.target.value)}
                    />
                </div>
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
