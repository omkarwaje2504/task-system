'use client';
import { useRef, useState } from 'react';

/**
 * Drag-and-drop + click-to-browse file picker, styled to match the app's
 * card/input conventions. Purely a file-collector — callers own what
 * happens to the files next.
 */
export default function FileDropZone({ accept, multiple = true, onFiles, label, hint }) {
    const inputRef = useRef(null);
    const [dragging, setDragging] = useState(false);

    function handleFiles(fileList) {
        const files = Array.from(fileList || []);
        if (files.length) onFiles(files);
    }

    return (
        <div
            className={`rounded-lg border-2 border-dashed p-5 text-center transition-colors cursor-pointer ${dragging ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-line hover:border-accent'
                }`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                handleFiles(e.dataTransfer.files);
            }}
        >
            <p className="text-sm font-medium">{label || 'Drop files here, or click to browse'}</p>
            {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
            <input
                ref={inputRef}
                type="file"
                accept={accept}
                multiple={multiple}
                className="hidden"
                onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
            />
        </div>
    );
}
