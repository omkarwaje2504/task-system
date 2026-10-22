'use client';

/** "1.2 MB" style formatting, same idea as the desktop app's fmt_size(). */
export function fmtSize(bytes) {
    if (bytes == null) return '—';
    let b = bytes;
    for (const unit of ['B', 'KB', 'MB', 'GB']) {
        if (b < 1024) return `${b.toFixed(1)} ${unit}`;
        b /= 1024;
    }
    return `${b.toFixed(1)} TB`;
}

/** Triggers a browser "Save As" for an in-memory Blob — no server round-trip. */
export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

/** Swaps a file's extension, e.g. replaceExt('clip.mov', 'webm') -> 'clip.webm'. */
export function replaceExt(filename, newExt) {
    const dot = filename.lastIndexOf('.');
    return `${dot === -1 ? filename : filename.slice(0, dot)}.${newExt}`;
}

/**
 * Decodes any browser-readable image file into an ImageBitmap. Used to
 * normalize arbitrary input formats (webp, gif, bmp, ...) before
 * re-encoding or embedding them elsewhere.
 */
export async function loadImageBitmap(file) {
    return await createImageBitmap(file);
}

/** Draws an ImageBitmap onto an offscreen canvas and returns it. */
export function bitmapToCanvas(bitmap) {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    return canvas;
}

/** canvas.toBlob wrapped as a promise. */
export function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas encoding failed.'))), type, quality);
    });
}
