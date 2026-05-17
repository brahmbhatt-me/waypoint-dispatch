/**
 * Google Maps integration with:
 * - Geocoding API: address → lat/lng
 * - Directions API: traffic-aware routing, no tolls
 */

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY!;

export const TEMPLE = {
  lat: 42.6334,
  lng: -71.3162,
  address: "BAPS Swaminarayan Mandir, 84 Industrial Ave E, Lowell, MA 01852",
};

export const RUGGLES = {
  lat: 42.3365,
  lng: -71.0997,
  address: "Ruggles Station, Boston, MA 02120",
};

export interface GeocodeResult {
  address: string;
  lat: number;
  lng: number;
}

export interface DirectionsResult {
  mapsUrl: string;
  estimatedMinutes: number;
  optimizedStopOrder?: string[];
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  if (!GOOGLE_MAPS_API_KEY) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}&region=us`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== "OK" || !data.results[0]) return null;
    return {
      address: data.results[0].formatted_address,
      lat: data.results[0].geometry.location.lat,
      lng: data.results[0].geometry.location.lng,
    };
  } catch { return null; }
}

export async function getOptimizedRoute(
  originAddress: string,
  stops: { attendanceId: string; address: string; lat: number; lng: number }[]
): Promise<DirectionsResult> {
  const fallback = buildFallbackResult(originAddress, stops);
  if (!GOOGLE_MAPS_API_KEY || stops.length === 0) return fallback;

  const destination = stops[stops.length - 1];
  const waypoints = stops.slice(0, -1);
  const waypointsStr = waypoints.length > 0
    ? `optimize:true|${waypoints.map((s) => `${s.lat},${s.lng}`).join("|")}`
    : "";

  const params: Record<string, string> = {
    origin: encodeURIComponent(originAddress),
    destination: `${destination.lat},${destination.lng}`,
    key: GOOGLE_MAPS_API_KEY,
    avoid: "tolls",
    departure_time: "now",
    traffic_model: "best_guess",
  };
  if (waypointsStr) params.waypoints = waypointsStr;

  const queryString = Object.entries(params).map(([k, v]) => `${k}=${v}`).join("&");

  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${queryString}`);
    const data = await res.json();

    if (data.status !== "OK") {
      console.error("Directions API:", data.status);
      return fallback;
    }

    const route = data.routes[0];
    const optimizedOrder: number[] = route.waypoint_order ?? [];

    const totalSeconds = route.legs.reduce(
      (sum: number, leg: any) => sum + (leg.duration_in_traffic?.value ?? leg.duration.value), 0
    );

    // Reorder stops based on Google optimization
    let orderedStops = [...stops];
    if (optimizedOrder.length > 0 && waypoints.length > 0) {
      const reordered = optimizedOrder.map((i) => waypoints[i]);
      orderedStops = [...reordered, destination];
    }

    return {
      mapsUrl: buildGoogleMapsUrl(originAddress, orderedStops.map((s) => s.address)),
      estimatedMinutes: Math.round(totalSeconds / 60),
      optimizedStopOrder: orderedStops.map((s) => s.attendanceId),
    };
  } catch (err) {
    console.error("Directions API error:", err);
    return fallback;
  }
}

function buildFallbackResult(
  originAddress: string,
  stops: { attendanceId: string; address: string }[]
): DirectionsResult {
  return {
    mapsUrl: buildGoogleMapsUrl(originAddress, stops.map((s) => s.address)),
    estimatedMinutes: 30,
    optimizedStopOrder: stops.map((s) => s.attendanceId),
  };
}

export function buildGoogleMapsUrl(origin: string, stops: string[]): string {
  if (stops.length === 0) return "";
  const destination = stops[stops.length - 1];
  const waypoints = stops.slice(0, -1);
  const base = "https://www.google.com/maps/dir/?api=1";
  const parts = [
    `origin=${encodeURIComponent(origin)}`,
    `destination=${encodeURIComponent(destination)}`,
    waypoints.length > 0 ? `waypoints=${waypoints.map(encodeURIComponent).join("|")}` : "",
    "travelmode=driving",
    "avoid=tolls",
  ].filter(Boolean).join("&");
  return `${base}&${parts}`;
}

export function validateUSPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 10) return false;
  if (parseInt(digits[0]) < 2) return false;
  if (parseInt(digits[3]) < 2) return false;
  return true;
}
