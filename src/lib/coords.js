/** "48.85661, 2.35222" → [lat, lng] (or null). This is exactly what Google Maps copies. */
export function parseCoordinates(value) {
  const m = String(value ?? '').match(/(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [lat, lng] : null;
}
