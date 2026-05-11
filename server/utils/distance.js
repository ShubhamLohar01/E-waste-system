const toRad = (d) => (d * Math.PI) / 180;

export function haversineKm(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return Infinity;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function sortByDistanceFrom(origin, items, coordOf) {
  return [...items]
    .map((it) => ({ item: it, distanceKm: haversineKm(origin, coordOf(it)) }))
    .sort((x, y) => x.distanceKm - y.distanceKm);
}
