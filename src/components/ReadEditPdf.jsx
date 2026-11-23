import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Download, FileUp, Minus, Plus, Trash2 } from 'lucide-react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { pdfjsLib } from '../utils/pdfWorker.js';
import { handleGeneratedOutput } from '../utils/outputHandler.js';

export default function ReadEditPdf() {
  const [source, setSource] = useState(null);
  const [pageOrder, setPageOrder] = useState([]);
  const [zoom, setZoom] = useState(1);
  const [selectedPage, setSelectedPage] = useState(1);
  const [text, setText] = useState('');
  const [annotations, setAnnotations] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canvases = useRef([]);

  useEffect(() => {
    if (!source) return undefined;
    let cancelled = false;
    const tasks = [];
    async function renderPages() {
      try {
        for (let position = 0; position < pageOrder.length; position += 1) {
          const originalIndex = pageOrder[position];
          const canvas = canvases.current[position];
          if (!canvas || cancelled) continue;
          const page = await source.document.getPage(originalIndex + 1);
          const viewport = page.getViewport({ scale: zoom });
          const context = canvas.getContext('2d');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const task = page.render({ canvasContext: context, viewport });
          tasks.push(task);
          await task.promise;
        }
      } catch (renderError) {
        if (!cancelled) setError(`Could not render this PDF: ${renderError.message}`);
      }
    }
    renderPages();
    return () => {
      cancelled = true;
      tasks.forEach((task) => task.cancel());
    };
  }, [source, pageOrder, zoom]);

  async function loadFile(file) {
    if (!file) return;
    setError('');
    try {
      const bytes = await file.arrayBuffer();
      const document = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
      setSource({ file, bytes, document });
      setPageOrder(Array.from({ length: document.numPages }, (_, index) => index));
      setAnnotations({});
      setSelectedPage(1);
    } catch (loadError) {
      setError(`Could not open this PDF: ${loadError.message}`);
    }
  }

  function movePage(position, direction) {
    const target = position + direction;
    if (target < 0 || target >= pageOrder.length) return;
    setPageOrder((pages) => {
      const next = [...pages];
      [next[position], next[target]] = [next[target], next[position]];
      return next;
    });
  }

  function deletePage(position) {
    setPageOrder((pages) => pages.filter((_, index) => index !== position));
    setSelectedPage((page) => Math.min(page, Math.max(1, pageOrder.length - 1)));
  }

  function addText() {
    if (!text.trim() || !pageOrder.length) return;
    const originalIndex = pageOrder[selectedPage - 1];
    setAnnotations((existing) => ({ ...existing, [originalIndex]: [...(existing[originalIndex] || []), text.trim()] }));
    setText('');
  }

  async function exportPdf() {
    if (!source || !pageOrder.length || busy) return;
    setBusy(true);
    setError('');
    try {
      const original = await PDFDocument.load(source.bytes);
      const output = await PDFDocument.create();
      const pages = await output.copyPages(original, pageOrder);
      const font = await output.embedFont(StandardFonts.Helvetica);
      pages.forEach((page, position) => {
        output.addPage(page);
        const note = annotations[pageOrder[position]] || [];
        note.forEach((value, index) => {
          page.drawText(value, {
            x: 48,
            y: 48 + index * 22,
            size: 15,
            font,
            color: rgb(0.18, 0.2, 0.28),
            maxWidth: page.getWidth() - 96,
          });
        });
      });
      const bytes = await output.save();
      await handleGeneratedOutput({
        blob: new Blob([bytes], { type: 'application/pdf' }),
        fileName: source.file.name.replace(/\.pdf$/i, '') + '-edited.pdf',
        sourceTool: 'read-edit',
        pageCount: pages.length,
      });
    } catch (exportError) {
      setError(`Could not export PDF: ${exportError.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div><h2 className="font-bold">Read and edit a PDF</h2><p className="mt-1 text-sm text-slate-500">Reorder or remove pages, add text, then export.</p></div>
        <label className="primary-button cursor-pointer"><FileUp size={17} />{source ? 'Choose another PDF' : 'Upload PDF'}<input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => loadFile(event.target.files?.[0])} /></label>
      </div>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
      {source && (
        <>
          <div className="panel flex flex-wrap items-center justify-between gap-3 p-3">
            <p className="min-w-0 truncate text-sm font-semibold">{source.file.name} <span className="font-normal text-slate-500">· {pageOrder.length} pages</span></p>
            <div className="flex items-center gap-2">
              <button className="icon-button" onClick={() => setZoom((value) => Math.max(0.6, +(value - 0.2).toFixed(1)))} aria-label="Zoom out"><Minus size={17} /></button>
              <span className="w-12 text-center text-xs font-semibold">{Math.round(zoom * 100)}%</span>
              <button className="icon-button" onClick={() => setZoom((value) => Math.min(2, +(value + 0.2).toFixed(1)))} aria-label="Zoom in"><Plus size={17} /></button>
              <button className="primary-button" onClick={exportPdf} disabled={busy || !pageOrder.length}><Download size={16} />{busy ? 'Exporting…' : 'Export PDF'}</button>
            </div>
          </div>
          <div className="panel flex flex-col gap-3 p-3 sm:flex-row sm:items-end sm:p-4">
            <label className="flex-1 text-sm font-semibold">Add text on page
              <div className="mt-1 flex gap-2">
                <select className="field w-24" value={selectedPage} onChange={(event) => setSelectedPage(Number(event.target.value))}>
                  {pageOrder.map((_, index) => <option key={`${index + 1}`} value={index + 1}>Page {index + 1}</option>)}
                </select>
                <input className="field min-w-0 flex-1" value={text} onChange={(event) => setText(event.target.value)} placeholder="Type text or watermark" />
              </div>
            </label>
            <button className="secondary-button" onClick={addText} disabled={!text.trim() || !pageOrder.length}>Add text</button>
          </div>
          <div className="space-y-4">
            {pageOrder.map((originalIndex, position) => (
              <article key={`${source.file.name}-${originalIndex}`} className="panel overflow-hidden">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Page {position + 1}{annotations[originalIndex]?.length ? ' · text added' : ''}</span>
                  <div className="flex gap-1">
                    <button className="icon-button" onClick={() => movePage(position, -1)} disabled={position === 0} aria-label={`Move page ${position + 1} up`}><ArrowUp size={16} /></button>
                    <button className="icon-button" onClick={() => movePage(position, 1)} disabled={position === pageOrder.length - 1} aria-label={`Move page ${position + 1} down`}><ArrowDown size={16} /></button>
                    <button className="icon-button text-rose-600" onClick={() => deletePage(position)} aria-label={`Delete page ${position + 1}`}><Trash2 size={16} /></button>
                  </div>
                </div>
                <div className="overflow-auto bg-slate-100 p-2 dark:bg-slate-900 sm:p-4">
                  <canvas ref={(element) => { canvases.current[position] = element; }} className="mx-auto h-auto max-w-full bg-white shadow-sm" />
                </div>
              </article>
            ))}
            {!pageOrder.length && <p className="panel p-8 text-center text-sm text-slate-500">All pages removed. Upload another PDF to continue.</p>}
          </div>
        </>
      )}
      {!source && <div className="panel flex min-h-64 flex-col items-center justify-center p-8 text-center"><div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"><FileUp size={25} /></div><h3 className="font-bold">Start with a PDF</h3><p className="mt-2 max-w-sm text-sm text-slate-500">Choose a file to read its pages, add text, and rearrange or remove pages.</p></div>}
    </section>
  );
}
