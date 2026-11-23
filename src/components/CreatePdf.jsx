import { useState } from 'react';
import { Download, FilePlus2, Heading, Minus, Plus, Type } from 'lucide-react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { handleGeneratedOutput } from '../utils/outputHandler.js';

function wrapText(text, font, size, maxWidth) {
  const lines = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}

export default function CreatePdf() {
  const [title, setTitle] = useState('A new document');
  const [blocks, setBlocks] = useState([{ type: 'paragraph', text: '' }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function updateBlock(index, text) {
    setBlocks((current) => current.map((block, position) => position === index ? { ...block, text } : block));
  }

  function addBlock(type) {
    setBlocks((current) => [...current, { type, text: '' }]);
  }

  async function createPdf() {
    setBusy(true);
    setError('');
    try {
      const pdf = await PDFDocument.create();
      const regular = await pdf.embedFont(StandardFonts.Helvetica);
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
      const pageSize = [612, 792];
      const margin = 56;
      let page = pdf.addPage(pageSize);
      let y = page.getHeight() - margin;
      const ensureRoom = (height) => {
        if (y - height < margin) {
          page = pdf.addPage(pageSize);
          y = page.getHeight() - margin;
        }
      };

      const titleLines = wrapText(title.trim() || 'Untitled document', bold, 25, page.getWidth() - margin * 2);
      titleLines.forEach((line) => {
        ensureRoom(36);
        page.drawText(line, { x: margin, y, size: 25, font: bold, color: rgb(0.12, 0.16, 0.26) });
        y -= 34;
      });
      y -= 12;

      for (const block of blocks) {
        if (!block.text.trim()) continue;
        const isHeading = block.type === 'heading';
        const font = isHeading ? bold : regular;
        const size = isHeading ? 17 : 11;
        const lineHeight = isHeading ? 24 : 17;
        const lines = wrapText(block.text, font, size, page.getWidth() - margin * 2);
        ensureRoom(lineHeight + 8);
        for (const line of lines) {
          ensureRoom(lineHeight);
          page.drawText(line, { x: margin, y, size, font, color: isHeading ? rgb(0.24, 0.28, 0.4) : rgb(0.2, 0.22, 0.27) });
          y -= lineHeight;
        }
        y -= isHeading ? 8 : 13;
      }

      const bytes = await pdf.save();
      const fileBase = (title.trim() || 'document').replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim() || 'document';
      await handleGeneratedOutput({
        blob: new Blob([bytes], { type: 'application/pdf' }),
        fileName: `${fileBase}.pdf`,
        sourceTool: 'create',
        pageCount: pdf.getPageCount(),
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
        <div><h2 className="font-bold">Create a document</h2><p className="mt-1 text-sm text-slate-500">Write and export a clean, print-ready PDF.</p></div>
        <button className="primary-button" onClick={createPdf} disabled={busy}><Download size={17} />{busy ? 'Creating…' : 'Download PDF'}</button>
      </div>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
      <div className="panel space-y-5 p-4 sm:p-7">
        <label className="block text-sm font-semibold">Document title
          <input className="field mt-2 text-lg font-bold" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Enter a title" />
        </label>
        <div className="space-y-4">
          {blocks.map((block, index) => (
            <div key={index} className="relative rounded-2xl border border-slate-200 p-3 dark:border-slate-700 sm:p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">{block.type === 'heading' ? <Heading size={15} /> : <Type size={15} />}{block.type}</span>
                {blocks.length > 1 && <button className="text-xs font-semibold text-rose-600" onClick={() => setBlocks((current) => current.filter((_, position) => position !== index))}>Remove</button>}
              </div>
              {block.type === 'heading' ? (
                <input className="field font-bold" value={block.text} onChange={(event) => updateBlock(index, event.target.value)} placeholder="Section heading" />
              ) : (
                <textarea className="field min-h-32 resize-y leading-7" value={block.text} onChange={(event) => updateBlock(index, event.target.value)} placeholder="Write your paragraph here. Each line will be formatted into your PDF." />
              )}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button className="secondary-button" onClick={() => addBlock('heading')}><Plus size={16} />Add heading</button>
          <button className="secondary-button" onClick={() => addBlock('paragraph')}><Plus size={16} />Add paragraph</button>
        </div>
      </div>
      <div className="flex items-center gap-2 px-1 text-xs text-slate-500"><FilePlus2 size={15} />PDFs are generated locally in your browser.</div>
    </section>
  );
}
