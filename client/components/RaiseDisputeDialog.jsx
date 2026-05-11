import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { api } from '@/lib/api';

const DISPUTE_TYPES = [
  { value: 'quantity_mismatch', label: 'Quantity mismatch' },
  { value: 'quality_mismatch',  label: 'Quality mismatch' },
  { value: 'non_delivery',      label: 'Non-delivery' },
  { value: 'damaged_item',      label: 'Damaged item' },
  { value: 'other',             label: 'Other' },
];

/**
 * Small reusable "Raise dispute" button + dialog.
 * Props:
 *   triggerLabel?: string (default 'Raise dispute')
 *   variant?: string (button variant)
 *   relatedInventoryId?: string
 *   againstUserId?: string
 *   onSubmitted?: () => void
 */
export default function RaiseDisputeDialog({
  triggerLabel = 'Raise dispute',
  variant = 'outline',
  relatedInventoryId,
  againstUserId,
  onSubmitted,
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(DISPUTE_TYPES[0].value);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async () => {
    if (description.trim().length < 5) {
      setErr('Description must be at least 5 characters.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.post('/api/disputes', {
        type,
        description: description.trim(),
        relatedInventoryId,
        againstUserId,
      });
      setOpen(false);
      setDescription('');
      onSubmitted?.();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant={variant} size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <AlertTriangle className="w-4 h-4" /> {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" /> Raise a dispute
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
              >
                {DISPUTE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Describe the issue</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="What happened? Include any details admin should know."
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm resize-none"
              />
            </div>
            {err && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{err}</p>}
            <Button onClick={submit} disabled={busy} className="w-full gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
              File dispute
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
