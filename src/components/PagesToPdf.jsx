import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Download, FileImage, Images, Trash2 } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { handleGeneratedOutput } from '../utils/outputHandler.js';

export default function PagesToPdf() {
  const [images, setImages] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const urls = images.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [images]);

  function addFiles(fileList) {
    const incoming = Array.from(fileList || []).filter((file) => file.type.startsWith('image/'));
    if (incoming.length !== fileList?.length) setError('Only image files can be added.');
    else setError('');
    setImages((current) => [...current, ...incoming]);
  }

  function moveImage(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    setImages((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function createPdf() {
    if (!images.length || busy) return;
    setBusy(true);
    setError('');
    try {
      const pdf = await PDFDocument.create();
      for (const file of images) {
        let embedded;
        const data = await file.arrayBuffer();
        try {
          embedded = file.type === 'image/png' ? await pdf.embedPng(data) : await pdf.embedJpg(data);
        } catch {
          const image = new Image();
          image.src = URL.createObjectURL(file);
          await image.decode();
          const canvas = window.document.createElement('canvas');
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          canvas.getContext('2d').drawImage(image, 0, 0);
          const pngBlob = await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error(`Could not process ${file.name}.`)), 'image/png'));
          embedded = await pdf.embedPng(await pngBlob.arrayBuffer());
          URL.revokeObjectURL(image.src);
        }
        const scale = Math.min(1, 540 / embedded.width, 700 / embedded.height);
        const width = embedded.width * scale;
        const height = embedded.height * scale;
        const page = pdf.addPage([width, height]);
        page.drawImage(embedded, { x: 0, y: 0, width, height });
      }
      const bytes = await pdf.save();
      await handleGeneratedOutput({
        blob: new Blob([bytes], { type: 'application/pdf' }),
        fileName: 'images-merged.pdf',
        sourceTool: 'pages-to-pdf',
        pageCount: images.length,
      });
    } catch (createError) {
      setError(`Could not create PDF: ${createError.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div><h2 className="font-bold">Merge images into a PDF</h2><p className="mt-1 text-sm text-slate-500">Add photos, arrange their order, and export one PDF.</p></div>
        <div className="flex gap-2">
          <label className="secondary-button cursor-pointer"><Images size={17} />Add images<input type="file" accept="image/*" multiple className="sr-only" onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }} /></label>
          <button className="primary-button" onClick={createPdf} disabled={!images.length || busy}><Download size={17} />{busy ? 'Creating…' : 'Create PDF'}</button>
        </div>
      </div>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
      {images.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {images.map((file, index) => (
            <article key={`${file.name}-${file.lastModified}-${index}`} className="panel overflow-hidden">
              <img src={previewUrls[index]} alt={file.name} className="h-52 w-full bg-slate-100 object-contain dark:bg-slate-900" />
              <div className="flex items-center justify-between gap-2 p-3">
                <span className="min-w-0 truncate text-sm font-semibold">{index + 1}. {file.name}</span>
                <div className="flex shrink-0">
                  <button className="icon-button" onClick={() => moveImage(index, -1)} disabled={index === 0} aria-label="Move image up"><ArrowUp size={16} /></button>
                  <button className="icon-button" onClick={() => moveImage(index, 1)} disabled={index === images.length - 1} aria-label="Move image down"><ArrowDown size={16} /></button>
                  <button className="icon-button text-rose-600" onClick={() => setImages((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove image"><Trash2 size={16} /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <label className="panel flex min-h-64 cursor-pointer flex-col items-center justify-center p-8 text-center">
          <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"><FileImage size={25} /></span>
          <span className="font-bold">Choose photos or images</span><span className="mt-2 max-w-sm text-sm text-slate-500">Select multiple images from your phone or computer to make a PDF.</span>
          <input type="file" accept="image/*" multiple className="sr-only" onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }} />
        </label>
      )}
    </section>
  );
}
