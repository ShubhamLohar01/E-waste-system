import { useEffect, useRef, useState } from 'react';
import { Loader2, ExternalLink, Navigation, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import LeafletDirections from './LeafletDirections';

/**
 * Renders a Google Maps driving-directions panel + map from `origin` (collector's
 * current location, with `originFallback` as backup) to `destination` (pickup point).
 *
 * Props:
 *   destination        { lat, lng, address }   (required)
 *   originFallback     { lat, lng, address }   (optional — used if geolocation fails/denied)
 *   travelMode?        'DRIVING' | 'WALKING' | 'BICYCLING' | 'TWO_WHEELER'  (default DRIVING)
 *   height?            number                   (map height in px; default 300)
 */
export default function GoogleMapDirections({
  destination,
  originFallback,
  travelMode = 'DRIVING',
  height = 300,
}) {
  const mapContainerRef = useRef(null);
  const panelRef = useRef(null);
  const rendererRef = useRef(null);
  const serviceRef = useRef(null);

  const [loaded, setLoaded] = useState(false);
  const [origin, setOrigin] = useState(null);
  const [locating, setLocating] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  // Hard failures (bad key, billing, script error) flip to the free Leaflet fallback.
  const [mapUnavailable, setMapUnavailable] = useState(false);

  const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();

  // ---- Load Google Maps script once ---------------------------------------
  useEffect(() => {
    if (!apiKey) return;

    if (!window.__gmAuthFailureHooked) {
      window.gm_authFailure = () => {
        window.__gmAuthFailureReason =
          'Google Maps authentication failed. Open DevTools → Console for the exact error code (e.g. ApiNotActivatedMapError, RefererNotAllowedMapError, BillingNotEnabledMapError).';
        window.dispatchEvent(new Event('gm-auth-failure'));
      };
      window.__gmAuthFailureHooked = true;
    }
    const onAuthFail = () => {
      setError(window.__gmAuthFailureReason);
      setMapUnavailable(true);
    };
    window.addEventListener('gm-auth-failure', onAuthFail);

    if (window.google?.maps) {
      setLoaded(true);
      return () => window.removeEventListener('gm-auth-failure', onAuthFail);
    }
    const existing = document.querySelector('script[data-google-maps]');
    if (existing) {
      existing.addEventListener('load', () => setLoaded(true));
      return () => window.removeEventListener('gm-auth-failure', onAuthFail);
    }
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly&loading=async`;
    s.async = true;
    s.defer = true;
    s.setAttribute('data-google-maps', 'true');
    s.onload = () => setLoaded(true);
    s.onerror = () => {
      setError('Failed to load Google Maps (network or CORS issue).');
      setMapUnavailable(true);
    };
    document.head.appendChild(s);
    return () => window.removeEventListener('gm-auth-failure', onAuthFail);
  }, [apiKey]);

  // ---- Resolve origin: browser geolocation → fallback ---------------------
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
          setError(
            `Using your profile location as origin (${err.code === 1 ? 'permission denied' : 'GPS unavailable'}).`
          );
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

  // ---- Render map + directions once everything is ready -------------------
  useEffect(() => {
    if (!loaded || !origin || !destination?.lat || !destination?.lng || !mapContainerRef.current)
      return;

    const map = new window.google.maps.Map(mapContainerRef.current, {
      zoom: 12,
      center: origin,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
    });
    const directionsService = new window.google.maps.DirectionsService();
    const directionsRenderer = new window.google.maps.DirectionsRenderer({
      map,
      panel: panelRef.current,
      suppressMarkers: false,
    });
    serviceRef.current = directionsService;
    rendererRef.current = directionsRenderer;

    const mode = window.google.maps.TravelMode[travelMode] || window.google.maps.TravelMode.DRIVING;
    directionsService.route(
      {
        origin,
        destination: { lat: destination.lat, lng: destination.lng },
        travelMode: mode,
      },
      (result, status) => {
        if (status === 'OK' && result) {
          directionsRenderer.setDirections(result);
          const leg = result.routes?.[0]?.legs?.[0];
          if (leg) {
            setSummary({
              distance: leg.distance?.text,
              duration: leg.duration?.text,
              startAddress: leg.start_address,
              endAddress: leg.end_address,
            });
          }
        } else {
          setError(`Could not compute directions (${status}).`);
        }
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, origin, destination?.lat, destination?.lng, travelMode]);

  const mapsUrl =
    destination?.lat != null && destination?.lng != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=${travelMode.toLowerCase()}`
      : null;

  // No key, or Google auth/load failed → free Leaflet + OSRM directions.
  if (!apiKey || mapUnavailable) {
    return (
      <LeafletDirections
        destination={destination}
        originFallback={originFallback}
        travelMode={travelMode}
        height={height}
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {summary ? (
          <>
            <span className="px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary font-semibold">
              {summary.distance}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary font-semibold">
              ≈ {summary.duration}
            </span>
            <span className="text-xs text-muted-foreground">
              via {travelMode.toLowerCase()}
            </span>
          </>
        ) : locating ? (
          <span className="flex items-center gap-2 text-muted-foreground text-xs">
            <Loader2 className="w-3 h-3 animate-spin" /> Getting your current location…
          </span>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto gap-1.5"
          onClick={resolveOrigin}
          disabled={locating}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${locating ? 'animate-spin' : ''}`} />
          Refresh my location
        </Button>
        {mapsUrl && (
          <a href={mapsUrl} target="_blank" rel="noreferrer">
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

      {/* Split view: map on left, turn-by-turn on right (stacks on mobile) */}
      <div className="grid md:grid-cols-2 gap-3">
        <div
          ref={mapContainerRef}
          style={{ width: '100%', height, borderRadius: 8, overflow: 'hidden' }}
          className="border border-border"
        />
        <div
          ref={panelRef}
          className="text-sm border border-border rounded-lg bg-card p-3 overflow-y-auto"
          style={{ height, minHeight: 200 }}
        />
      </div>

      {summary && (
        <div className="text-xs text-muted-foreground grid sm:grid-cols-2 gap-1">
          <div>
            <strong className="text-foreground">From:</strong> {summary.startAddress}
          </div>
          <div>
            <strong className="text-foreground">To:</strong> {summary.endAddress}
          </div>
        </div>
      )}
    </div>
  );
}
