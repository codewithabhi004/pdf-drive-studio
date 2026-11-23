import { useState } from 'react';
import { Download, FileImage, FileUp } from 'lucide-react';
import { pdfjsLib } from '../utils/pdfWorker.js';
import { handleGeneratedOutput } from '../utils/outputHandler.js';

export default function PdfToPages() {
  const [pages, setPages] = useState([]);
  const [fileName, setFileName] = useState('');
  const [format, setFormat] = useState('png');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function convert(file) {
    if (!file) return;
    setBusy(true);
    setPages([]);
    setError('');
    setFileName(file.name.replace(/\.pdf$/i, '') || 'page');
    try {
      const document = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      const rendered = [];
      for (let number = 1; number <= document.numPages; number += 1) {
        const page = await document.getPage(number);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        rendered.push({ number, dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height });
      }
      setPages(rendered);
      await document.destroy();
    } catch (convertError) {
      setError(`Could not convert PDF pages: ${convertError.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function downloadPage(page) {
    const response = await fetch(page.dataUrl);
    const blob = await response.blob();
    let outputBlob = blob;
    if (format === 'jpg') {
      const image = new Image();
      image.src = page.dataUrl;
      await image.decode();
      const canvas = window.document.createElement('canvas');
      canvas.width = page.width;
      canvas.height = page.height;
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      outputBlob = await new Promise((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Could not encode JPG image.')), 'image/jpeg', 0.92));
    }
    await handleGeneratedOutput({
      blob: outputBlob,
      fileName: `${fileName}-page-${page.number}.${format}`,
      mimeType: format === 'jpg' ? 'image/jpeg' : 'image/png',
      sourceTool: 'pdf-to-pages',
      pageCount: pages.length,
    });
  }

  async function downloadAll() {
    setBusy(true);
    try {
      for (const page of pages) {
        await downloadPage(page);
        await new Promise((resolve) => window.setTimeout(resolve, 250));
      }
    } catch (downloadError) {
      setError(`Could not download every page: ${downloadError.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div><h2 className="font-bold">Convert PDF pages to images</h2><p className="mt-1 text-sm text-slate-500">Render every page and save as PNG or JPG.</p></div>
        <label className="primary-button cursor-pointer"><FileUp size={17} />{busy ? 'Working…' : 'Choose PDF'}<input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => convert(event.target.files?.[0])} /></label>
      </div>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
      {pages.length > 0 && (
        <>
          <div className="panel flex flex-wrap items-center justify-between gap-3 p-3">
            <span className="text-sm font-semibold">{pages.length} pages ready</span>
            <div className="flex gap-2">
              <select className="field w-auto py-2" value={format} onChange={(event) => setFormat(event.target.value)} aria-label="Image format">
                <option value="png">PNG</option><option value="jpg">JPG</option>
              </select>
              <button className="primary-button" onClick={downloadAll} disabled={busy}><Download size={16} />Download All</button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {pages.map((page) => (
              <article key={page.number} className="panel overflow-hidden">
                <div className="flex items-center justify-between p-3"><span className="text-sm font-bold">Page {page.number}</span><button className="secondary-button !px-3 !py-2" onClick={() => downloadPage(page)}><Download size={15} /><span className="hidden sm:inline">Download</span></button></div>
                <img src={page.dataUrl} alt={`PDF page ${page.number}`} className="max-h-96 w-full bg-slate-100 object-contain dark:bg-slate-900" loading="lazy" />
              </article>
            ))}
          </div>
        </>
      )}
      {!pages.length && !busy && <div className="panel flex min-h-64 flex-col items-center justify-center p-8 text-center"><div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"><FileImage size={25} /></div><h3 className="font-bold">Every page, as an image</h3><p className="mt-2 max-w-sm text-sm text-slate-500">Upload a PDF to render all its pages. Download images individually or together.</p></div>}
      {busy && !pages.length && <p className="panel p-8 text-center text-sm text-slate-500">Rendering pages…</p>}
    </section>
  );
}
