import { useEffect, useRef, useState } from 'react';
import { Loader2, ExternalLink, Navigation, RefreshCw } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { locationPinIcon } from './leafletIcon';
import { Button } from './ui/button';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// OSRM public demo server — free, key-less routing. Profile is fixed to "driving"
// on the demo host, so non-driving modes still route by road (duration is driving-based).
const OSRM = 'https://router.project-osrm.org';

/**
 * Free, key-less driving-directions panel built on Leaflet + OpenStreetMap, with
 * routing via the OSRM demo server. Drop-in fallback for GoogleMapDirections.
 *
 * Props mirror GoogleMapDirections:
 *   destination     { lat, lng, address }   (required)
 *   originFallback  { lat, lng, address }   (optional)
 *   travelMode?     string                  (label only; OSRM demo = driving)
 *   height?         number                  (default 300)
 */
export default function LeafletDirections({ destination, originFallback, travelMode = 'DRIVING', height = 300 }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const routeLayerRef = useRef(null);

  const [origin, setOrigin] = useState(null);
  const [locating, setLocating] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);

  // ---- Resolve origin: browser geolocation → fallback --------------------
  const resolveOrigin = () => {
    setError(null);
    if (!navigator.geolocation) {
      if (originFallback?.lat != null && originFallback?.lng != null) {
        setOrigin({ lat: originFallback.lat, lng: originFallback.lng });
      } else {
        setError('Geolocation not supported and no fallback location available.');
      }
      setLocating(false);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      (err) => {
        if (originFallback?.lat != null && originFallback?.lng != null) {
          setOrigin({ lat: originFallback.lat, lng: originFallback.lng });
          setError(`Using your profile location as origin (${err.code === 1 ? 'permission denied' : 'GPS unavailable'}).`);
        } else {
          setError(err.message || 'Could not get your location.');
        }
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    resolveOrigin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Init map once -----------------------------------------------------
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const center = origin || (destination?.lat != null ? { lat: destination.lat, lng: destination.lng } : { lat: 18.5204, lng: 73.8567 });
    const map = L.map(mapContainerRef.current).setView([center.lat, center.lng], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 0);
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Fetch + draw route once origin & destination are ready ------------
  useEffect(() => {
    if (!mapRef.current || !origin || destination?.lat == null || destination?.lng == null) return;

    let cancelled = false;
    const map = mapRef.current;

    const o = [origin.lng, origin.lat];
    const d = [destination.lng, destination.lat];

    (async () => {
      try {
        const res = await fetch(
          `${OSRM}/route/v1/driving/${o[0]},${o[1]};${d[0]},${d[1]}?overview=full&geometries=geojson`,
          { headers: { Accept: 'application/json' } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const route = data?.routes?.[0];
        if (!route) throw new Error(data?.message || 'No route found');

        // Clear previous route + markers
        if (routeLayerRef.current) {
          map.removeLayer(routeLayerRef.current);
          routeLayerRef.current = null;
        }
        const group = L.featureGroup().addTo(map);
        routeLayerRef.current = group;

        L.geoJSON(route.geometry, { style: { color: '#2563eb', weight: 5, opacity: 0.8 } }).addTo(group);
        L.marker([origin.lat, origin.lng], { icon: locationPinIcon }).addTo(group).bindPopup('Start (you)');
        L.marker([destination.lat, destination.lng], { icon: locationPinIcon }).addTo(group).bindPopup(destination.address || 'Pickup');
        map.fitBounds(group.getBounds(), { padding: [40, 40] });

        const km = route.distance / 1000;
        const mins = Math.round(route.duration / 60);
        setSummary({
          distance: km >= 1 ? `${km.toFixed(1)} km` : `${Math.round(route.distance)} m`,
          duration: mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`,
        });
        setError(null);
      } catch (e) {
        if (!cancelled) setError(`Could not compute route (${e?.message || 'error'}).`);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, destination?.lat, destination?.lng]);

  // Navigate button → OpenStreetMap directions (no key, opens in new tab).
  const navUrl =
    destination?.lat != null && origin
      ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${origin.lat}%2C${origin.lng}%3B${destination.lat}%2C${destination.lng}`
      : destination?.lat != null
        ? `https://www.openstreetmap.org/?mlat=${destination.lat}&mlon=${destination.lng}#map=16/${destination.lat}/${destination.lng}`
        : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {summary ? (
          <>
            <span className="px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary font-semibold">
              {summary.distance}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary font-semibold">
              ≈ {summary.duration}
            </span>
            <span className="text-xs text-muted-foreground">via road (OSRM)</span>
          </>
        ) : locating ? (
          <span className="flex items-center gap-2 text-muted-foreground text-xs">
            <Loader2 className="w-3 h-3 animate-spin" /> Getting your current location…
          </span>
        ) : null}
        <Button type="button" variant="outline" size="sm" className="ml-auto gap-1.5" onClick={resolveOrigin} disabled={locating}>
          <RefreshCw className={`w-3.5 h-3.5 ${locating ? 'animate-spin' : ''}`} />
          Refresh my location
        </Button>
        {navUrl && (
          <a href={navUrl} target="_blank" rel="noreferrer">
            <Button type="button" size="sm" className="gap-1.5">
              <Navigation className="w-3.5 h-3.5" /> Navigate
              <ExternalLink className="w-3 h-3 opacity-80" />
            </Button>
          </a>
        )}
      </div>

      {error && (
        <div className="p-2 rounded-md border border-red-200 bg-red-50 text-red-900 text-xs">{error}</div>
      )}

      <div
        ref={mapContainerRef}
        style={{ width: '100%', height, borderRadius: 8, overflow: 'hidden' }}
        className="border border-border z-0"
      />

      {destination?.address && (
        <div className="text-xs text-muted-foreground">
          <strong className="text-foreground">To:</strong> {destination.address}
        </div>
      )}
    </div>
  );
}
