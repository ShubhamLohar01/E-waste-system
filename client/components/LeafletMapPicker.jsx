import { useEffect, useRef, useState } from 'react';
import { MapPin, Crosshair, Loader2, Search, Plus, X } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { locationPinIcon } from './leafletIcon';
import { Button } from './ui/button';

// Vite/bundler fix: Leaflet's default marker images otherwise resolve to broken URLs.
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const NOMINATIM = 'https://nominatim.openstreetmap.org';

/**
 * Free, key-less location picker built on Leaflet + OpenStreetMap tiles, with
 * geocoding via Nominatim. Drop-in compatible with GoogleMapPicker.
 *
 * Props:
 *   value     { lat, lng, address }
 *   onChange  ({ lat, lng, address }) => void
 *
 * Nominatim usage policy: keep it light (≤1 req/sec). Search is debounced and
 * reverse-geocoding only fires on explicit user actions (drag / click / locate).
 */
export default function LeafletMapPicker({ value, onChange }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const searchAbortRef = useRef(null);

  const [error, setError] = useState(null);
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState(value?.address || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  // Address found by "Use my location", held for the user to confirm via "Add".
  const [detected, setDetected] = useState(null); // { lat, lng, address }

  // Keep latest props accessible inside Leaflet event handlers without re-binding.
  onChangeRef.current = onChange;
  valueRef.current = value;

  const defaultCenter = { lat: 18.5204, lng: 73.8567 }; // Pune

  // ---- Reverse geocode (coords → address) --------------------------------
  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(
        `${NOMINATIM}/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data?.display_name || '';
    } catch {
      return '';
    }
  };

  const pushUpdate = async (lat, lng) => {
    const address = (await reverseGeocode(lat, lng)) || valueRef.current?.address || '';
    onChangeRef.current?.({ lat, lng, address });
    setQuery(address);
  };

  // ---- 1. Init Leaflet map once ------------------------------------------
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const start =
      value?.lat != null && value?.lng != null ? { lat: value.lat, lng: value.lng } : defaultCenter;

    const map = L.map(mapContainerRef.current).setView([start.lat, start.lng], value?.lat != null ? 16 : 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const marker = L.marker([start.lat, start.lng], { draggable: true, icon: locationPinIcon }).addTo(map);

    marker.on('dragend', () => {
      const { lat, lng } = marker.getLatLng();
      pushUpdate(lat, lng);
    });
    map.on('click', (e) => {
      marker.setLatLng(e.latlng);
      pushUpdate(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;

    // Leaflet needs a size recalc if the container animates/mounts in a modal.
    setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- 2. Forward search (debounced Nominatim autocomplete) --------------
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    // Don't search the exact string we just reverse-geocoded into the box.
    if (q === (value?.address || '').trim()) return;

    const t = setTimeout(async () => {
      try {
        searchAbortRef.current?.abort();
        const ctrl = new AbortController();
        searchAbortRef.current = ctrl;
        setSearching(true);
        const res = await fetch(
          `${NOMINATIM}/search?format=jsonv2&limit=5&addressdetails=0&q=${encodeURIComponent(q)}`,
          { headers: { Accept: 'application/json' }, signal: ctrl.signal }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data : []);
        setShowSuggestions(true);
      } catch (e) {
        if (e?.name !== 'AbortError') setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 500); // respect Nominatim ≤1 req/sec

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const selectSuggestion = (s) => {
    const lat = parseFloat(s.lat);
    const lng = parseFloat(s.lon);
    setShowSuggestions(false);
    setSuggestions([]);
    setQuery(s.display_name);
    if (mapRef.current) mapRef.current.setView([lat, lng], 16);
    if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
    onChangeRef.current?.({ lat, lng, address: s.display_name });
  };

  // ---- 3. "Use my location" ----------------------------------------------
  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported by your browser');
      return;
    }
    setError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (mapRef.current) mapRef.current.setView([lat, lng], 16);
        if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
        // Capture the coordinates immediately, but let the user decide whether to
        // put the detected address into the field via the "Add" button below.
        const address = (await reverseGeocode(lat, lng)) || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        onChangeRef.current?.({ lat, lng, address: valueRef.current?.address || '' });
        setDetected({ lat, lng, address });
        setLocating(false);
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

  // Put the detected address into the address field (user-confirmed).
  const addDetectedAddress = () => {
    if (!detected) return;
    setQuery(detected.address);
    onChangeRef.current?.({ lat: detected.lat, lng: detected.lng, address: detected.address });
    setDetected(null);
  };

  // ---- 4. UI -------------------------------------------------------------
  return (
    <div className="space-y-2">
      {error && (
        <div className="p-2 rounded-md border border-red-200 bg-red-50 text-red-900 text-xs">{error}</div>
      )}
      <div className="relative">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="relative flex-1">
            <input
              type="text"
              value={query}
              placeholder="Search an address, pick a suggestion, or type freely"
              onChange={(e) => {
                setQuery(e.target.value);
                onChange?.({ ...(value || {}), address: e.target.value });
              }}
              onFocus={() => suggestions.length && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              className="w-full px-3 py-2 pr-8 rounded-md border border-border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </span>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={useMyLocation} disabled={locating} className="gap-2 shrink-0">
            {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
            {locating ? 'Locating…' : 'My location'}
          </Button>
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute z-[1000] left-6 right-0 mt-1 max-h-56 overflow-y-auto rounded-md border border-border bg-popover shadow-lg text-sm">
            {suggestions.map((s) => (
              <li key={s.place_id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectSuggestion(s)}
                  className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground"
                >
                  {s.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {detected && (
        <div className="flex items-start gap-2 p-2.5 rounded-md border border-primary/30 bg-primary/5 text-xs">
          <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground">Detected location</p>
            <p className="text-muted-foreground break-words">{detected.address}</p>
          </div>
          <Button type="button" size="sm" onClick={addDetectedAddress} className="gap-1 shrink-0">
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
          <button
            type="button"
            onClick={() => setDetected(null)}
            aria-label="Dismiss detected location"
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div
        ref={mapContainerRef}
        style={{ width: '100%', height: 280, borderRadius: 8, overflow: 'hidden' }}
        className="border border-border z-0"
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
