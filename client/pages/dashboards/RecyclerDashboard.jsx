import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Package, LogOut, Factory, Truck, Loader2, CheckCircle2, Boxes, Clock, Building2, Phone, MapPin, Check, Weight,
  ClipboardList, Plus, Send, Ban, Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import NotificationsBell from '@/components/NotificationsBell';
import RaiseDisputeDialog from '@/components/RaiseDisputeDialog';

const REQUEST_CATEGORIES = [
  'Old Laptops', 'Mobile Phones', 'Electronic Cables', 'Monitors',
  'Batteries', 'Circuit Boards', 'Semiconductors', 'Printers', 'Keyboards & Mouse', 'Other',
];
const emptyReqForm = () => ({ category: REQUEST_CATEGORIES[0], quantity: 10, unit: 'kg', note: '', targetDate: '' });

export default function RecyclerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [agents, setAgents] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [boxGroups, setBoxGroups] = useState([]);
  const [ackBusy, setAckBusy] = useState(null); // boxId currently being acknowledged
  const [ackPaste, setAckPaste] = useState('');
  const [qualityForm, setQualityForm] = useState({}); // inventoryId -> { technicianName, rating }
  const [qualityBusy, setQualityBusy] = useState(null); // inventoryId currently being saved
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [agentId, setAgentId] = useState('');
  const [busy, setBusy] = useState(false);
  const [requests, setRequests] = useState([]);
  const [reqDialogOpen, setReqDialogOpen] = useState(false);
  const [reqForm, setReqForm] = useState(emptyReqForm);
  const [reqBusy, setReqBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [o, a, d, r, b] = await Promise.all([
        api.get('/api/recycler/orders'),
        api.get('/api/recycler/delivery-agents'),
        api.get('/api/recycler/deliveries'),
        api.get('/api/recycler/requests'),
        api.get('/api/recycler/boxes'),
      ]);
      setOrders(o?.items || []);
      setAgents(a?.agents || []);
      setDeliveries(d?.deliveries || []);
      setRequests(r?.requests || []);
      setBoxGroups(b?.items || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const submitRequest = async () => {
    if (!reqForm.category || !reqForm.quantity || Number(reqForm.quantity) < 1) {
      return alert('Pick a category and a quantity of at least 1.');
    }
    setReqBusy(true);
    try {
      await api.post('/api/recycler/requests', {
        category: reqForm.category,
        quantity: Number(reqForm.quantity),
        unit: reqForm.unit,
        note: reqForm.note || undefined,
        targetDate: reqForm.targetDate || undefined,
      });
      setReqDialogOpen(false);
      setReqForm(emptyReqForm());
      await refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setReqBusy(false);
    }
  };

  const acknowledgeBox = async (qrPayload, boxId) => {
    setAckBusy(boxId || qrPayload);
    try {
      const res = await api.post('/api/recycler/acknowledge', { scannedQr: qrPayload });
      if (!boxId) setAckPaste(''); // paste path: clear the field only after a successful ack
      if (res?.complete) alert('All boxes acknowledged — item marked received.');
      await refresh();
    } catch (err) {
      alert(err?.message || 'Could not acknowledge this box.');
    } finally {
      setAckBusy(null);
    }
  };

  const recordQuality = async (inventoryId) => {
    const form = qualityForm[inventoryId] || {};
    const technicianName = (form.technicianName || '').trim();
    const qualityRating = Number(form.rating);
    if (technicianName.length < 2) return alert('Enter the technician name (at least 2 characters).');
    if (!Number.isInteger(qualityRating) || qualityRating < 1 || qualityRating > 10) {
      return alert('Pick a quality rating from 1 to 10.');
    }
    setQualityBusy(inventoryId);
    try {
      await api.post('/api/recycler/quality', { inventoryId, technicianName, qualityRating });
      await refresh();
    } catch (err) {
      alert(err?.message || 'Could not save the quality assessment.');
    } finally {
      setQualityBusy(null);
    }
  };

  const cancelRequest = async (id) => {
    if (!confirm('Cancel this request?')) return;
    try {
      await api.post(`/api/recycler/requests/${id}/cancel`);
    } catch (err) {
      alert(err.message);
    }
    await refresh();
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const toggle = (id) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openDialog = () => {
    if (selected.size === 0) return alert('Select at least one item first.');
    const pickedHubs = new Set(
      [...selected].map((id) => orders.find((o) => o._id === id)?.hubId).filter(Boolean)
    );
    if (pickedHubs.size > 1) {
      return alert('Selected items are stored at different hubs. Please select items from a single hub only.');
    }
    setAgentId(agents[0]?._id || '');
    setDialogOpen(true);
  };

  const assignDelivery = async () => {
    if (!agentId) return alert('Please pick a delivery agent.');
    setBusy(true);
    try {
      await api.post('/api/recycler/assign-delivery', {
        inventoryIds: [...selected],
        deliveryWorkerId: agentId,
      });
      setDialogOpen(false);
      setSelected(new Set());
      await refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );

  // Awaiting pickup = assigned to me, not yet dispatched to a delivery agent.
  // Dispatched = a delivery agent is assigned but hasn't picked up yet.
  const matched = orders.filter((o) => o.status === 'matched' && !o.deliveryWorkerId);
  const dispatched = orders.filter((o) => o.status === 'matched' && o.deliveryWorkerId);
  const inTransit = orders.filter((o) => ['in_transit'].includes(o.status));
  const received = orders.filter((o) => ['delivered', 'processed'].includes(o.status));

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary text-primary-foreground">
              <Package className="w-5 h-5" />
            </div>
            <span className="font-bold">E-Waste Hub</span>
          </Link>
          <div className="flex items-center gap-3">
            <NotificationsBell />
            <Link to="/profile">
              <Button variant="outline" size="sm" className="hidden sm:inline-flex">Profile</Button>
            </Link>
            <span className="text-sm text-muted-foreground hidden md:inline">{user?.name}</span>
            <Button variant="outline" size="sm" onClick={async () => { await logout(); navigate('/login'); }}>
              <LogOut className="w-4 h-4 mr-2" /> Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <section className="bg-gradient-to-r from-teal-500/10 to-cyan-500/10 border border-teal-500/20 rounded-lg p-8">
          <div className="flex items-center gap-3 mb-2">
            <Factory className="w-7 h-7 text-teal-600" />
            <h1 className="text-3xl font-bold">Recycler Dashboard</h1>
          </div>
          <p className="text-muted-foreground">
            Review items admin has assigned to you, dispatch a delivery agent, and track inbound shipments.
          </p>
        </section>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Awaiting pickup" value={matched.length} icon={<Clock className="w-5 h-5 text-indigo-600" />} />
          <Stat label="In transit" value={inTransit.length} icon={<Truck className="w-5 h-5 text-orange-600" />} />
          <Stat label="Received" value={received.length} icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />} />
          <Stat label="Total orders" value={orders.length} icon={<Boxes className="w-5 h-5 text-primary" />} />
        </section>

        {/* Material requests to admin */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">My material requests</h2>
              <p className="text-sm text-muted-foreground">
                Tell admin what you need. Admin sources it from hubs — hub identities stay private.
              </p>
            </div>
            <Button onClick={() => setReqDialogOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Raise request
            </Button>
          </div>

          {requests.length === 0 ? (
            <div className="p-8 rounded-lg border border-dashed text-center text-muted-foreground">
              <ClipboardList className="w-8 h-8 mx-auto mb-2" />
              No requests yet. Raise one to tell admin which category & quantity you need.
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Request</th>
                    <th className="px-3 py-2 text-left font-semibold">Category</th>
                    <th className="px-3 py-2 text-left font-semibold">Quantity</th>
                    <th className="px-3 py-2 text-left font-semibold">Allocated</th>
                    <th className="px-3 py-2 text-left font-semibold">Status</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {requests.map((r) => (
                    <tr key={r._id} className="hover:bg-muted/20">
                      <td className="px-3 py-2 font-mono text-xs">{r._id}</td>
                      <td className="px-3 py-2 font-medium">{r.category}</td>
                      <td className="px-3 py-2">{r.quantity} {r.unit}</td>
                      <td className="px-3 py-2">{r.allocatedCount || 0} item(s)</td>
                      <td className="px-3 py-2"><RequestStatus status={r.status} /></td>
                      <td className="px-3 py-2 text-right">
                        {r.status === 'pending' && (
                          <Button variant="ghost" size="sm" onClick={() => cancelRequest(r._id)} className="gap-1 text-destructive">
                            <Ban className="w-3.5 h-3.5" /> Cancel
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Assigned to you (awaiting pickup)</h2>
            <Button disabled={selected.size === 0} onClick={openDialog} className="gap-2">
              <Truck className="w-4 h-4" />
              Assign delivery agent ({selected.size})
            </Button>
          </div>

          {matched.length === 0 ? (
            <div className="p-10 rounded-lg border border-dashed text-center">
              <Factory className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No items awaiting dispatch. Wait for admin to assign new orders.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 w-8"></th>
                    <th className="px-3 py-2 text-left font-semibold">Category</th>
                    <th className="px-3 py-2 text-left font-semibold">Qty</th>
                    <th className="px-3 py-2 text-left font-semibold">Weight</th>
                    <th className="px-3 py-2 text-left font-semibold">Pickup hub</th>
                    <th className="px-3 py-2 text-left font-semibold">QR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {matched.map((it) => (
                    <tr key={it._id} className="hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(it._id)}
                          onChange={() => toggle(it._id)}
                        />
                      </td>
                      <td className="px-3 py-2 font-medium">{it.category}</td>
                      <td className="px-3 py-2">{it.actualQty} {it.unit}</td>
                      <td className="px-3 py-2">{it.weightKg != null ? `${it.weightKg} kg` : '—'}</td>
                      <td className="px-3 py-2 font-mono text-xs">{it.hubCode || '—'}</td>
                      <td className="px-3 py-2 font-mono text-xs">{it.qrCode.slice(0, 14)}…</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {dispatched.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-1">Dispatched — awaiting pickup</h2>
            <p className="text-sm text-muted-foreground mb-4">
              A delivery agent has been assigned. These items are waiting to be picked up from the hub.
            </p>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Category</th>
                    <th className="px-3 py-2 text-left font-semibold">Qty</th>
                    <th className="px-3 py-2 text-left font-semibold">Weight</th>
                    <th className="px-3 py-2 text-left font-semibold">Pickup hub</th>
                    <th className="px-3 py-2 text-left font-semibold">Delivery agent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {dispatched.map((it) => (
                    <tr key={it._id} className="hover:bg-muted/20">
                      <td className="px-3 py-2 font-medium">{it.category}</td>
                      <td className="px-3 py-2">{it.actualQty} {it.unit}</td>
                      <td className="px-3 py-2">{it.weightKg != null ? `${it.weightKg} kg` : '—'}</td>
                      <td className="px-3 py-2 font-mono text-xs">{it.hubCode || '—'}</td>
                      <td className="px-3 py-2">{it.deliveryWorkerName || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section>
          <h2 className="text-xl font-bold mb-4">Inbound deliveries</h2>
          {deliveries.length === 0 ? (
            <div className="p-6 rounded-lg border border-dashed text-center text-muted-foreground">
              No deliveries yet.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {deliveries.map((d) => (
                <div key={d._id} className="p-4 rounded-lg border border-border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold">From hub <span className="font-mono text-sm">{d.hubCode || '—'}</span></p>
                    <span className="px-2 py-0.5 rounded-full text-xs border capitalize bg-muted/40">
                      {d.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm flex items-center gap-1 text-muted-foreground">
                    <Building2 className="w-3.5 h-3.5" /> Agent: {d.deliveryWorkerName}
                    {d.deliveryWorkerPhone && (
                      <span className="flex items-center gap-1 ml-2">
                        <Phone className="w-3.5 h-3.5" /> {d.deliveryWorkerPhone}
                      </span>
                    )}
                  </p>
                  <p className="text-sm mt-1">{d.manifest.length} items</p>
                  {d.status === 'delivered' && (
                    <div className="mt-2">
                      <RaiseDisputeDialog
                        triggerLabel="Report shipment issue"
                        againstUserId={d.deliveryWorkerId}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {boxGroups.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xl font-bold mb-1">Acknowledge receipt — scan boxes</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Scan each box's QR (or tap Confirm) as it arrives. The item is marked received once every box is acknowledged.
            </p>

            <div className="mb-4 flex gap-2 max-w-md">
              <input
                aria-label="Paste a scanned box QR code"
                value={ackPaste}
                onChange={(e) => setAckPaste(e.target.value)}
                placeholder="Paste a scanned box QR…"
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
              <Button
                variant="outline"
                disabled={!ackPaste.trim() || !!ackBusy}
                onClick={() => acknowledgeBox(ackPaste.trim())}
              >
                Acknowledge
              </Button>
            </div>

            <div className="space-y-4">
              {boxGroups.map((g) => (
                <div key={g.inventoryId} className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-foreground">{g.itemName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{g.transactionNo}</p>
                    </div>
                    <span className={`text-sm font-semibold ${g.acknowledged === g.total ? 'text-green-600' : 'text-amber-600'}`}>
                      {g.acknowledged} / {g.total} acknowledged
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {g.boxes.map((b) => (
                      <div key={b.boxId} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-mono font-semibold truncate">{b.boxId}</p>
                          <p className="text-xs text-muted-foreground">
                            Box {b.boxSeq} of {b.boxCount}
                            {b.netWeightKg != null ? ` · ${b.netWeightKg} kg` : ''}
                          </p>
                        </div>
                        {b.status === 'acknowledged' ? (
                          <span className="text-green-600 inline-flex items-center gap-1 text-sm">
                            <Check className="w-4 h-4" /> Done
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!!ackBusy}
                            onClick={() => acknowledgeBox(b.qrPayload, b.boxId)}
                          >
                            {ackBusy === b.boxId ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Scan / Confirm'}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  {g.acknowledged === g.total && (
                    <div className="mt-4 pt-4 border-t border-border">
                      {g.qualityRating != null ? (
                        <div className="flex items-center gap-2 text-sm">
                          <Star className="w-4 h-4 text-amber-500" />
                          <span className="font-semibold">Quality {g.qualityRating}/10</span>
                          {g.technicianName && (
                            <span className="text-muted-foreground">· assessed by {g.technicianName}</span>
                          )}
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm font-medium mb-2">Record quality assessment</p>
                          <div className="flex flex-wrap items-end gap-3">
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">Technician name</label>
                              <input
                                type="text"
                                value={qualityForm[g.inventoryId]?.technicianName || ''}
                                onChange={(e) =>
                                  setQualityForm((f) => ({
                                    ...f,
                                    [g.inventoryId]: { ...f[g.inventoryId], technicianName: e.target.value },
                                  }))
                                }
                                placeholder="e.g. Ramesh K."
                                className="w-48 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">Quality (1–10)</label>
                              <select
                                value={qualityForm[g.inventoryId]?.rating ?? ''}
                                onChange={(e) =>
                                  setQualityForm((f) => ({
                                    ...f,
                                    [g.inventoryId]: { ...f[g.inventoryId], rating: e.target.value },
                                  }))
                                }
                                className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
                              >
                                <option value="" disabled>Rate…</option>
                                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                                  <option key={n} value={n}>{n}</option>
                                ))}
                              </select>
                            </div>
                            <Button
                              size="sm"
                              disabled={qualityBusy === g.inventoryId}
                              onClick={() => recordQuality(g.inventoryId)}
                            >
                              {qualityBusy === g.inventoryId ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save quality'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          {(() => {
            const selectedItems = [...selected]
              .map((id) => orders.find((o) => o._id === id))
              .filter(Boolean);
            const totalWeightKg = selectedItems.reduce((sum, it) => sum + (Number(it.weightKg) || 0), 0);
            const totalQty = selectedItems.reduce((sum, it) => sum + (Number(it.actualQty) || 0), 0);
            const pickupHubCode = selectedItems[0]?.hubCode || '—';
            const chosenAgent = agents.find((a) => a._id === agentId);

            const reliabilityClasses = (score) => {
              if (score >= 90) return 'bg-green-100 text-green-800 border-green-200';
              if (score >= 75) return 'bg-amber-100 text-amber-800 border-amber-200';
              return 'bg-red-100 text-red-800 border-red-200';
            };

            return (
              <>
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
                  <DialogTitle className="flex items-center gap-2.5 text-lg">
                    <div className="p-1.5 rounded-md bg-primary/10">
                      <Truck className="w-5 h-5 text-primary" />
                    </div>
                    Assign delivery agent
                  </DialogTitle>
                </DialogHeader>

                {/* Shipment summary strip */}
                <div className="px-6 py-4 bg-gradient-to-r from-primary/5 to-transparent border-b border-border">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                        <Boxes className="w-3 h-3" /> Items
                      </p>
                      <p className="text-lg font-semibold text-foreground leading-tight">
                        {selected.size}
                        <span className="text-xs font-normal text-muted-foreground ml-1">
                          ({totalQty} units)
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                        <Weight className="w-3 h-3" /> Total weight
                      </p>
                      <p className="text-lg font-semibold text-foreground leading-tight">
                        {totalWeightKg > 0 ? `${totalWeightKg} kg` : '—'}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                        <Building2 className="w-3 h-3" /> Pickup hub
                      </p>
                      <p className="text-sm font-semibold text-foreground font-mono truncate" title={pickupHubCode}>
                        {pickupHubCode}
                      </p>
                      <p className="text-[11px] text-muted-foreground">admin-arranged pickup</p>
                    </div>
                  </div>
                </div>

                {/* Agent list */}
                <div className="px-6 pt-4 pb-2">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Available agents
                    </p>
                    <span className="text-xs text-muted-foreground">{agents.length} online</span>
                  </div>
                </div>
                <div className="px-4 pb-4 max-h-[340px] overflow-y-auto">
                  <div className="space-y-2 px-2">
                    {agents.length === 0 && (
                      <p className="p-6 text-center text-sm text-muted-foreground">
                        No delivery agents are currently active.
                      </p>
                    )}
                    {agents.map((a) => {
                      const isSelected = agentId === a._id;
                      const initial = (a.name || '?').trim().charAt(0).toUpperCase();
                      return (
                        <label
                          key={a._id}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                            isSelected
                              ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm'
                              : 'border-border hover:border-primary/40 hover:bg-muted/40'
                          }`}
                        >
                          {/* Avatar */}
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                              isSelected
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-foreground'
                            }`}
                          >
                            {initial}
                          </div>

                          {/* Name + meta */}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-foreground truncate">{a.name}</p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1 min-w-0 max-w-[220px]">
                                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="truncate">{a.location || 'Base not set'}</span>
                              </span>
                              <span className="flex items-center gap-1 flex-shrink-0">
                                <Phone className="w-3.5 h-3.5" />
                                {a.phone}
                              </span>
                            </div>
                          </div>

                          {/* Reliability + selection indicator */}
                          <div className="flex items-center gap-2.5 flex-shrink-0">
                            <span
                              className={`hidden sm:inline-flex items-center text-[11px] font-semibold px-2 py-1 rounded-full border ${reliabilityClasses(
                                a.reliabilityScore
                              )}`}
                              title="Reliability score"
                            >
                              {a.reliabilityScore}%
                            </span>
                            <div
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                isSelected
                                  ? 'border-primary bg-primary'
                                  : 'border-border bg-background'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />}
                            </div>
                            <input
                              type="radio"
                              name="agent"
                              checked={isSelected}
                              onChange={() => setAgentId(a._id)}
                              className="sr-only"
                            />
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center gap-2 px-6 py-4 border-t border-border bg-muted/20">
                  <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={busy}>
                    Cancel
                  </Button>
                  <Button
                    onClick={assignDelivery}
                    disabled={busy || !agentId}
                    className="flex-1 gap-2"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                    {chosenAgent
                      ? `Dispatch ${chosenAgent.name.split(' ')[0]}`
                      : 'Select an agent'}
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Raise material request dialog */}
      <Dialog open={reqDialogOpen} onOpenChange={setReqDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" /> Raise material request
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={reqForm.category}
                  onChange={(e) => setReqForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  {REQUEST_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={reqForm.quantity}
                  onChange={(e) => setReqForm((f) => ({ ...f, quantity: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Unit</label>
                <select
                  value={reqForm.unit}
                  onChange={(e) => setReqForm((f) => ({ ...f, unit: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  <option value="kg">kg</option>
                  <option value="pieces">pieces</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Needed by (optional)</label>
                <input
                  type="date"
                  value={reqForm.targetDate}
                  onChange={(e) => setReqForm((f) => ({ ...f, targetDate: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Note (optional)</label>
              <textarea
                rows={2}
                value={reqForm.note}
                onChange={(e) => setReqForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Any quality / spec details for the admin"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>
            <Button onClick={submitRequest} disabled={reqBusy} className="w-full gap-2">
              {reqBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Submit to admin
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const REQUEST_STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  approved: 'bg-blue-100 text-blue-800 border-blue-200',
  partially_approved: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  fulfilled: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  cancelled: 'bg-gray-100 text-gray-700 border-gray-200',
};

function RequestStatus({ status }) {
  const cls = REQUEST_STATUS_STYLES[status] || 'bg-muted text-foreground border-border';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border capitalize ${cls}`}>
      {String(status || '').replace(/_/g, ' ')}
    </span>
  );
}

function Stat({ label, value, icon }) {
  return (
    <div className="p-5 rounded-lg border border-border bg-card flex items-center justify-between">
      <div>
        <p className="text-sm text-muted-foreground mb-1">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
      {icon}
    </div>
  );
}
