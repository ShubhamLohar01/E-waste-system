import L from 'leaflet';
import pinUrl from '../assets/location-pin.svg';

/**
 * Shared red location-pin marker for all Leaflet maps.
 * Anchor is the tip (bottom-center) so the point sits exactly on the coordinate.
 */
export const locationPinIcon = L.icon({
  iconUrl: pinUrl,
  iconSize: [30, 40],
  iconAnchor: [15, 40],
  popupAnchor: [0, -36],
});
