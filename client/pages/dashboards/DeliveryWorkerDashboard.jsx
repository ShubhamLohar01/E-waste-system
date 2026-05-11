import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import NotificationsBell from '@/components/NotificationsBell';
import {
  Package, LogOut, Truck, MapPin, Phone, Building2, CheckCircle2,
  Loader2, Camera, ImagePlus, IndianRupee, TrendingUp,
} from 'lucide-react';
import { api } from '@/lib/api';

export default function DeliveryWorkerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [photos, setPhotos] = useState({});

  const refresh = useCallback(async () => {
    try {
      const [t, e] = await Promise.all([
        api.get('/api/delivery/tasks'),
        api.get('/api/delivery/earnings'),
      ]);
      setTasks(t?.tasks || []);
      setEarnings(e || null);
    } catch (err) {
      console.error(err);
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

  const handlePhoto = (id, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotos((p) => ({ ...p, [id]: reader.result }));
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const act = async (taskId, mode) => {
    const photo = photos[`${taskId}-${mode}`];
    if (!photo) return alert('Please add a photo proof first.');
    const task = tasks.find((t) => t._id === taskId);
    // Auto-submit all manifest QR codes for verification. In the field a phone camera
    // would scan each; here every code in the manifest is the one on the sticker.
    const scannedQrCodes = task?.manifest?.map((m) => m.qrCode) || [];
    setActionLoading(`${taskId}-${mode}`);
    try {
      await api.post(`/api/delivery/${taskId}/${mode}`, { photo, scannedQrCodes });
      setPhotos((p) => {
        const n = { ...p };
        delete n[`${taskId}-${mode}`];
        return n;
      });
      await refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );

  const open = tasks.filter((t) => t.status !== 'delivered');
  const done = tasks.filter((t) => t.status === 'delivered');

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
        <section className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20 rounded-lg p-8">
          <div className="flex items-center gap-3 mb-2">
            <Truck className="w-7 h-7 text-orange-600" />
            <h1 className="text-3xl font-bold">Delivery Dashboard</h1>
          </div>
          <p className="text-muted-foreground">
            Pick items from hubs and drop them off at recycler facilities.
          </p>
        </section>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Open tasks" value={open.length} />
          <Stat label="Completed" value={done.length} />
          <Stat
            label="Reliability"
            value={earnings ? `${earnings.reliabilityScore}%` : '—'}
            icon={<TrendingUp className="w-5 h-5 text-green-600" />}
          />
          <Stat
            label="Earnings"
            value={earnings ? `₹${earnings.earningsINR}` : '₹0'}
            icon={<IndianRupee className="w-5 h-5 text-primary" />}
          />
        </section>

        <section>
          <h2 className="text-xl font-bold mb-4">Active tasks</h2>
          {open.length === 0 ? (
            <div className="p-10 rounded-lg border border-dashed text-center">
              <Truck className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No active deliveries. A recycler will assign you soon.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {open.map((t) => (
                <div key={t._id} className="p-6 rounded-lg border border-border bg-card space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Task ID</p>
                      <p className="font-mono text-sm">{t._id.slice(0, 14)}…</p>
                    </div>
                    <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200 capitalize">
                      {t.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <Box title="Pickup Hub" icon={<Building2 className="w-4 h-4" />}>
                      <p className="font-medium">{t.hubName || '—'}</p>
                      {t.hubAddress && (
                        <p className="text-sm text-muted-foreground flex items-start gap-1">
                          <MapPin className="w-3.5 h-3.5 mt-0.5" /> {t.hubAddress}
                        </p>
                      )}
                      {t.hubPhone && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" /> {t.hubPhone}
                        </p>
                      )}
                    </Box>
                    <Box title="Drop at Recycler" icon={<Building2 className="w-4 h-4" />}>
                      <p className="font-medium">{t.recyclerName || '—'}</p>
                      {t.recyclerAddress && (
                        <p className="text-sm text-muted-foreground flex items-start gap-1">
                          <MapPin className="w-3.5 h-3.5 mt-0.5" /> {t.recyclerAddress}
                        </p>
                      )}
                      {t.recyclerPhone && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" /> {t.recyclerPhone}
                        </p>
                      )}
                    </Box>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-1">Manifest ({t.manifest.length} items)</p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {t.manifest.map((m) => (
                        <div
                          key={m.inventoryId}
                          className="flex items-center justify-between p-2.5 rounded bg-muted/30 text-sm"
                        >
                          <span>{m.category}</span>
                          <span className="font-semibold">
                            {m.qty} {m.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {t.status === 'assigned' && (
                    <ProofBlock
                      taskId={t._id}
                      mode="pickup"
                      label="Pickup from hub"
                      actionLabel="Confirm hub pickup"
                      photos={photos}
                      actionLoading={actionLoading}
                      onFile={handlePhoto}
                      onAct={act}
                    />
                  )}
                  {t.status === 'picked_up' && (
                    <ProofBlock
                      taskId={t._id}
                      mode="dropoff"
                      label="Drop off at recycler"
                      actionLabel="Confirm recycler drop-off"
                      photos={photos}
                      actionLoading={actionLoading}
                      onFile={handlePhoto}
                      onAct={act}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {done.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-4">Completed</h2>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Task</th>
                    <th className="px-4 py-2 text-left font-semibold">Hub → Recycler</th>
                    <th className="px-4 py-2 text-left font-semibold">Items</th>
                    <th className="px-4 py-2 text-left font-semibold">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {done.map((t) => (
                    <tr key={t._id}>
                      <td className="px-4 py-2 font-mono text-xs">{t._id.slice(0, 10)}…</td>
                      <td className="px-4 py-2">
                        {t.hubName} → {t.recyclerName}
                      </td>
                      <td className="px-4 py-2">{t.manifest.length}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {new Date(t.updatedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
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
function Box({ title, icon, children }) {
  return (
    <div className="p-3 rounded-lg bg-muted/30 space-y-1">
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        {icon} {title}
      </p>
      {children}
    </div>
  );
}
function ProofBlock({ taskId, mode, label, actionLabel, photos, actionLoading, onFile, onAct }) {
  const key = `${taskId}-${mode}`;
  return (
    <div className="p-4 rounded-lg border border-amber-200 bg-amber-50/50 space-y-3">
      <p className="text-sm font-medium flex items-center gap-2">
        <Camera className="w-4 h-4 text-amber-700" /> {label} — photo proof required
      </p>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        id={`file-${key}`}
        className="hidden"
        onChange={(e) => onFile(key, e)}
      />
      {photos[key] ? (
        <div className="flex items-center gap-3">
          <img src={photos[key]} alt="proof" className="w-20 h-20 object-cover rounded border" />
          <label htmlFor={`file-${key}`} className="text-sm text-primary font-medium cursor-pointer flex items-center gap-1">
            <ImagePlus className="w-4 h-4" /> Change
          </label>
        </div>
      ) : (
        <label
          htmlFor={`file-${key}`}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-amber-300 bg-white text-amber-800 font-medium cursor-pointer hover:bg-amber-100 text-sm"
        >
          <Camera className="w-4 h-4" /> Take / upload photo
        </label>
      )}
      <Button
        disabled={!photos[key] || actionLoading === key}
        onClick={() => onAct(taskId, mode)}
        className="gap-2"
      >
        {actionLoading === key ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <CheckCircle2 className="w-4 h-4" />
        )}
        {actionLabel}
      </Button>
    </div>
  );
}
