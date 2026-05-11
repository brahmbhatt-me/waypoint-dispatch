/**
 * temple-transport/src/lib/clustering.ts
 *
 * Core algorithm for assigning passengers to cars and optimizing routes.
 *
 * ALGORITHM OVERVIEW:
 * 1. K-means clustering on lat/lng to group geographically nearby passengers
 * 2. Seat-capacity balancing: if a cluster exceeds car capacity, overflow is
 *    reassigned to nearest under-capacity cluster
 * 3. Within each cluster: Nearest-Neighbor TSP starting from the temple to
 *    find a good (not necessarily optimal) dropoff order
 * 4. Google Maps URL generation for each route
 *
 * WHY K-MEANS OVER OTHER APPROACHES:
 * - 30-50 passengers → small enough that K-means converges fast (<100ms)
 * - Geographic clustering is intuitive: North/South/West naturally separate
 * - OR-Tools is overkill for this scale
 * - Google Distance Matrix API costs $5/1000 requests; haversine is free
 *   for clustering, reserve API calls for final route ordering only
 */

export interface PassengerPoint {
  attendanceId: string;
  userId: string;
  name: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  notes?: string | null;
}

export interface DriverSlot {
  driverSessionId: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  carType?: string | null;
  seats: number; // passenger seats (not counting driver)
}

export interface ClusterResult {
  driverSessionId: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  carType?: string | null;
  seats: number;
  passengers: PassengerPoint[];
  stopOrder: string[]; // attendanceIds in optimized order
  mapsUrl: string;
}

// BAPS Temple Lowell coordinates (origin of return trip)
const TEMPLE_LAT = 42.6334;
const TEMPLE_LNG = -71.3162;
const TEMPLE_ADDRESS = "BAPS Swaminarayan Mandir, 84 Industrial Ave E, Lowell, MA 01852";

/**
 * Haversine distance between two lat/lng points, in km.
 * Fast enough for clustering without API calls.
 */
export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Run K-means clustering on passenger lat/lng.
 * Returns k arrays of passengers.
 * k = number of available drivers.
 */
function kmeansClusters(
  passengers: PassengerPoint[],
  k: number,
  maxIter = 100
): PassengerPoint[][] {
  if (passengers.length === 0 || k === 0) return [];
  if (k >= passengers.length) {
    // More drivers than passengers — one passenger per driver (some will be empty)
    return passengers.map((p) => [p]);
  }

  // Initialize centroids using K-means++ strategy (better spread than random)
  const centroids: { lat: number; lng: number }[] = [];
  // First centroid: random passenger
  const firstIdx = Math.floor(Math.random() * passengers.length);
  centroids.push({ lat: passengers[firstIdx].lat, lng: passengers[firstIdx].lng });

  // Subsequent centroids: choose with probability proportional to dist^2
  for (let c = 1; c < k; c++) {
    const distances = passengers.map((p) => {
      const minDist = Math.min(
        ...centroids.map((cent) => haversineKm(p.lat, p.lng, cent.lat, cent.lng))
      );
      return minDist ** 2;
    });
    const total = distances.reduce((a, b) => a + b, 0);
    let rand = Math.random() * total;
    let chosen = 0;
    for (let i = 0; i < distances.length; i++) {
      rand -= distances[i];
      if (rand <= 0) { chosen = i; break; }
    }
    centroids.push({ lat: passengers[chosen].lat, lng: passengers[chosen].lng });
  }

  let clusters: PassengerPoint[][] = Array.from({ length: k }, () => []);

  for (let iter = 0; iter < maxIter; iter++) {
    // Assignment step
    const newClusters: PassengerPoint[][] = Array.from({ length: k }, () => []);
    for (const p of passengers) {
      let minDist = Infinity;
      let bestCluster = 0;
      for (let i = 0; i < k; i++) {
        const d = haversineKm(p.lat, p.lng, centroids[i].lat, centroids[i].lng);
        if (d < minDist) { minDist = d; bestCluster = i; }
      }
      newClusters[bestCluster].push(p);
    }

    // Update step — recalculate centroids
    let converged = true;
    for (let i = 0; i < k; i++) {
      if (newClusters[i].length === 0) continue; // keep old centroid
      const newLat = newClusters[i].reduce((s, p) => s + p.lat, 0) / newClusters[i].length;
      const newLng = newClusters[i].reduce((s, p) => s + p.lng, 0) / newClusters[i].length;
      if (Math.abs(newLat - centroids[i].lat) > 0.0001 || Math.abs(newLng - centroids[i].lng) > 0.0001) {
        converged = false;
      }
      centroids[i] = { lat: newLat, lng: newLng };
    }

    clusters = newClusters;
    if (converged) break;
  }

  return clusters;
}

/**
 * Balance clusters so no cluster exceeds its assigned driver's seat count.
 * Strategy: move overflow passengers to nearest cluster with available capacity.
 */
function balanceClusters(
  clusters: PassengerPoint[][],
  drivers: DriverSlot[]
): PassengerPoint[][] {
  const balanced = clusters.map((c) => [...c]);

  for (let i = 0; i < balanced.length; i++) {
    const seats = drivers[i]?.seats ?? 4;
    while (balanced[i].length > seats) {
      // Remove the passenger farthest from this cluster's centroid
      const centLat = balanced[i].reduce((s, p) => s + p.lat, 0) / balanced[i].length;
      const centLng = balanced[i].reduce((s, p) => s + p.lng, 0) / balanced[i].length;
      let farthestIdx = 0;
      let maxDist = 0;
      for (let j = 0; j < balanced[i].length; j++) {
        const d = haversineKm(balanced[i][j].lat, balanced[i][j].lng, centLat, centLng);
        if (d > maxDist) { maxDist = d; farthestIdx = j; }
      }
      const overflow = balanced[i].splice(farthestIdx, 1)[0];

      // Find the nearest cluster that still has capacity
      let bestTarget = -1;
      let bestDist = Infinity;
      for (let j = 0; j < balanced.length; j++) {
        if (j === i) continue;
        if (balanced[j].length >= (drivers[j]?.seats ?? 4)) continue;
        const targetCentLat = balanced[j].length > 0
          ? balanced[j].reduce((s, p) => s + p.lat, 0) / balanced[j].length
          : TEMPLE_LAT;
        const targetCentLng = balanced[j].length > 0
          ? balanced[j].reduce((s, p) => s + p.lng, 0) / balanced[j].length
          : TEMPLE_LNG;
        const d = haversineKm(overflow.lat, overflow.lng, targetCentLat, targetCentLng);
        if (d < bestDist) { bestDist = d; bestTarget = j; }
      }

      if (bestTarget >= 0) {
        balanced[bestTarget].push(overflow);
      } else {
        // No capacity anywhere — put back (shouldn't happen if seats >= passengers)
        balanced[i].push(overflow);
        break;
      }
    }
  }

  return balanced;
}

/**
 * Nearest-Neighbor TSP heuristic.
 * Starting from the temple, greedily pick the nearest unvisited passenger.
 * Returns attendanceIds in visit order.
 * Good enough for 3–8 stops (within 10–15% of optimal).
 */
function nearestNeighborOrder(passengers: PassengerPoint[]): string[] {
  if (passengers.length === 0) return [];
  if (passengers.length === 1) return [passengers[0].attendanceId];

  const unvisited = [...passengers];
  const order: string[] = [];
  let currentLat = TEMPLE_LAT;
  let currentLng = TEMPLE_LNG;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < unvisited.length; i++) {
      const d = haversineKm(currentLat, currentLng, unvisited[i].lat, unvisited[i].lng);
      if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
    }
    const next = unvisited.splice(nearestIdx, 1)[0];
    order.push(next.attendanceId);
    currentLat = next.lat;
    currentLng = next.lng;
  }

  return order;
}

/**
 * Build a Google Maps Directions URL.
 * Format: origin=Temple, waypoints=stop1|stop2|..., destination=last stop
 * Google Maps URL supports up to 9 waypoints (fine for our 3–8 stops).
 */
function buildMapsUrl(passengers: PassengerPoint[], stopOrder: string[]): string {
  const orderedPassengers = stopOrder
    .map((id) => passengers.find((p) => p.attendanceId === id))
    .filter(Boolean) as PassengerPoint[];

  if (orderedPassengers.length === 0) return "";

  const origin = encodeURIComponent(TEMPLE_ADDRESS);
  const destination = encodeURIComponent(orderedPassengers[orderedPassengers.length - 1].address);
  const waypoints = orderedPassengers
    .slice(0, -1)
    .map((p) => encodeURIComponent(p.address))
    .join("|");

  const base = "https://www.google.com/maps/dir/?api=1";
  const url = `${base}&origin=${origin}&destination=${destination}${
    waypoints ? `&waypoints=${waypoints}` : ""
  }&travelmode=driving`;

  return url;
}

/**
 * Main entry point.
 * Takes all attending passengers and available drivers, returns full cluster results.
 */
export function generateAssignments(
  passengers: PassengerPoint[],
  drivers: DriverSlot[]
): ClusterResult[] {
  const availableDrivers = drivers.filter((d) =>
    passengers.length > 0 // only include drivers if there are passengers
  );

  if (availableDrivers.length === 0 || passengers.length === 0) return [];

  const k = availableDrivers.length;

  // Step 1: K-means clustering (run 3 times, pick best — lowest total intra-cluster distance)
  let bestClusters: PassengerPoint[][] = [];
  let bestScore = Infinity;

  for (let attempt = 0; attempt < 3; attempt++) {
    const clusters = kmeansClusters(passengers, k);
    const score = clusters.reduce((total, cluster) => {
      if (cluster.length === 0) return total;
      const centLat = cluster.reduce((s, p) => s + p.lat, 0) / cluster.length;
      const centLng = cluster.reduce((s, p) => s + p.lng, 0) / cluster.length;
      return total + cluster.reduce((s, p) => s + haversineKm(p.lat, p.lng, centLat, centLng), 0);
    }, 0);
    if (score < bestScore) { bestScore = score; bestClusters = clusters; }
  }

  // Step 2: Balance for seat capacity
  const balanced = balanceClusters(bestClusters, availableDrivers);

  // Step 3: Build results — match each cluster to its driver
  const results: ClusterResult[] = [];

  for (let i = 0; i < availableDrivers.length; i++) {
    const driver = availableDrivers[i];
    const clusterPassengers = balanced[i] ?? [];

    // Skip drivers with no passengers
    if (clusterPassengers.length === 0) {
      results.push({
        ...driver,
        passengers: [],
        stopOrder: [],
        mapsUrl: "",
      });
      continue;
    }

    // Step 4: Optimize stop order within cluster
    const stopOrder = nearestNeighborOrder(clusterPassengers);

    // Step 5: Build Maps URL
    const mapsUrl = buildMapsUrl(clusterPassengers, stopOrder);

    results.push({
      driverSessionId: driver.driverSessionId,
      driverId: driver.driverId,
      driverName: driver.driverName,
      driverPhone: driver.driverPhone,
      carType: driver.carType,
      seats: driver.seats,
      passengers: clusterPassengers,
      stopOrder,
      mapsUrl,
    });
  }

  return results;
}

/**
 * Utility: get the next Saturday date (for auto-creating trips)
 */
export function getNextSaturday(): Date {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 6=Sat
  const daysUntilSaturday = dayOfWeek === 6 ? 7 : 6 - dayOfWeek;
  const saturday = new Date(today);
  saturday.setDate(today.getDate() + daysUntilSaturday);
  saturday.setHours(0, 0, 0, 0);
  return saturday;
}
