import { useEffect, useRef, useState } from 'react';
import { MapPin, Crosshair, Loader2, Radio, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '@/context/AuthContext';

const NOMINATIM = 'https://nominatim.openstreetmap.org';

// Only push a new position when the collector has moved meaningfully or enough
// time has passed — keeps Nominatim + the API light during continuous tracking.
const MIN_MOVE_METERS = 75;
const MIN_INTERVAL_MS = 60_000;

function distanceMeters(a, b) {
  if (!a || a.lat == null || a.lng == null) return Infinity;
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Lets a local collector publish their current GPS position so the pickup matcher
 * (nearest-3-active-collectors) ranks them against nearby small users.
 *
 *   • "Update now" — one-shot: grab GPS → reverse-geocode → save to profile.
 *   • "Auto-update" toggle — watchPosition; pushes throttled updates while live.
 */
export default function CollectorLocationCard() {
  const { user, token, updateUser } = useAuth();

  const [saving, setSaving] = useState(false);
  const [auto, setAuto] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'ok' | 'err', msg }
  const [lastUpdated, setLastUpdated] = useState(null);

  const watchIdRef = useRef(null);
  const lastSentRef = useRef({ lat: null, lng: null, t: 0 });
  const savingRef = useRef(false);

  const loc = user?.location;
  const hasCoords = loc?.lat != null && loc?.lng != null;

  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(`${NOMINATIM}/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return '';
      const data = await res.json();
      return data?.display_name || '';
    } catch {
      return '';
    }
  };

  // Persist a position to the collector's profile.
  const saveLocation = async (lat, lng, { silent = false } = {}) => {
    if (savingRef.current) return;
    savingRef.current = true;
    if (!silent) setSaving(true);
    try {
      const address = (await reverseGeocode(lat, lng)) || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ location: { lat, lng, address } }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Save failed (${res.status})`);
      }
      const data = await res.json();
      updateUser({ location: data?.user?.location || { lat, lng, address } });
      lastSentRef.current = { lat, lng, t: Date.now() };
      setLastUpdated(Date.now());
      setStatus({ type: 'ok', msg: 'Location updated — nearby pickups will reach you here.' });
    } catch (e) {
      setStatus({ type: 'err', msg: e?.message || 'Could not save your location.' });
    } finally {
      savingRef.current = false;
      if (!silent) setSaving(false);
    }
  };

  // ---- One-shot "Update now" ---------------------------------------------
  const updateNow = () => {
    if (!navigator.geolocation) {
      setStatus({ type: 'err', msg: 'Geolocation is not supported by your browser.' });
      return;
    }
    setStatus(null);
    setSaving(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => saveLocation(pos.coords.latitude, pos.coords.longitude),
      (err) => {
        setSaving(false);
        setStatus({
          type: 'err',
          msg:
            err.code === 1
              ? 'Location permission denied. Allow it in your browser to share your position.'
              : err.code === 2
                ? 'Location unavailable. Check GPS / network.'
                : err.code === 3
                  ? 'Getting location timed out. Try again.'
                  : err.message || 'Could not get your location.',
        });
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
    );
  };

  // ---- Auto-update (continuous watch, throttled) --------------------------
  useEffect(() => {
    if (!auto) {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }
    if (!navigator.geolocation) {
      setStatus({ type: 'err', msg: 'Geolocation is not supported by your browser.' });
      setAuto(false);
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const last = lastSentRef.current;
        const movedEnough = distanceMeters(last, { lat, lng }) >= MIN_MOVE_METERS;
        const longEnough = Date.now() - (last.t || 0) >= MIN_INTERVAL_MS;
        if (last.lat == null || movedEnough || longEnough) {
          saveLocation(lat, lng, { silent: true });
        }
      },
      (err) => {
        setStatus({
          type: 'err',
          msg:
            err.code === 1
              ? 'Location permission denied — turn auto-update back on after allowing it.'
              : 'Lost your location signal. Will keep retrying while auto-update is on.',
        });
        if (err.code === 1) setAuto(false);
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 }
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  const fmtTime = (ts) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="p-5 rounded-lg border border-border bg-card">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2 rounded-md bg-primary/10 text-primary shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground">My pickup location</h3>
            <p className="text-sm text-muted-foreground break-words">
              {hasCoords
                ? loc.address || `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`
                : 'Not set yet — share your location to start receiving nearby requests.'}
            </p>
            {lastUpdated && (
              <p className="text-xs text-muted-foreground mt-0.5">Last updated at {fmtTime(lastUpdated)}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button type="button" size="sm" onClick={updateNow} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
            {saving ? 'Updating…' : 'Update now'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={auto ? 'default' : 'outline'}
            onClick={() => setAuto((v) => !v)}
            className="gap-2"
            title="Continuously share your location while you're out collecting"
          >
            <Radio className={`w-4 h-4 ${auto ? 'animate-pulse' : ''}`} />
            {auto ? 'Auto-update: ON' : 'Auto-update'}
          </Button>
        </div>
      </div>

      {auto && (
        <p className="mt-3 text-xs text-primary flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          Live — your location updates automatically as you move.
        </p>
      )}

      {status && (
        <p
          className={`mt-3 text-xs flex items-start gap-1.5 ${
            status.type === 'ok' ? 'text-green-700' : 'text-red-700'
          }`}
        >
          {status.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 mt-px shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 mt-px shrink-0" />
          )}
          {status.msg}
        </p>
      )}
    </div>
  );
}
