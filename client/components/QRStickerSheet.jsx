import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Printer } from 'lucide-react';
import { Button } from './ui/button';

/**
 * Renders one printable QR sticker per physical unit. QR images are generated
 * LOCALLY with the `qrcode` package (no external service), so they work offline.
 *
 * Props:
 *   codes      string[] — one QR payload per unit (required)
 *   category   string
 *   qty        number   — quantity per the whole batch
 *   unit       string
 *   weightKg   number | null
 *   hubName    string
 *   unitCount  number   — true unit count (codes may be capped)
 */
export default function QRStickerSheet({ codes = [], category, qty, unit, weightKg, hubName, unitCount }) {
  const [images, setImages] = useState({}); // code -> data URL

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        codes.map(async (c) => {
          try {
            return [c, await QRCode.toDataURL(c, { width: 180, margin: 1 })];
          } catch {
            return [c, ''];
          }
        })
      );
      if (!cancelled) setImages(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codes.join('|')]);

  if (!codes.length) return null;
  const total = unitCount || codes.length;

  const printAll = () => {
    const stickers = codes
      .map(
        (c, i) => `
      <div class="sticker">
        <img src="${images[c] || ''}" alt="QR" />
        <div class="info">
          <div class="cat">${category || ''}</div>
          <div class="row">Unit <strong>${i + 1} of ${total}</strong></div>
          ${weightKg != null && weightKg !== '' ? `<div class="row">Weight: ${weightKg} kg</div>` : ''}
          <div class="code">${c}</div>
          <div class="foot">${hubName ? 'Hub: ' + hubName : ''} · E-Waste Hub</div>
        </div>
      </div>`
      )
      .join('');
    const html = `<!doctype html><html><head><title>${category || 'Item'} stickers</title>
      <style>
        @page { size: 80mm 50mm; margin: 4mm; }
        body { font-family: -apple-system, Segoe UI, Arial, sans-serif; margin: 0; color: #111; }
        .sticker { display: flex; gap: 10px; border: 1px solid #111; border-radius: 6px; padding: 8px; width: 300px; margin-bottom: 8px; page-break-after: always; }
        .sticker img { width: 120px; height: 120px; }
        .info { flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
        .cat { font-weight: 700; font-size: 14px; }
        .row { font-size: 12px; }
        .code { font-family: ui-monospace, Menlo, monospace; font-size: 9px; color: #444; word-break: break-all; margin-top: 2px; }
        .foot { font-size: 10px; color: #666; margin-top: 4px; }
      </style></head><body>${stickers}
      <script>window.onload=()=>{setTimeout(()=>{window.print();window.close();},300);}</script>
      </body></html>`;
    const w = window.open('', '_blank', 'width=520,height=640');
    if (!w) return alert('Pop-up blocked. Please allow pop-ups to print stickers.');
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {total} unit sticker{total > 1 ? 's' : ''} — one per item
          {codes.length < total && <span className="text-muted-foreground"> (showing first {codes.length})</span>}
        </p>
        <Button size="sm" variant="outline" onClick={printAll} className="gap-1 h-8 text-xs">
          <Printer className="w-3.5 h-3.5" /> Print all
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
        {codes.map((c, i) => (
          <div key={c} className="border border-border rounded-md p-2 bg-white text-black flex gap-2 items-center">
            {images[c] ? (
              <img src={images[c]} alt={`QR ${c}`} className="w-20 h-20 flex-shrink-0" />
            ) : (
              <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center text-[10px] text-gray-400">…</div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-xs truncate">{category}</p>
              <p className="text-[11px]">
                Unit {i + 1} of {total}
                {unit ? ` · ${qty} ${unit}` : ''}
              </p>
              <p className="text-[9px] text-gray-500 font-mono break-all">{c}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
