import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Printer } from 'lucide-react';
import { Button } from './ui/button';

/**
 * Printable single QR sticker. The QR image is generated LOCALLY with the
 * `qrcode` package (no external service), so it works offline.
 *
 * Props:
 *   qrCode     string (required) — the data encoded in the QR
 *   category   string — item name on the right of the sticker
 *   qty        number
 *   unit       string
 *   weightKg   number | null
 *   hubName    string (optional footer)
 *   showPrintButton boolean
 */
export default function QRSticker({
  qrCode,
  category,
  qty,
  unit,
  weightKg,
  hubName,
  showPrintButton = true,
}) {
  const [qrImage, setQrImage] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!qrCode) return;
    QRCode.toDataURL(qrCode, { width: 180, margin: 1 })
      .then((url) => !cancelled && setQrImage(url))
      .catch(() => !cancelled && setQrImage(''));
    return () => {
      cancelled = true;
    };
  }, [qrCode]);

  if (!qrCode) return null;

  const handlePrint = () => {
    const html = `<!doctype html><html><head><title>${category} sticker</title>
      <style>
        @page { size: 80mm 50mm; margin: 4mm; }
        body { font-family: -apple-system, Segoe UI, Arial, sans-serif; margin: 0; color: #111; }
        .sticker { display: flex; gap: 10px; border: 1px solid #111; border-radius: 6px; padding: 8px; width: 300px; }
        .qr img { width: 120px; height: 120px; }
        .info { flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
        .cat { font-weight: 700; font-size: 14px; }
        .row { font-size: 12px; }
        .code { font-family: ui-monospace, Menlo, monospace; font-size: 10px; color: #444; word-break: break-all; }
        .foot { font-size: 10px; color: #666; margin-top: 4px; }
      </style>
    </head><body>
      <div class="sticker">
        <div class="qr"><img src="${qrImage}" alt="QR" /></div>
        <div class="info">
          <div>
            <div class="cat">${category}</div>
            <div class="row">Qty: <strong>${qty}${unit ? ' ' + unit : ''}</strong></div>
            ${weightKg != null && weightKg !== '' ? `<div class="row">Weight: <strong>${weightKg} kg</strong></div>` : ''}
            <div class="code">${qrCode}</div>
          </div>
          <div class="foot">${hubName ? 'Hub: ' + hubName : ''} · E-Waste Hub</div>
        </div>
      </div>
      <script>window.onload=()=>{setTimeout(()=>{window.print();window.close();},250);}</script>
    </body></html>`;
    const w = window.open('', '_blank', 'width=480,height=320');
    if (!w) return alert('Pop-up blocked. Please allow pop-ups to print stickers.');
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="border border-border rounded-md p-3 bg-white text-black flex gap-3 items-center max-w-md">
      {qrImage ? (
        <img src={qrImage} alt={`QR ${qrCode}`} className="w-28 h-28 flex-shrink-0" />
      ) : (
        <div className="w-28 h-28 flex-shrink-0 flex items-center justify-center text-xs text-gray-400">…</div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-base truncate">{category}</p>
        <p className="text-sm">
          Qty: <strong>{qty}{unit ? ` ${unit}` : ''}</strong>
        </p>
        {weightKg != null && weightKg !== '' && (
          <p className="text-sm">Weight: <strong>{weightKg} kg</strong></p>
        )}
        <p className="text-[11px] text-gray-600 font-mono break-all">{qrCode}</p>
        {hubName && <p className="text-[11px] text-gray-500">Hub: {hubName}</p>}
        {showPrintButton && (
          <Button size="sm" variant="outline" onClick={handlePrint} className="mt-2 gap-1 h-7 text-xs">
            <Printer className="w-3 h-3" /> Print sticker
          </Button>
        )}
      </div>
    </div>
  );
}
