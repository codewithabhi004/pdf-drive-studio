/**
 * Central Output File Handler for PDF Drive Studio
 * -------------------------------------------------
 * Every generated or edited Blob/File from the tools passes through
 * `handleGeneratedOutput`, including optional Google Drive upload.
 */

const listeners = new Set();

/**
 * Optional Google Drive upload hook, enabled after the user signs in.
 */
let driveUploadAdapter = null;

export function setDriveUploadAdapter(adapterFn) {
  driveUploadAdapter = typeof adapterFn === 'function' ? adapterFn : null;
}

export function subscribeToOutputs(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyListeners(entry) {
  for (const listener of listeners) {
    try {
      listener(entry);
    } catch (err) {
      console.error('Output listener error:', err);
    }
  }
}

export function triggerBrowserDownload(blobOrFile, fileName) {
  const url = URL.createObjectURL(blobOrFile);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Central output pipeline called by every tool when exporting/generating a file.
 * @param {Object} params
 * @param {Blob|File} params.blob - Generated output Blob or File
 * @param {string} params.fileName - Target filename including extension
 * @param {string} [params.mimeType] - Optional MIME type override
 * @param {string} params.sourceTool - Tool identifier ('read-edit' | 'create' | 'pdf-to-pages' | 'pages-to-pdf')
 * @param {number} [params.pageCount] - Optional page count metadata
 * @param {boolean} [params.autoDownload=true] - Whether to trigger browser download immediately
 * @returns {Promise<{ id: string, file: File, fileName: string, size: number, mimeType: string, sourceTool: string, pageCount?: number, createdAt: number, driveStatus: string }>}
 */
export async function handleGeneratedOutput({
  blob,
  fileName,
  mimeType,
  sourceTool,
  pageCount,
  autoDownload = true,
}) {
  if (!blob) {
    throw new Error('No output Blob/File provided to handleGeneratedOutput.');
  }

  const resolvedType = mimeType || blob.type || 'application/octet-stream';
  const file =
    blob instanceof File && blob.name === fileName
      ? blob
      : new File([blob], fileName, { type: resolvedType, lastModified: Date.now() });

  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    fileName: file.name,
    size: file.size,
    mimeType: file.type,
    sourceTool,
    pageCount,
    createdAt: Date.now(),
    driveStatus: driveUploadAdapter ? 'uploading' : 'local-only',
  };

  if (autoDownload) {
    triggerBrowserDownload(file, file.name);
  }

  notifyListeners(entry);

  if (driveUploadAdapter) {
    try {
      await driveUploadAdapter(file, entry);
      notifyListeners({ ...entry, driveStatus: 'uploaded' });
    } catch (err) {
      console.error('Google Drive upload failed:', err);
      notifyListeners({ ...entry, driveStatus: 'error', driveError: err?.message || 'Upload failed' });
    }
  }

  return entry;
}
