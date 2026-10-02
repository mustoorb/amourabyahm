// Static file generated at build: /globe-land.json — the globe's land dots.
import { landDots } from '../lib/land.js';

export function GET() {
  return new Response(JSON.stringify(landDots()), { headers: { 'Content-Type': 'application/json' } });
}
