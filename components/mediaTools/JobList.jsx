'use client';
import { fmtSize, downloadBlob } from '@/lib/mediaTools';

/**
 * Shared per-file progress/result list for the "one output per input file"
 * tools (video compress/convert, image convert, PDF compress). Callers own
 * the actual processing — this just renders whatever job state they hand it.
 * job: { id, name, status: 'queued'|'processing'|'done'|'error', progress,
 *        originalSize, resultSize, resultBlob, resultName, error }
 */
export default function JobList({ jobs }) {
    if (!jobs.length) return null;
    return (
        <div className="space-y-1.5">
            {jobs.map((j) => {
                const pct = Math.round((j.progress || 0) * 100);
                const savings = j.status === 'done' && j.originalSize
                    ? Math.round((1 - j.resultSize / j.originalSize) * 100)
                    : null;
                return (
                    <div key={j.id} className="rounded-lg border border-line px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{j.name}</p>
                                <p className="truncate text-xs text-muted">
                                    {j.status === 'error' && <span className="text-danger">{j.error}</span>}
                                    {j.status === 'done' && (
                                        <>
                                            {fmtSize(j.originalSize)} → {fmtSize(j.resultSize)}
                                            {savings != null && savings > 0 && <span className="text-accent"> · {savings}% smaller</span>}
                                        </>
                                    )}
                                    {j.status === 'processing' && `Processing… ${pct}%`}
                                    {j.status === 'queued' && 'Queued'}
                                </p>
                            </div>
                            {j.status === 'done' && j.resultBlob && (
                                <button
                                    className="btn-ghost shrink-0 !px-3 !py-1.5 !text-xs"
                                    onClick={() => downloadBlob(j.resultBlob, j.resultName)}
                                >
                                    Download
                                </button>
                            )}
                        </div>
                        {j.status === 'processing' && (
                            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-panel2">
                                <div
                                    className="h-full rounded-full bg-[var(--accent)] transition-all"
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
