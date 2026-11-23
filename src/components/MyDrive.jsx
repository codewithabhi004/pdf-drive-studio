import { useCallback, useEffect, useState } from 'react';
import { Cloud, Download, ExternalLink, FileText, RefreshCw } from 'lucide-react';
import { downloadDriveFile, getDrivePreviewUrl, listDriveFiles } from '../services/googleDrive.js';
import { formatBytes, triggerBrowserDownload } from '../utils/outputHandler.js';

export default function MyDrive({ account, onSignIn }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState('');

  const refresh = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    setError('');
    try {
      setFiles(await listDriveFiles());
    } catch (listError) {
      setError(listError.message);
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => { refresh(); }, [refresh]);

  async function download(file) {
    setDownloading(file.id);
    setError('');
    try {
      triggerBrowserDownload(await downloadDriveFile(file), file.name);
    } catch (downloadError) {
      setError(`Could not download file: ${downloadError.message}`);
    } finally {
      setDownloading('');
    }
  }

  return (
    <section className="space-y-4">
      <div className="panel flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div><h2 className="font-bold">Your PDF Drive Studio folder</h2><p className="mt-1 text-sm text-slate-500">Files saved to PDF_Drive_Studio in your Google Drive.</p></div>
        {account && <button className="secondary-button" onClick={refresh} disabled={loading}><RefreshCw size={16} className={loading ? 'animate-spin' : ''} />Refresh</button>}
      </div>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
      {!account ? (
        <div className="panel flex min-h-64 flex-col items-center justify-center p-8 text-center">
          <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"><Cloud size={25} /></span>
          <h3 className="font-bold">Sign in to see your files</h3><p className="mt-2 max-w-sm text-sm text-slate-500">Connect a Google account to browse downloads saved from this app.</p>
          <button className="primary-button mt-5" onClick={onSignIn}><Cloud size={17} />Sign in with Google</button>
        </div>
      ) : loading && files.length === 0 ? (
        <div className="panel p-10 text-center text-sm text-slate-500">Loading your Drive files…</div>
      ) : files.length ? (
        <div className="panel divide-y divide-slate-100 dark:divide-slate-800">
          {files.map((file) => (
            <article key={file.id} className="flex items-center gap-3 p-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"><FileText size={20} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{file.name}</p>
                <p className="mt-1 text-xs text-slate-500">{formatBytes(Number(file.size))}{file.modifiedTime ? ` · ${new Date(file.modifiedTime).toLocaleDateString()}` : ''}</p>
              </div>
              <a className="icon-button" href={getDrivePreviewUrl(file)} target="_blank" rel="noopener noreferrer" aria-label={`Open ${file.name}`}><ExternalLink size={17} /></a>
              <button className="icon-button" onClick={() => download(file)} disabled={downloading === file.id} aria-label={`Download ${file.name}`}><Download size={17} /></button>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel p-10 text-center"><p className="font-semibold">No saved files yet</p><p className="mt-2 text-sm text-slate-500">Create or export a document and it will appear here.</p></div>
      )}
    </section>
  );
}
