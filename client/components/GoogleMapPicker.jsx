import { useEffect, useRef, useState } from 'react';
import { MapPin, Crosshair, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import LeafletMapPicker from './LeafletMapPicker';

/**
 * Google Maps picker with "Use my location" reverse-geocoding.
 *
 * Props:
 *   value     { lat, lng, address }
 *   onChange  ({ lat, lng, address }) => void
 *
 * Behaviour:
 *   • With VITE_GOOGLE_MAPS_API_KEY  → full map + Places autocomplete + reverse geocoding.
 *   • Without the key                → manual address field + "Use my location" (fills coords + address via browser reverse geocode if available).
 */
export default function GoogleMapPicker({ value, onChange }) {
  const mapContainerRef = useRef(null);
  const inputRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const geocoderRef = useRef(null);

  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [locating, setLocating] = useState(false);
  // Hard failures (bad key, script error, init crash) flip to the manual UI.
  // Soft errors (geolocation denied, etc.) only set `error` and keep the map.
  const [mapUnavailable, setMapUnavailable] = useState(false);

  const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  const defaultCenter = { lat: 18.5204, lng: 73.8567 }; // Pune

  // ---- 1. Load Google Maps script once ------------------------------------
  useEffect(() => {
    if (!apiKey) return;

    // Global auth-failure callback (fires when key / billing / referrers reject us).
    // Expose the last reason on window so our in-app error surface catches it.
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

  // ---- 2. Initialise map + marker + autocomplete once loaded --------------
  // NOTE: the script is loaded with `loading=async`, so the legacy globals
  // (google.maps.Map, Marker, Geocoder, places.Autocomplete) are NOT populated
  // at script.onload. We must resolve each class via google.maps.importLibrary().
  useEffect(() => {
    if (!loaded || !mapContainerRef.current || !window.google?.maps?.importLibrary) return;

    let cancelled = false;

    (async () => {
      try {
        const startCenter =
          value?.lat != null && value?.lng != null ? { lat: value.lat, lng: value.lng } : defaultCenter;

        const [{ Map }, { Marker }, { Geocoder }, placesLib] = await Promise.all([
          window.google.maps.importLibrary('maps'),
          window.google.maps.importLibrary('marker'),
          window.google.maps.importLibrary('geocoding'),
          window.google.maps.importLibrary('places'),
        ]);

        if (cancelled || !mapContainerRef.current) return;

        const map = new Map(mapContainerRef.current, {
          center: startCenter,
          zoom: value?.lat != null ? 16 : 13,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });
        const marker = new Marker({
          position: startCenter,
          map,
          draggable: true,
        });
        const geocoder = new Geocoder();

        mapRef.current = map;
        markerRef.current = marker;
        geocoderRef.current = geocoder;

        // Reverse geocode helper
        const pushUpdate = (latLng) => {
          const lat = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat;
          const lng = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng;
          geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            const address = status === 'OK' && results?.[0]?.formatted_address ? results[0].formatted_address : '';
            onChange?.({ lat, lng, address: address || value?.address || '' });
            if (inputRef.current && address) inputRef.current.value = address;
          });
        };

        marker.addListener('dragend', () => pushUpdate(marker.getPosition()));
        map.addListener('click', (e) => {
          marker.setPosition(e.latLng);
          pushUpdate(e.latLng);
        });

        if (inputRef.current && placesLib?.Autocomplete) {
          const ac = new placesLib.Autocomplete(inputRef.current, {
            fields: ['geometry', 'formatted_address'],
          });
          ac.bindTo('bounds', map);
          ac.addListener('place_changed', () => {
            const place = ac.getPlace();
            if (!place?.geometry?.location) return;
            const loc = place.geometry.location;
            map.setCenter(loc);
            map.setZoom(16);
            marker.setPosition(loc);
            onChange?.({
              lat: loc.lat(),
              lng: loc.lng(),
              address: place.formatted_address || inputRef.current.value,
            });
          });
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Failed to initialize Google Maps.');
          setMapUnavailable(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // ---- 3. "Use my location" ----------------------------------------------
  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported by your browser');
      return;
    }
    setError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const coords = { lat, lng };

        // Recenter map + move marker if the map is live
        if (mapRef.current) {
          mapRef.current.setCenter(coords);
          mapRef.current.setZoom(16);
        }
        if (markerRef.current) markerRef.current.setPosition(coords);

        // Reverse geocode so the address field gets a human-readable string
        if (geocoderRef.current) {
          geocoderRef.current.geocode({ location: coords }, (results, status) => {
            const address =
              status === 'OK' && results?.[0]?.formatted_address ? results[0].formatted_address : '';
            onChange?.({ lat, lng, address });
            if (inputRef.current) inputRef.current.value = address;
            setLocating(false);
          });
        } else if (window.google?.maps?.importLibrary) {
          // Script loaded but map never rendered — still try to geocode.
          // With loading=async, Geocoder is only available after importLibrary.
          (async () => {
            try {
              const { Geocoder } = await window.google.maps.importLibrary('geocoding');
              const gc = new Geocoder();
              gc.geocode({ location: coords }, (results, status) => {
                const address =
                  status === 'OK' && results?.[0]?.formatted_address ? results[0].formatted_address : '';
                onChange?.({ lat, lng, address });
                setLocating(false);
              });
            } catch {
              onChange?.({ lat, lng, address: value?.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
              setLocating(false);
            }
          })();
        } else {
          // No API key — fill coordinates as a readable placeholder address
          onChange?.({ lat, lng, address: value?.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
          setLocating(false);
        }
      },
      (err) => {
        const msg =
          err.code === 1
            ? 'Location permission denied. Please allow it in your browser.'
            : err.code === 2
              ? 'Location unavailable. Check GPS / network.'
              : err.code === 3
                ? 'Getting location timed out. Try again.'
                : err.message || 'Could not get your location.';
        setError(msg);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
    );
  };

  // ---- 4. Fallback when no API key or Google auth/load fails --------------
  // Use the free Leaflet + OpenStreetMap picker (no key / billing required).
  if (!apiKey || mapUnavailable) {
    return <LeafletMapPicker value={value} onChange={onChange} />;
  }

  // ---- 5. Full map UI ----------------------------------------------------
  return (
    <div className="space-y-2">
      {error && (
        <div className="p-2 rounded-md border border-red-200 bg-red-50 text-red-900 text-xs">{error}</div>
      )}
      <div className="flex items-center gap-2">
        <MapPin className="w-4 h-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search an address, pick a suggestion, or type freely"
          defaultValue={value?.address || ''}
          onChange={(e) => onChange?.({ ...(value || {}), address: e.target.value })}
          className="flex-1 px-3 py-2 rounded-md border border-border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
        />
        <Button type="button" variant="outline" size="sm" onClick={useMyLocation} disabled={locating} className="gap-2">
          {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
          {locating ? 'Locating…' : 'My location'}
        </Button>
      </div>
      <div
        ref={mapContainerRef}
        style={{ width: '100%', height: 280, borderRadius: 8, overflow: 'hidden' }}
      />
      {value?.lat != null && value?.lng != null && (
        <p className="text-xs text-muted-foreground">
          Pinned: {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
          {value?.address && <> · {value.address}</>}
        </p>
      )}
    </div>
  );
}
