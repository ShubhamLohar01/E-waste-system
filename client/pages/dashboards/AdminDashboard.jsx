import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Package, LogOut, Users, TrendingUp, IndianRupee, Boxes, Truck, Factory,
  Loader2, CheckCircle2, Clock, Shield, ClipboardList, AlertTriangle, FileSearch, UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import NotificationsBell from '@/components/NotificationsBell';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('verified');

  const [metrics, setMetrics] = useState(null);
  const [verified, setVerified] = useState([]);
  const [recyclers, setRecyclers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [paymentsLog, setPaymentsLog] = useState([]);
  const [users, setUsers] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [unassignedIntents, setUnassignedIntents] = useState([]);
  const [collectorsList, setCollectorsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [resolveTarget, setResolveTarget] = useState(null);
  const [resolutionText, setResolutionText] = useState('');

  // assign to recycler
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [recyclerId, setRecyclerId] = useState('');

  // recycler requests
  const [recyclerRequests, setRecyclerRequests] = useState([]);
  const [verifiedStock, setVerifiedStock] = useState([]);
  const [approveTarget, setApproveTarget] = useState(null);
  const [allocIds, setAllocIds] = useState(new Set());

  // category price catalog
  const [catPrices, setCatPrices] = useState([]);
  const [knownCategories, setKnownCategories] = useState([]); // distinct categories present in inventory
  const [priceEdits, setPriceEdits] = useState({}); // category -> string value

  // mark payment
  const [payOpen, setPayOpen] = useState(false);
  const [payItem, setPayItem] = useState(null);
  const [payMethod, setPayMethod] = useState('bank_transfer');
  const [payNote, setPayNote] = useState('');
  const [payPreview, setPayPreview] = useState(null); // null = loading, else { ok, ... }

  const refresh = useCallback(async () => {
    try {
      const [m, v, o, p, u, d, a, ints, rr, cp] = await Promise.all([
        api.get('/api/admin/dashboard'),
        api.get('/api/admin/verified-items'),
        api.get('/api/admin/orders'),
        api.get('/api/admin/payments'),
        api.get('/api/admin/users'),
        api.get('/api/admin/disputes'),
        api.get('/api/admin/audit'),
        api.get('/api/admin/intents'),
        api.get('/api/admin/recycler-requests'),
        api.get('/api/admin/category-prices'),
      ]);
      setMetrics(m?.metrics || null);
      setVerified(v?.items || []);
      setRecyclers(v?.recyclers || []);
      setOrders(o?.orders || []);
      setPaymentsLog(p?.payments || []);
      setUsers(u?.users || []);
      setDisputes(d?.disputes || []);
      setAuditLog(a?.auditLog || []);
      setUnassignedIntents((ints?.intents || []).filter((i) => !i.assignedCollector && i.status === 'submitted'));
      setCollectorsList(ints?.collectors || []);
      setRecyclerRequests(rr?.requests || []);
      setVerifiedStock(rr?.verifiedStock || []);
      setCatPrices(cp?.prices || []);
      setKnownCategories(cp?.categories || []);
      setLoadError(null);
    } catch (err) {
      console.error(err);
      setLoadError(err?.message || 'Failed to load dashboard data.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const toggle = (id) =>
    setSelectedIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const openAssign = () => {
    if (selectedIds.size === 0) return alert('Select at least one verified item.');
    setRecyclerId(recyclers[0]?._id || '');
    setAssignOpen(true);
  };

  const assign = async () => {
    if (!recyclerId) return;
    setBusy('assign');
    try {
      await api.post('/api/admin/assign-to-recycler', {
        inventoryIds: [...selectedIds],
        recyclerId,
      });
      setAssignOpen(false);
      setSelectedIds(new Set());
      await refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(null);
    }
  };

  const toggleAlloc = (id) =>
    setAllocIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const openApprove = (request) => {
    setAllocIds(new Set());
    setApproveTarget(request);
  };

  const approveRequest = async () => {
    if (!approveTarget || allocIds.size === 0) return alert('Select at least one item to allocate.');
    setBusy('approve');
    try {
      await api.post(`/api/admin/recycler-requests/${approveTarget._id}/approve`, {
        inventoryIds: [...allocIds],
      });
      setApproveTarget(null);
      setAllocIds(new Set());
      await refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(null);
    }
  };

  const rejectRequest = async (request) => {
    const note = prompt('Reason for rejection (optional):');
    if (note === null) return; // cancelled
    setBusy('reject-' + request._id);
    try {
      await api.post(`/api/admin/recycler-requests/${request._id}/reject`, { note });
      await refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(null);
    }
  };

  const fetchCategoryPrices = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/category-prices');
      setCatPrices(res?.prices || []);
      setKnownCategories(res?.categories || []);
    } catch (err) { console.error(err); }
  }, []);

  const saveCategoryPrice = async (category) => {
    const raw = priceEdits[category];
    const currentValue = Number(raw);
    if (!Number.isFinite(currentValue) || currentValue < 0) return alert('Enter a valid amount (₹).');
    try {
      await api.put('/api/admin/category-prices', { category, currentValue });
      await fetchCategoryPrices();
    } catch (err) { alert(err?.message || 'Could not save price.'); }
  };

  const openPayment = async (item) => {
    setPayItem(item);
    setPayMethod('bank_transfer');
    setPayNote('');
    setPayPreview(null);
    setPayOpen(true);
    try {
      const res = await api.get(`/api/admin/payout-preview?inventoryId=${encodeURIComponent(item._id)}`);
      setPayPreview(res);
    } catch (err) {
      setPayPreview({ ok: false, error: err?.message || 'Could not compute payout.' });
    }
  };

  const markPayment = async () => {
    if (!payItem) return;
    setBusy('pay');
    try {
      const res = await api.post('/api/admin/mark-payment', {
        inventoryId: payItem._id,
        method: payMethod,
        note: payNote,
      });
      setPayOpen(false);
      setPayItem(null);
      setPayPreview(null);
      await refresh();
      if (res?.payment && res?.payout) {
        alert(`Recorded ₹${res.payment.amount} — seller ₹${res.payout.user}, hub ₹${res.payout.hub}`);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(null);
    }
  };

  const resolveDispute = async () => {
    if (!resolveTarget) return;
    setBusy('dispute');
    try {
      await api.put(`/api/admin/disputes/${resolveTarget._id}`, { resolution: resolutionText });
      setResolveTarget(null);
      setResolutionText('');
      await refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(null);
    }
  };

  const manualAssignCollector = async (intentId, collectorId) => {
    setBusy('assign-col-' + intentId);
    try {
      await api.post('/api/admin/assign-collector', { intentId, collectorId });
      await refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(null);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );

  const delivered = orders.filter((o) => o.status === 'delivered');

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary text-primary-foreground">
              <Package className="w-5 h-5" />
            </div>
            <span className="font-bold">E-Waste Hub · Admin</span>
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
        {loadError && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Couldn’t refresh dashboard data: {loadError}. Showing last known values.</span>
          </div>
        )}
        <section className="bg-gradient-to-r from-slate-500/10 to-gray-500/10 border border-slate-500/20 rounded-lg p-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-7 h-7 text-slate-600" />
            <h1 className="text-3xl font-bold">Admin Control Center</h1>
          </div>
          <p className="text-muted-foreground">Approve verified batches, assign recyclers, and close the loop by collecting payment.</p>
        </section>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Awaiting approval" value={metrics?.verifiedAwaitingAssign ?? 0} icon={<Clock className="w-5 h-5 text-cyan-600" />} />
          <Stat label="In transit" value={metrics?.inTransit ?? 0} icon={<Truck className="w-5 h-5 text-orange-600" />} />
          <Stat label="Processed" value={metrics?.processed ?? 0} icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />} />
          <Stat label="Total paid" value={`₹${metrics?.totalPaidINR ?? 0}`} icon={<IndianRupee className="w-5 h-5 text-primary" />} />
        </section>

        <div className="flex flex-wrap gap-2 border-b border-border">
          {[
            ['verified', 'Verified · Assign recycler'],
            ['recycler_requests', `Recycler requests (${recyclerRequests.filter((r) => r.status === 'pending').length})`],
            ['category_prices', 'Price catalog'],
            ['pending_payment', `Payment due (${delivered.length})`],
            ['assign_collector', `Unassigned intents (${unassignedIntents.length})`],
            ['disputes', `Disputes (${disputes.filter(d => d.status === 'open').length} open)`],
            ['orders', 'All orders'],
            ['payments', 'Payment ledger'],
            ['users', 'Users'],
            ['audit', 'Audit log'],
          ].map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === k ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {tab === 'verified' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Select items a hub has verified, then assign one recycler to all of them.</p>
              <Button onClick={openAssign} disabled={selectedIds.size === 0} className="gap-2">
                <Factory className="w-4 h-4" /> Assign recycler ({selectedIds.size})
              </Button>
            </div>
            {verified.length === 0 ? (
              <div className="p-10 rounded-lg border border-dashed text-center text-muted-foreground">
                No verified items awaiting assignment.
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
                      <th className="px-3 py-2 text-left font-semibold">Hub</th>
                      <th className="px-3 py-2 text-left font-semibold">Source user</th>
                      <th className="px-3 py-2 text-left font-semibold">QR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {verified.map((it) => (
                      <tr key={it._id} className="hover:bg-muted/20">
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={selectedIds.has(it._id)} onChange={() => toggle(it._id)} />
                        </td>
                        <td className="px-3 py-2 font-medium">{it.category}</td>
                        <td className="px-3 py-2">{it.actualQty} {it.unit}</td>
                        <td className="px-3 py-2">{it.weightKg != null ? `${it.weightKg} kg` : '—'}</td>
                        <td className="px-3 py-2">{it.hubName}</td>
                        <td className="px-3 py-2">{it.sourceUserName}</td>
                        <td className="px-3 py-2 font-mono text-xs">{it.qrCode.slice(0, 12)}…</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {tab === 'recycler_requests' && (
          <section className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Recyclers request a category &amp; quantity here. Approve by allocating hub-verified stock —
              the recycler never sees which hub it came from, and the hub never sees the recycler.
            </p>
            {recyclerRequests.length === 0 ? (
              <div className="p-10 rounded-lg border border-dashed text-center text-muted-foreground">
                No recycler requests yet.
              </div>
            ) : (
              <div className="space-y-3">
                {recyclerRequests.map((r) => {
                  const matchStock = verifiedStock.filter((s) => s.category === r.category).length;
                  return (
                    <div key={r._id} className="p-4 rounded-lg border border-border bg-card">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold">{r.category} — {r.quantity} {r.unit}</p>
                            <RequestBadge status={r.status} />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            From {r.recyclerName} · {new Date(r.createdAt).toLocaleString()}
                            {r.targetDate ? ` · needed by ${r.targetDate}` : ''}
                          </p>
                          {r.note && <p className="text-xs text-muted-foreground mt-1">Note: {r.note}</p>}
                          <p className="text-xs text-muted-foreground mt-1">
                            Allocated: {r.allocatedCount} item(s) · {matchStock} verified {r.category} item(s) available
                          </p>
                        </div>
                        {['pending', 'partially_approved'].includes(r.status) && (
                          <div className="flex flex-col gap-2 flex-shrink-0">
                            <Button size="sm" onClick={() => openApprove(r)} className="gap-1">
                              <Factory className="w-4 h-4" /> Approve / allocate
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => rejectRequest(r)}
                              disabled={busy === 'reject-' + r._id}
                              className="gap-1 text-destructive"
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {tab === 'category_prices' && (
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-bold mb-1">Category price catalog</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Current market value (₹) per category. Payouts = this value × the technician's quality grade.
            </p>
            <div className="space-y-2">
              {catPrices.map((p) => (
                <div key={p.category} className="flex items-center gap-3">
                  <span className="flex-1 text-sm font-medium">{p.category}</span>
                  <input
                    type="number"
                    min="0"
                    defaultValue={p.currentValue}
                    onChange={(e) => setPriceEdits((s) => ({ ...s, [p.category]: e.target.value }))}
                    className="w-40 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                  <Button size="sm" variant="outline" onClick={() => saveCategoryPrice(p.category)}>Save</Button>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-border pt-4">
              {(() => {
                const priced = new Set(catPrices.map((p) => p.category));
                const unpriced = knownCategories.filter((c) => !priced.has(c));
                if (unpriced.length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground">
                      All inventory categories are priced.
                    </p>
                  );
                }
                return (
                  <div className="flex items-center gap-3">
                    <select
                      value={priceEdits.__new_cat || ''}
                      onChange={(e) => setPriceEdits((s) => ({ ...s, __new_cat: e.target.value }))}
                      className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    >
                      <option value="" disabled>— select a category —</option>
                      {unpriced.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <input
                      type="number" min="0" placeholder="₹ value"
                      value={priceEdits.__new_val || ''}
                      onChange={(e) => setPriceEdits((s) => ({ ...s, __new_val: e.target.value }))}
                      className="w-40 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    />
                    <Button
                      size="sm"
                      onClick={async () => {
                        const category = (priceEdits.__new_cat || '').trim();
                        const currentValue = Number(priceEdits.__new_val);
                        if (!category) return alert('Select a category.');
                        if (!Number.isFinite(currentValue) || currentValue < 0) return alert('Enter a valid ₹ value.');
                        try {
                          await api.put('/api/admin/category-prices', { category, currentValue });
                          setPriceEdits((s) => ({ ...s, __new_cat: '', __new_val: '' }));
                          await fetchCategoryPrices();
                        } catch (err) { alert(err?.message || 'Could not add.'); }
                      }}
                    >
                      Add
                    </Button>
                  </div>
                );
              })()}
            </div>
          </section>
        )}

        {tab === 'pending_payment' && (
          <section className="space-y-4">
            <p className="text-sm text-muted-foreground">
              These orders have been delivered to the recycler. Collect the payment offline (bank transfer / cash / UPI), then record it here to finalise and credit the payout.
            </p>
            {delivered.length === 0 ? (
              <div className="p-10 rounded-lg border border-dashed text-center text-muted-foreground">
                No payments due.
              </div>
            ) : (
              <div className="space-y-3">
                {delivered.map((o) => (
                  <div key={o._id} className="p-4 rounded-lg border border-border bg-card flex items-center justify-between">
                    <div>
                      <p className="font-medium">{o.category} — {o.actualQty} {o.unit}{o.weightKg ? ` · ${o.weightKg} kg` : ''}</p>
                      <p className="text-xs text-muted-foreground">
                        {o.sourceUserName} → {o.collectorName} → {o.hubName} → {o.recyclerName} (via {o.deliveryWorkerName || '—'})
                      </p>
                    </div>
                    <Button size="sm" onClick={() => openPayment(o)} className="gap-2">
                      <IndianRupee className="w-4 h-4" /> Record payment
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'orders' && (
          <section>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Category</th>
                    <th className="px-3 py-2 text-left font-semibold">Status</th>
                    <th className="px-3 py-2 text-left font-semibold">Small user</th>
                    <th className="px-3 py-2 text-left font-semibold">Collector</th>
                    <th className="px-3 py-2 text-left font-semibold">Hub</th>
                    <th className="px-3 py-2 text-left font-semibold">Recycler</th>
                    <th className="px-3 py-2 text-left font-semibold">Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.map((o) => (
                    <tr key={o._id}>
                      <td className="px-3 py-2 font-medium">{o.category}</td>
                      <td className="px-3 py-2 capitalize">{o.status.replace('_', ' ')}</td>
                      <td className="px-3 py-2">{o.sourceUserName || '—'}</td>
                      <td className="px-3 py-2">{o.collectorName || '—'}</td>
                      <td className="px-3 py-2">{o.hubName || '—'}</td>
                      <td className="px-3 py-2">{o.recyclerName || '—'}</td>
                      <td className="px-3 py-2">{o.payment ? `₹${o.payment.amount}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'payments' && (
          <section>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">When</th>
                    <th className="px-3 py-2 text-left font-semibold">Item</th>
                    <th className="px-3 py-2 text-left font-semibold">Recycler</th>
                    <th className="px-3 py-2 text-left font-semibold">Method</th>
                    <th className="px-3 py-2 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paymentsLog.map((p) => (
                    <tr key={p._id}>
                      <td className="px-3 py-2 text-muted-foreground">{new Date(p.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-2">{p.category} <span className="text-xs text-muted-foreground font-mono">{p.qrCode?.slice(0, 10)}…</span></td>
                      <td className="px-3 py-2">{p.recyclerName || '—'}</td>
                      <td className="px-3 py-2 capitalize">{p.method}</td>
                      <td className="px-3 py-2 text-right font-semibold">₹{p.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'users' && (
          <section>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Name</th>
                    <th className="px-3 py-2 text-left font-semibold">Email</th>
                    <th className="px-3 py-2 text-left font-semibold">Role</th>
                    <th className="px-3 py-2 text-left font-semibold">Location</th>
                    <th className="px-3 py-2 text-left font-semibold">Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((u) => (
                    <tr key={u._id}>
                      <td className="px-3 py-2 font-medium">{u.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{u.email}</td>
                      <td className="px-3 py-2 capitalize">{u.role?.replace('_', ' ')}</td>
                      <td className="px-3 py-2">{u.location?.address || '—'}</td>
                      <td className="px-3 py-2">{u.isActive ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'assign_collector' && (
          <section className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Intents still waiting to be picked up by a collector. Assign one manually here if needed.
            </p>
            {unassignedIntents.length === 0 ? (
              <div className="p-10 rounded-lg border border-dashed text-center text-muted-foreground">
                All submitted intents are assigned.
              </div>
            ) : (
              <div className="space-y-3">
                {unassignedIntents.map((it) => (
                  <div key={it._id} className="p-4 rounded-lg border border-border bg-card">
                    <div className="flex items-start justify-between mb-2 gap-3">
                      <div>
                        <p className="font-medium">{it.userName}</p>
                        <p className="text-xs text-muted-foreground">{it.location?.address || '—'}</p>
                        <p className="text-xs text-muted-foreground">
                          Items: {it.items.map((x) => `${x.category} (${x.estimatedQty} ${x.unit})`).join(', ')}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-muted border">
                        {new Date(it.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        className="px-2 py-1.5 rounded-md border border-border bg-background text-sm flex-1"
                        defaultValue=""
                        id={`col-${it._id}`}
                      >
                        <option value="" disabled>— select a collector —</option>
                        {collectorsList.map((c) => (
                          <option key={c._id} value={c._id}>{c.name}</option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        onClick={() => {
                          const el = document.getElementById(`col-${it._id}`);
                          if (!el?.value) return alert('Pick a collector');
                          manualAssignCollector(it._id, el.value);
                        }}
                        disabled={busy === 'assign-col-' + it._id}
                        className="gap-1"
                      >
                        <UserCheck className="w-4 h-4" /> Assign
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'disputes' && (
          <section className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Investigate and resolve disputes raised by any role in the system.
            </p>
            {disputes.length === 0 ? (
              <div className="p-10 rounded-lg border border-dashed text-center text-muted-foreground">
                No disputes yet.
              </div>
            ) : (
              <div className="space-y-3">
                {disputes.map((d) => (
                  <div key={d._id} className="p-4 rounded-lg border border-border bg-card">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle className="w-4 h-4 text-yellow-600" />
                          <p className="font-semibold capitalize">{d.type?.replace('_', ' ')}</p>
                          <span className={`px-2 py-0.5 rounded-full text-xs border ${
                            d.status === 'open' ? 'bg-yellow-50 text-yellow-800 border-yellow-200' : 'bg-green-50 text-green-800 border-green-200'
                          }`}>
                            {d.status}
                          </span>
                        </div>
                        <p className="text-sm">{d.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Raised by {d.raisedByUser || '—'}{d.againstUser ? ` · against ${d.againstUser}` : ''} · {new Date(d.createdAt).toLocaleString()}
                        </p>
                        {d.resolution && (
                          <p className="text-xs text-green-700 mt-1">Resolution: {d.resolution}</p>
                        )}
                      </div>
                      {d.status === 'open' && (
                        <Button size="sm" onClick={() => { setResolveTarget(d); setResolutionText(''); }}>
                          Resolve
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'audit' && (
          <section>
            <p className="text-sm text-muted-foreground mb-3 flex items-center gap-1">
              <FileSearch className="w-4 h-4" /> Chronological traceability log across every item.
            </p>
            {auditLog.length === 0 ? (
              <div className="p-10 rounded-lg border border-dashed text-center text-muted-foreground">
                Nothing logged yet.
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">When</th>
                      <th className="px-3 py-2 text-left font-semibold">Category</th>
                      <th className="px-3 py-2 text-left font-semibold">Action</th>
                      <th className="px-3 py-2 text-left font-semibold">By</th>
                      <th className="px-3 py-2 text-left font-semibold">Note</th>
                      <th className="px-3 py-2 text-left font-semibold">QR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {auditLog.slice(0, 500).map((row, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                          {new Date(row.timestamp).toLocaleString()}
                        </td>
                        <td className="px-3 py-2">{row.category}</td>
                        <td className="px-3 py-2 capitalize">{row.action?.replace(/_/g, ' ')}</td>
                        <td className="px-3 py-2">{row.actorName || row.actor || '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.note || ''}</td>
                        <td className="px-3 py-2 font-mono text-xs">{row.qrCode?.slice(0, 12)}…</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {auditLog.length > 500 && (
                  <p className="p-2 text-xs text-muted-foreground text-center border-t">
                    Showing first 500 events of {auditLog.length}.
                  </p>
                )}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Resolve dispute dialog */}
      <Dialog open={!!resolveTarget} onOpenChange={(v) => { if (!v) setResolveTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve dispute</DialogTitle>
          </DialogHeader>
          {resolveTarget && (
            <div className="space-y-3 py-3">
              <div className="p-3 rounded bg-muted/30 text-sm">
                <p className="font-medium capitalize">{resolveTarget.type?.replace('_', ' ')}</p>
                <p className="text-muted-foreground">{resolveTarget.description}</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Resolution note</label>
                <textarea
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm resize-none"
                  placeholder="Explain the outcome and any follow-up."
                />
              </div>
              <Button onClick={resolveDispute} disabled={busy === 'dispute' || !resolutionText.trim()} className="w-full gap-2">
                {busy === 'dispute' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Mark resolved
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign recycler dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Assign recycler</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col min-h-0 flex-1 gap-3">
            <p className="text-sm text-muted-foreground shrink-0">{selectedIds.size} item(s) selected.</p>
            <div className="space-y-2 overflow-y-auto min-h-0 flex-1 pr-1">
              {recyclers.map((r) => (
                <label
                  key={r._id}
                  className={`flex items-start justify-between gap-3 p-2.5 rounded-lg border cursor-pointer ${
                    recyclerId === r._id ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate" title={r.companyName || r.name}>
                      {r.companyName || r.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate" title={r.address}>{r.address}</p>
                    {r.ratePerKg > 0 && <p className="text-xs text-muted-foreground">Rate: ₹{r.ratePerKg}/kg</p>}
                  </div>
                  <input
                    type="radio"
                    name="recycler"
                    className="mt-1 shrink-0"
                    checked={recyclerId === r._id}
                    onChange={() => setRecyclerId(r._id)}
                  />
                </label>
              ))}
            </div>
            <Button onClick={assign} disabled={busy === 'assign' || !recyclerId} className="w-full gap-2 shrink-0">
              {busy === 'assign' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Factory className="w-4 h-4" />}
              Confirm assignment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Approve recycler request — allocate verified stock */}
      <Dialog
        open={!!approveTarget}
        onOpenChange={(v) => { if (!v) { setApproveTarget(null); setAllocIds(new Set()); } }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Allocate stock to request</DialogTitle>
          </DialogHeader>
          {approveTarget && (() => {
            const candidates = verifiedStock.filter((s) => s.category === approveTarget.category);
            return (
              <div className="space-y-4 py-2">
                <div className="p-3 rounded bg-muted/30 text-sm">
                  <p className="font-medium">{approveTarget.category} — {approveTarget.quantity} {approveTarget.unit}</p>
                  <p className="text-muted-foreground">
                    From {approveTarget.recyclerName}{approveTarget.note ? ` · ${approveTarget.note}` : ''}
                  </p>
                </div>
                {candidates.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4 text-center border border-dashed rounded">
                    No verified {approveTarget.category} stock available right now.
                  </p>
                ) : (
                  <div className="rounded-lg border border-border overflow-hidden max-h-[320px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 w-8"></th>
                          <th className="px-3 py-2 text-left font-semibold">Qty</th>
                          <th className="px-3 py-2 text-left font-semibold">Weight</th>
                          <th className="px-3 py-2 text-left font-semibold">Hub</th>
                          <th className="px-3 py-2 text-left font-semibold">QR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {candidates.map((s) => (
                          <tr key={s._id} className="hover:bg-muted/20">
                            <td className="px-3 py-2">
                              <input type="checkbox" checked={allocIds.has(s._id)} onChange={() => toggleAlloc(s._id)} />
                            </td>
                            <td className="px-3 py-2">{s.actualQty} {s.unit}</td>
                            <td className="px-3 py-2">{s.weightKg != null ? `${s.weightKg} kg` : '—'}</td>
                            <td className="px-3 py-2">{s.hubName || '—'}</td>
                            <td className="px-3 py-2 font-mono text-xs">{s.qrCode?.slice(0, 12)}…</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <Button onClick={approveRequest} disabled={busy === 'approve' || allocIds.size === 0} className="w-full gap-2">
                  {busy === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Allocate {allocIds.size} item(s) to recycler
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Record payment dialog */}
      <Dialog open={payOpen} onOpenChange={(v) => { setPayOpen(v); if (!v) { setPayItem(null); setPayPreview(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment from recycler</DialogTitle>
          </DialogHeader>
          {payItem && (
            <div className="space-y-4 py-4">
              <div className="p-3 rounded-lg bg-muted/30 text-sm">
                <p className="font-medium">{payItem.category}</p>
                <p className="text-muted-foreground">
                  {payItem.actualQty} {payItem.unit}
                  {payItem.weightKg ? ` · ${payItem.weightKg} kg` : ''} · To: {payItem.recyclerName}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                The payout is computed automatically from the category catalog price × the item's quality grade,
                then split 60% seller / 20% platform / 20% hub.
              </p>
              {payPreview == null ? (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Computing payout…
                </div>
              ) : payPreview.ok ? (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm">
                  <p className="font-semibold">
                    Payout: ₹{payPreview.X} → seller ₹{payPreview.parts.user}, platform ₹{payPreview.parts.platform}, hub ₹{payPreview.parts.hub}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Base ₹{payPreview.basePrice} × {Math.round(payPreview.pct * 100)}% grade
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{payPreview.error}</span>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Method</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
                >
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Note (optional)</label>
                <input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="UTR / receipt number / comments"
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
                />
              </div>
              <Button onClick={markPayment} disabled={busy === 'pay' || !payPreview?.ok} className="w-full gap-2">
                {busy === 'pay' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Record payment &amp; finalise
              </Button>
              <p className="text-xs text-muted-foreground">
                This marks the order as processed and credits the computed payout to the small user, platform, and hub.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
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

const REQUEST_STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  approved: 'bg-blue-100 text-blue-800 border-blue-200',
  partially_approved: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  fulfilled: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  cancelled: 'bg-gray-100 text-gray-700 border-gray-200',
};

function RequestBadge({ status }) {
  const cls = REQUEST_STATUS_STYLES[status] || 'bg-muted text-foreground border-border';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border capitalize ${cls}`}>
      {String(status || '').replace(/_/g, ' ')}
    </span>
  );
}
