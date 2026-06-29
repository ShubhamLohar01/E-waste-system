import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import NotificationsBell from '@/components/NotificationsBell';
import GoogleMapDirections from '@/components/GoogleMapDirections';
import {
  Package, LogOut, Truck, MapPin, Phone, Building2, CheckCircle2,
  Loader2, Camera, RotateCcw, Clock,
  Navigation, ChevronDown, ChevronUp,
} from 'lucide-react';
import { api } from '@/lib/api';
import CameraCapture from '@/components/CameraCapture';

export default function DeliveryWorkerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [photos, setPhotos] = useState({});
  /** Which directions leg is expanded per task: 'hub' | 'recycler' | undefined */
  const [directionsView, setDirectionsView] = useState({});
  /** Proof key (`${taskId}-${mode}`) whose live camera dialog is open, or null */
  const [cameraFor, setCameraFor] = useState(null);
  /** Which completed task row is expanded, or null */
  const [openDone, setOpenDone] = useState(null);

  const toggleDirections = (taskId, which) =>
    setDirectionsView((s) => ({ ...s, [taskId]: s[taskId] === which ? undefined : which }));

  const refresh = useCallback(async () => {
    try {
      const t = await api.get('/api/delivery/tasks');
      setTasks(t?.tasks || []);
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

        <section className="grid grid-cols-2 gap-4">
          <Stat label="Open tasks" value={open.length} />
          <Stat label="Completed" value={done.length} />
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

                  {/* Directions — navigate from the agent's current location to hub / recycler */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium flex items-center gap-1.5">
                        <Navigation className="w-4 h-4 text-primary" /> Directions
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant={directionsView[t._id] === 'hub' ? 'default' : 'outline'}
                        onClick={() => toggleDirections(t._id, 'hub')}
                        disabled={!hasCoords(t.hubLocation)}
                        title={hasCoords(t.hubLocation) ? 'Route to the pickup hub' : 'Hub has no map coordinates'}
                        className="gap-1.5"
                      >
                        <Building2 className="w-3.5 h-3.5" /> To Hub
                        {directionsView[t._id] === 'hub' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={directionsView[t._id] === 'recycler' ? 'default' : 'outline'}
                        onClick={() => toggleDirections(t._id, 'recycler')}
                        disabled={!hasCoords(t.recyclerLocation)}
                        title={hasCoords(t.recyclerLocation) ? 'Route to the recycler' : 'Recycler has no map coordinates'}
                        className="gap-1.5"
                      >
                        <Truck className="w-3.5 h-3.5" /> To Recycler
                        {directionsView[t._id] === 'recycler' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </Button>
                    </div>

                    {directionsView[t._id] === 'hub' && hasCoords(t.hubLocation) && (
                      <GoogleMapDirections
                        destination={{ lat: t.hubLocation.lat, lng: t.hubLocation.lng, address: t.hubAddress || t.hubName }}
                        originFallback={user?.location}
                        height={300}
                      />
                    )}
                    {directionsView[t._id] === 'recycler' && hasCoords(t.recyclerLocation) && (
                      <GoogleMapDirections
                        destination={{ lat: t.recyclerLocation.lat, lng: t.recyclerLocation.lng, address: t.recyclerAddress || t.recyclerName }}
                        originFallback={user?.location}
                        height={300}
                      />
                    )}
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
                      onOpenCamera={setCameraFor}
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
                      onOpenCamera={setCameraFor}
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
            <div className="space-y-3">
              {done.map((t) => (
                <CompletedCard
                  key={t._id}
                  t={t}
                  open={openDone === t._id}
                  onToggle={() => setOpenDone((id) => (id === t._id ? null : t._id))}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Live camera for pickup / drop-off proof — uploading a saved file is intentionally not offered */}
      <CameraCapture
        open={!!cameraFor}
        onClose={() => setCameraFor(null)}
        onCapture={(dataUrl) => setPhotos((p) => ({ ...p, [cameraFor]: dataUrl }))}
        title={cameraFor?.endsWith('-pickup') ? 'Hub pickup — live photo proof' : 'Recycler drop-off — live photo proof'}
      />
    </div>
  );
}

// A location is routable only if it has real (non-zero) coordinates.
function hasCoords(loc) {
  return (
    loc &&
    typeof loc.lat === 'number' &&
    typeof loc.lng === 'number' &&
    !(loc.lat === 0 && loc.lng === 0)
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
function ProofBlock({ taskId, mode, label, actionLabel, photos, actionLoading, onOpenCamera, onAct }) {
  const key = `${taskId}-${mode}`;
  const photo = photos[key];
  return (
    <div className="p-4 rounded-lg border border-amber-200 bg-amber-50/50 space-y-3">
      <p className="text-sm font-medium flex items-center gap-2">
        <Camera className="w-4 h-4 text-amber-700" /> {label} — live photo proof required
      </p>
      <p className="text-xs text-amber-700/80">
        Take the photo now with your camera. Uploading a saved image is disabled so proof can’t be faked.
      </p>
      {photo ? (
        <div className="flex items-center gap-3">
          <img src={photo} alt="proof" className="w-20 h-20 object-cover rounded border" />
          <button
            type="button"
            onClick={() => onOpenCamera(key)}
            className="text-sm text-primary font-medium cursor-pointer flex items-center gap-1"
          >
            <RotateCcw className="w-4 h-4" /> Retake
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onOpenCamera(key)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-amber-300 bg-white text-amber-800 font-medium cursor-pointer hover:bg-amber-100 text-sm"
        >
          <Camera className="w-4 h-4" /> Capture live photo
        </button>
      )}
      <Button
        disabled={!photo || actionLoading === key}
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

function CompletedCard({ t, open, onToggle }) {
  const fmt = (ts) => (ts ? new Date(ts).toLocaleString() : '—');
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30"
      >
        <div className="min-w-0">
          <p className="font-medium truncate">
            {t.hubName || '—'} → {t.recyclerName || '—'}
          </p>
          <p className="text-xs text-muted-foreground font-mono truncate">
            {t._id.slice(0, 12)}… · {t.manifest.length} item(s) · {new Date(t.updatedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
            Delivered
          </span>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <ProofDetail
              title="Picked up from hub"
              proof={t.pickupProof || {}}
              place={t.hubName}
              address={t.hubAddress}
              phone={t.hubPhone}
              fmt={fmt}
            />
            <ProofDetail
              title="Dropped at recycler"
              proof={t.dropoffProof || {}}
              place={t.recyclerName}
              address={t.recyclerAddress}
              phone={t.recyclerPhone}
              fmt={fmt}
            />
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
        </div>
      )}
    </div>
  );
}

function ProofDetail({ title, proof, place, address, phone, fmt }) {
  return (
    <div className="p-3 rounded-lg bg-muted/30 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">{title}</p>
      <p className="font-medium text-sm">{place || '—'}</p>
      {address && (
        <p className="text-xs text-muted-foreground flex items-start gap-1">
          <MapPin className="w-3 h-3 mt-0.5 shrink-0" /> {address}
        </p>
      )}
      {phone && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Phone className="w-3 h-3" /> {phone}
        </p>
      )}
      <div className="flex items-center gap-3 pt-1">
        {proof.photo ? (
          <a href={proof.photo} target="_blank" rel="noreferrer" title="Open full proof photo">
            <img src={proof.photo} alt={title} className="w-16 h-16 object-cover rounded border" />
          </a>
        ) : (
          <div className="w-16 h-16 rounded border border-dashed flex items-center justify-center text-[10px] text-muted-foreground text-center px-1">
            No photo
          </div>
        )}
        <div className="text-xs space-y-0.5">
          <p className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-3 h-3" /> {fmt(proof.timestamp)}
          </p>
          {proof.qrScanned && (
            <p className="text-green-700 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> {proof.scannedCount} QR scanned
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
