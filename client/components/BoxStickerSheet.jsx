import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Printer } from 'lucide-react';
import { Button } from './ui/button';

/**
 * Printable per-box QR stickers. The QR encodes the signed payload (TR + Box ID);
 * the visible text shows item name, net weight, transaction number and box id.
 *
 * Props:
 *   boxes    : Array<{ boxId, transactionNo, qrPayload, itemName, netWeightKg, unit, boxSeq, boxCount, hubName }>
 *   onPrint? : () => void   — called when "Print all" is pressed (use to confirm-print server-side)
 */
export default function BoxStickerSheet({ boxes = [], onPrint }) {
  const [images, setImages] = useState({}); // qrPayload -> data URL

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        boxes.map(async (b) => {
          try {
            return [b.qrPayload, await QRCode.toDataURL(b.qrPayload, { width: 180, margin: 1 })];
          } catch {
            return [b.qrPayload, ''];
          }
        }),
      );
      if (!cancelled) setImages(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxes.map((b) => b.qrPayload).join('|')]);

  if (!boxes.length) return null;

  const printAll = () => {
    onPrint?.();
    const stickers = boxes
      .map(
        (b) => `
      <div class="sticker">
        <img src="${images[b.qrPayload] || ''}" alt="QR" />
        <div class="info">
          <div class="cat">${b.itemName || ''}</div>
          <div class="row">Box <strong>${b.boxSeq} of ${b.boxCount}</strong></div>
          ${b.netWeightKg != null ? `<div class="row">Net wt: <strong>${b.netWeightKg} kg</strong></div>` : ''}
          <div class="row">Txn: ${b.transactionNo}</div>
          <div class="code">${b.boxId}</div>
          <div class="foot">${b.hubName ? 'Hub: ' + b.hubName : ''} · E-Waste Hub</div>
        </div>
      </div>`,
      )
      .join('');
    const html = `<!doctype html><html><head><title>${boxes[0]?.itemName || 'Item'} box stickers</title>
      <style>
        @page { size: 80mm 50mm; margin: 4mm; }
        body { font-family: -apple-system, Segoe UI, Arial, sans-serif; margin: 0; color: #111; }
        .sticker { display: flex; gap: 10px; border: 1px solid #111; border-radius: 6px; padding: 8px; width: 300px; margin-bottom: 8px; page-break-after: always; }
        .sticker img { width: 120px; height: 120px; }
        .info { flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
        .cat { font-weight: 700; font-size: 14px; }
        .row { font-size: 12px; }
        .code { font-family: ui-monospace, Menlo, monospace; font-size: 11px; font-weight: 700; color: #111; margin-top: 2px; }
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
          {boxes.length} box sticker{boxes.length > 1 ? 's' : ''} — print one per box
        </p>
        <Button size="sm" variant="outline" onClick={printAll} className="gap-1 h-8 text-xs">
          <Printer className="w-3.5 h-3.5" /> Print all
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
        {boxes.map((b) => (
          <div key={b.boxId} className="border border-border rounded-md p-2 bg-white text-black flex gap-2 items-center">
            {images[b.qrPayload] ? (
              <img src={images[b.qrPayload]} alt={`QR ${b.boxId}`} className="w-20 h-20 flex-shrink-0" />
            ) : (
              <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center text-[10px] text-gray-400">…</div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-xs truncate">{b.itemName}</p>
              <p className="text-[11px]">
                Box {b.boxSeq} of {b.boxCount}
                {b.netWeightKg != null ? ` · ${b.netWeightKg} kg` : ''}
              </p>
              <p className="text-[10px] text-gray-500">{b.transactionNo}</p>
              <p className="text-[11px] font-mono font-semibold break-all">{b.boxId}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
