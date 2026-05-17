# Waypoint Dispatch

**A full-stack fleet coordination and route optimization system** for managing recurring multi-vehicle dispatch operations with dynamic passenger assignment and real-time route generation.

Built as a production deployment for a weekly 30–50 person transportation operation in the Greater Boston area.

---

## System Overview

Waypoint Dispatch solves the **multi-vehicle routing problem (MVRP)** for recurring group transportation events where:

- Passenger count and locations change weekly
- Drivers and vehicle capacities change weekly  
- Return trip destinations are geographically distributed
- Last-minute changes (cancellations, walk-ins) must be handled in real time

### Core Algorithm

The assignment engine uses a **K-means++ geographic clustering** approach combined with a **Nearest-Neighbor TSP heuristic** for route ordering:

```
STEP 1 — Geographic Clustering (K-means++)
  Input:  N passengers with lat/lng coordinates
  k:      number of available vehicles
  Output: k clusters of geographically proximate passengers

  K-means++ initialization ensures spread-out initial centroids,
  reducing worst-case convergence time vs. random initialization.
  Run 3x, select minimum intra-cluster distance result.

STEP 2 — Capacity Balancing
  If cluster_size > vehicle_seats:
    Move overflow passengers to nearest under-capacity cluster
    Priority: maximize geographic proximity

STEP 3 — Route Optimization (Nearest-Neighbor TSP)
  For each cluster:
    Starting from depot (fixed origin), greedily select
    nearest unvisited stop until all stops covered.
    O(n²) complexity, within 10-15% of optimal for n ≤ 10.

STEP 4 — Route Generation
  Google Directions API with:
    - Live traffic (departure_time=now)
    - Toll avoidance (avoid=tolls)
    - Waypoint optimization flag
```

### Why this approach

| Approach | Complexity | Quality | Cost |
|---|---|---|---|
| Brute force TSP | O(n!) | Optimal | Free |
| OR-Tools VRP | High setup | Near-optimal | Free |
| Google OR-Tools | Medium | Near-optimal | Free |
| **K-means + NN TSP** | **O(kn)** | **~85-90% optimal** | **Free** |
| Google Distance Matrix | Low | API-quality | $5/1000 |

For n ≤ 10 stops per vehicle, nearest-neighbor TSP produces routes within 10-15% of optimal — undetectable in practice. The full pipeline runs in under 100ms for 50 passengers.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                   │
│                                                             │
│  /signup          /driver/register    /my-assignment        │
│  Passenger form   Driver form         Assignment lookup     │
│                                                             │
│  /admin           /admin/assignments  /admin/history        │
│  Dashboard        Assignment cards    Trip history          │
│                                                             │
│  /driver/[id]     /unregister                               │
│  Driver route     Self-cancel                               │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST API
┌──────────────────────────▼──────────────────────────────────┐
│                    API Layer (Next.js Routes)                │
│                                                             │
│  /api/trips          /api/passengers      /api/drivers      │
│  /api/assignments    /api/assignments/generate              │
│  /api/my-assignment  /api/unregister      /api/cron/*       │
└──────────────────────────┬──────────────────────────────────┘
                           │ Prisma ORM
┌──────────────────────────▼──────────────────────────────────┐
│                  Database (PostgreSQL / Supabase)            │
│                                                             │
│  users  trips  attendances  driver_sessions                 │
│  assignments  address_history                               │
└─────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    External APIs                             │
│  Google Geocoding    Google Directions    Google Places     │
│  (address → coords)  (traffic routing)   (autocomplete)     │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React, TypeScript, TailwindCSS |
| Backend | Next.js API Routes (serverless) |
| Database | PostgreSQL via Supabase |
| ORM | Prisma |
| Maps | Google Maps Platform (Geocoding, Directions, Places) |
| Hosting | Vercel |
| Scheduling | Vercel Cron Jobs |

---

## Database Schema

```prisma
User          — persistent profile (phone as unique key)
Trip          — weekly event instance with two-stage lock state
Attendance    — per-trip passenger record with geocoded dropoff
DriverSession — per-trip driver availability and vehicle capacity
Assignment    — resolved vehicle→passenger mapping with route URL
AddressHistory — per-user address log for autocomplete suggestions
```

### Trip State Machine

```
OPEN → GOING_LOCKED → LOCKED → COMPLETED
  ↑          ↑
  └──────────┘  (admin can unlock at any stage)
```

---

## Key Features

- **Two-stage trip locking** — going trip and return trip managed independently
- **Google Places Autocomplete** — address input with real-time verification
- **Traffic-aware routing** — Google Directions API with live traffic and toll avoidance
- **Walk-in handling** — admin can add passengers at the venue; auto-assigns to least-full vehicle
- **Self-service unregistration** — users cancel their own registration via phone lookup
- **WhatsApp route sharing** — pre-formatted driver messages generated automatically
- **Assignment release panel** — group message summary for broadcast to all participants
- **Automated archival** — Vercel cron job archives completed trips Sunday midnight
- **Session security** — admin authentication with 2-hour expiry timeout

---

## Local Development

### Prerequisites
- Node.js 20+
- PostgreSQL (or Supabase account)
- Google Cloud project with Maps APIs enabled

### Setup

```bash
git clone https://github.com/brahmbhatt-me/waypoint-dispatch.git
cd waypoint-dispatch
npm install
cp .env.example .env.local
# Fill in DATABASE_URL, DIRECT_URL, GOOGLE_MAPS_API_KEY, ADMIN_PASSCODE
npx prisma db push
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
npm run dev
```

### Required Google APIs
- Geocoding API
- Directions API  
- Maps JavaScript API
- Places API

### Environment Variables

```env
DATABASE_URL=           # PostgreSQL connection string (pooler)
DIRECT_URL=             # PostgreSQL direct connection (for migrations)
GOOGLE_MAPS_API_KEY=    # Server-side geocoding and directions
NEXT_PUBLIC_GOOGLE_MAPS_KEY=  # Client-side Places autocomplete
ADMIN_PASSCODE=         # Admin dashboard access code
NEXT_PUBLIC_ADMIN_CODE= # Same as above (client-side)
```

---

## Deployment

Deployed on Vercel with Supabase PostgreSQL.

```bash
npx vercel --prod
```

Set all environment variables in Vercel dashboard before first deployment.

---

## Algorithm Performance

Tested with synthetic data (Boston metro area):

| Passengers | Vehicles | Cluster Time | Route Time | Total |
|---|---|---|---|---|
| 10 | 3 | <1ms | <50ms | <51ms |
| 30 | 6 | <2ms | <100ms | <102ms |
| 50 | 8 | <5ms | <150ms | <155ms |

Route quality vs. optimal (nearest-neighbor vs. brute force for small n):

| Stops/vehicle | NN vs Optimal |
|---|---|
| 3 | 100% |
| 5 | ~93% |
| 8 | ~88% |

---

## Project Structure

```
src/
├── app/
│   ├── admin/              # Admin dashboard and assignment views
│   ├── api/                # REST API routes
│   │   ├── assignments/    # Assignment CRUD and generation
│   │   ├── passengers/     # Passenger management
│   │   ├── drivers/        # Driver management
│   │   ├── trips/          # Trip lifecycle management
│   │   └── cron/           # Scheduled jobs
│   ├── driver/             # Driver-facing route view
│   ├── signup/             # Passenger registration
│   ├── unregister/         # Self-service cancellation
│   └── my-assignment/      # Assignment lookup
├── lib/
│   ├── clustering.ts       # K-means++ and TSP algorithm
│   ├── maps.ts             # Google Maps API integration
│   ├── prisma.ts           # Database client
│   └── utils.ts            # Shared utilities
└── components/
    └── AddressAutocomplete.tsx  # Google Places wrapper
prisma/
    schema.prisma           # Database schema
    seed.ts                 # Development seed data
```

---

## License

MIT

---

*Built as a practical application of multi-agent routing algorithms and full-stack systems engineering.*
