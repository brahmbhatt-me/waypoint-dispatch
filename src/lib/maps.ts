/**
 * temple-transport/src/lib/maps.ts
 *
 * Google Maps API integration:
 *  - Geocoding: address → lat/lng
 *  - Places Autocomplete: for address input UX
 *  - Distance Matrix: for accurate route time estimates (optional, costs $)
 *
 * COST NOTES (as of 2024):
 *  Geocoding API:      $5 per 1,000 requests
 *  Places API:         $17 per 1,000 autocomplete sessions
 *  Distance Matrix:    $5 per 1,000 elements
 *  Maps JS API:        $7 per 1,000 loads
 *
 *  For 40 passengers per week: ~40 geocodes = $0.20/week → ~$10/year
 *  Use free tier (200/month credit) → effectively FREE at this scale
 */

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY!;

export interface GeocodeResult {
  address: string; // formatted address from Google
  lat: number;
  lng: number;
}

/**
 * Geocode an address string to lat/lng.
 * Called server-side when a passenger submits their address.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn("GOOGLE_MAPS_API_KEY not set — using approximate coordinates");
    return null;
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    address
  )}&key=${GOOGLE_MAPS_API_KEY}&region=us&bounds=42.2,−71.5|42.7,−70.8`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "OK" || data.results.length === 0) {
      console.error("Geocode failed:", data.status, address);
      return null;
    }

    const result = data.results[0];
    return {
      address: result.formatted_address,
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
    };
  } catch (err) {
    console.error("Geocode error:", err);
    return null;
  }
}

/**
 * Batch geocode multiple addresses.
 * Returns array of results (null where geocoding failed).
 * Small delays between requests to avoid rate limiting.
 */
export async function batchGeocode(
  addresses: string[]
): Promise<(GeocodeResult | null)[]> {
  const results: (GeocodeResult | null)[] = [];
  for (const address of addresses) {
    const result = await geocodeAddress(address);
    results.push(result);
    // Small delay to respect rate limits
    await new Promise((r) => setTimeout(r, 50));
  }
  return results;
}

/**
 * Get estimated driving time (in minutes) between origin and multiple destinations.
 * Uses Google Distance Matrix API.
 *
 * USAGE: Call this AFTER clustering to get accurate route time estimates per car.
 * Don't call for clustering itself (use haversine instead to save cost).
 */
export async function getDistanceMatrix(
  origin: { lat: number; lng: number },
  destinations: { lat: number; lng: number }[]
): Promise<number[] | null> {
  if (!GOOGLE_MAPS_API_KEY || destinations.length === 0) return null;

  const origStr = `${origin.lat},${origin.lng}`;
  const destStr = destinations.map((d) => `${d.lat},${d.lng}`).join("|");

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origStr}&destinations=${destStr}&key=${GOOGLE_MAPS_API_KEY}&units=imperial&mode=driving`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "OK") return null;

    return data.rows[0].elements.map((el: any) =>
      el.status === "OK" ? Math.round(el.duration.value / 60) : 30
    );
  } catch {
    return null;
  }
}

/**
 * Generate a shareable Google Maps URL for a multi-stop route.
 * Origin: BAPS Temple Lowell
 * Waypoints: ordered intermediate stops
 * Destination: final stop
 *
 * Max 9 waypoints in Maps URL (we never exceed this for 3-8 passenger stops).
 */
export function buildGoogleMapsUrl(stops: string[]): string {
  if (stops.length === 0) return "";

  const TEMPLE = "BAPS+Swaminarayan+Mandir,+84+Industrial+Ave+E,+Lowell,+MA+01852";
  const encodedStops = stops.map((s) => encodeURIComponent(s));

  if (stops.length === 1) {
    return `https://www.google.com/maps/dir/?api=1&origin=${TEMPLE}&destination=${encodedStops[0]}&travelmode=driving`;
  }

  const destination = encodedStops[encodedStops.length - 1];
  const waypoints = encodedStops.slice(0, -1).join("|");

  return `https://www.google.com/maps/dir/?api=1&origin=${TEMPLE}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`;
}

/**
 * Build Apple Maps URL (fallback for iOS users who prefer Apple Maps)
 */
export function buildAppleMapsUrl(stops: string[]): string {
  if (stops.length === 0) return "";
  const TEMPLE = "BAPS Swaminarayan Mandir, 84 Industrial Ave E, Lowell, MA 01852";
  const allStops = [TEMPLE, ...stops];
  const addr = allStops.map((s) => encodeURIComponent(s)).join("/");
  return `http://maps.apple.com/?daddr=${addr}&dirflg=d`;
}
