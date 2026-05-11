# 🛕 BAPS Temple Transport

A production-ready web application for managing weekly Saturday temple trip carpooling.
Built for **BAPS Boston Campus Connect** — handles 30–50 passengers every Saturday from
Ruggles Station → BAPS Swaminarayan Mandir, Lowell.

**Live flow:** Passengers & drivers sign up online → Admin clicks "Generate Assignments" → 
Algorithm groups nearby passengers into cars → Google Maps routes sent to each driver via WhatsApp.

---

## ✨ Features

- **Passenger signup** — 30 seconds, phone-based, remembers previous addresses
- **Driver registration** — weekly availability + seat count
- **Automatic clustering** — K-means groups nearby passengers, nearest-neighbor optimizes stop order
- **Google Maps links** — one-tap navigation for each driver
- **WhatsApp sharing** — send each driver their route with one click
- **Admin dashboard** — view all signups, generate assignments, lock and export
- **Mobile-first UI** — designed for use on phones Saturday morning

---

## 🗂 Project Structure

```
temple-transport/
├── prisma/
│   ├── schema.prisma         # Full database schema
│   └── seed.ts               # Test data (10 passengers, 3 drivers)
├── src/
│   ├── app/
│   │   ├── page.tsx                       # Landing page
│   │   ├── signup/page.tsx                # Passenger signup (3-step)
│   │   ├── driver/
│   │   │   ├── register/page.tsx          # Driver registration
│   │   │   └── [driverId]/page.tsx        # Driver route view (shareable)
│   │   ├── passenger/[passengerId]/page.tsx  # Passenger assignment view
│   │   ├── admin/
│   │   │   ├── page.tsx                   # Admin dashboard
│   │   │   └── assignments/page.tsx       # Assignment cards + share
│   │   └── api/
│   │       ├── trips/route.ts             # Trip management
│   │       ├── passengers/route.ts        # Passenger CRUD + lookup
│   │       ├── passengers/view/route.ts   # Passenger assignment view
│   │       ├── drivers/route.ts           # Driver CRUD
│   │       ├── assignments/route.ts       # List assignments
│   │       ├── assignments/generate/route.ts  # ⚡ Core algorithm endpoint
│   │       └── assignments/[id]/route.ts  # Single assignment + overrides
│   └── lib/
│       ├── clustering.ts      # K-means + nearest-neighbor algorithm
│       ├── maps.ts            # Google Maps geocoding + URL generation
│       ├── prisma.ts          # DB client singleton
│       └── utils.ts           # Helpers
```

---

## 🧠 Algorithm Explained

### Why K-means + Nearest Neighbor?

For 30–50 passengers across 5–8 cars, this combo gives great results with zero API costs
during the clustering step:

```
STEP 1: K-MEANS CLUSTERING (geographic grouping)
─────────────────────────────────────────────────
Input: All passenger lat/lng coordinates
k = number of available drivers

K-means++ initialization picks spread-out starting centroids.
After convergence, passengers in each cluster live near each other.

Example clusters:
  Cluster 1: Quincy, Dorchester, Roxbury       → "South Car"
  Cluster 2: Malden, Medford, Somerville        → "North Car"  
  Cluster 3: Cambridge, Brookline, Waltham      → "West Car"

STEP 2: CAPACITY BALANCING
───────────────────────────
If a cluster has more passengers than the driver's seat count,
overflow passengers are reassigned to the nearest cluster with space.

STEP 3: NEAREST-NEIGHBOR TSP (route ordering)
──────────────────────────────────────────────
Starting from the temple, greedily visit the nearest unvisited stop.
For 3–8 stops, this is within 10–15% of optimal (undetectable in practice).

Temple → Malden → Medford → Somerville   ✅ (north loop)
vs
Temple → Malden → Somerville → Medford   ✅ (also fine, very similar)

STEP 4: GOOGLE MAPS URL
────────────────────────
Builds a multi-waypoint URL:
https://www.google.com/maps/dir/?api=1
  &origin=Temple+Address
  &destination=Last+Stop
  &waypoints=Stop1|Stop2|Stop3
  &travelmode=driving
```

### Why not OR-Tools or Distance Matrix API?
- OR-Tools: overkill for 3–8 stops. Nearest neighbor is practically optimal.
- Distance Matrix API: $5/1000 elements. Haversine is free and accurate enough for clustering.
  Reserve Distance Matrix for future "estimated arrival time" feature if needed.

---

## 🚀 Setup & Deployment

### Prerequisites
- Node.js 18+
- PostgreSQL database (Supabase free tier works great)
- Google Cloud account (for Maps APIs)

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/temple-transport.git
cd temple-transport
npm install
```

### 2. Set Up Database (Supabase — free)

1. Go to [supabase.com](https://supabase.com) → New Project
2. Copy the **Connection String** from Project Settings → Database
3. Create `.env.local`:

```bash
cp .env.example .env.local
# Edit .env.local and fill in DATABASE_URL
```

### 3. Set Up Google Maps APIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project: "temple-transport"
3. Enable these APIs:
   - **Geocoding API** — converts addresses to lat/lng ($5/1000, free tier covers weeks)
   - **Maps JavaScript API** — optional, for address autocomplete UI
   - **Directions API** — used in Maps URLs (no server calls, just URL format)
4. Create an API key → copy to `.env.local` as `GOOGLE_MAPS_API_KEY`
5. **Restrict the key** to your Vercel domain in production!

### 4. Run Database Migrations

```bash
npm run db:push    # Creates tables in Supabase
npm run db:seed    # Adds test passengers and drivers
```

### 5. Run Locally

```bash
npm run dev
# Open http://localhost:3000
```

### 6. Deploy to Vercel

```bash
npm install -g vercel
vercel

# Add environment variables in Vercel dashboard:
# DATABASE_URL, GOOGLE_MAPS_API_KEY, ADMIN_PASSCODE
```

Or connect your GitHub repo to Vercel for automatic deploys.

---

## 📱 Usage Guide

### Every Saturday Morning (~10 mins total)

**Passengers sign up (done throughout the week):**
1. Share `your-app.vercel.app` in the group chat
2. Everyone taps "I'm Attending" → enters name + this week's address
3. System remembers returning users' info

**Drivers register:**
1. Tap "I'm Driving" → enter seats + car type
2. Done in 30 seconds

**Organizer (5 minutes before departure):**
1. Go to Admin Dashboard (`/admin`)
2. Review passenger/driver counts
3. Tap **"⚡ Generate Car Assignments"** — runs instantly
4. Tap **"📋 View Assignments"** — see all cars with passengers
5. For each driver, tap **"Send via WhatsApp"** — pre-filled message with route link
6. Tap **"🔒 Lock Assignments"**

**Drivers receive:**
A WhatsApp message with a link → opens `/driver/[assignmentId]`:
- Their passenger list with phone numbers
- Optimized stop order
- One-tap Google Maps navigation

---

## 🔧 Configuration

### Changing Admin Passcode
Edit `.env.local`:
```
ADMIN_PASSCODE=your_new_passcode
NEXT_PUBLIC_ADMIN_CODE=your_new_passcode
```

### Changing Temple Address
Edit `src/lib/clustering.ts`:
```typescript
const TEMPLE_LAT = 42.6334;   // Change to actual temple coords
const TEMPLE_LNG = -71.3162;
const TEMPLE_ADDRESS = "BAPS Swaminarayan Mandir, 84 Industrial Ave E, Lowell, MA 01852";
```

And `src/lib/maps.ts`:
```typescript
const TEMPLE = "BAPS+Swaminarayan+Mandir,+...";
```

### Custom Branding
- Edit `src/app/layout.tsx` for title/meta
- Edit `src/app/globals.css` for colors (`--saffron: #f97316`)
- Replace temple emoji/text in `src/app/page.tsx`

---

## 💰 Cost Estimate

| Service | Free Tier | Cost Above Free |
|---------|-----------|-----------------|
| Supabase | 500MB, unlimited rows | $25/month if exceeded |
| Vercel | 100GB bandwidth | $20/month hobby |
| Google Geocoding | $200 credit/month | $5 per 1,000 calls |
| Google Maps URLs | Free (no API call) | $0 |

**For 50 passengers/week:** ~200 geocode calls/month → **$0/month** (within free tier).

**Total annual cost: ~$0** (free tiers cover this scale easily).

---

## 🛣 Roadmap

### MVP (current)
- [x] Passenger signup with phone lookup
- [x] Driver registration
- [x] K-means assignment algorithm
- [x] Google Maps route URLs
- [x] Admin dashboard
- [x] WhatsApp sharing
- [x] Mobile-first UI

### Phase 2 (next)
- [ ] SMS reminders via Twilio ($0.01/SMS) — "Don't forget, temple trip tomorrow!"
- [ ] Google Places Autocomplete for address input
- [ ] Passenger view page (scan QR code to see your car)
- [ ] Admin: manual drag-and-drop reassignment

### Phase 3 (future)
- [ ] Real authentication (NextAuth with Google login)
- [ ] Trip history & analytics
- [ ] Automatic recurring passengers (mark as "regular")
- [ ] Push notifications (PWA)
- [ ] QR code generation for each driver

---

## 🔐 Security Notes

- **Admin passcode** is stored in environment variables, not hardcoded
- **Phone numbers** are the only PII stored; no passwords
- **No payment data** collected
- For production: switch `ADMIN_PASSCODE` to a proper auth system (NextAuth)
- The database is behind Supabase's RLS (Row Level Security) — enable it for production

---

## 🤝 Contributing

This is a community tool. To contribute:
1. Fork the repo
2. Create a feature branch: `git checkout -b feature/sms-reminders`
3. Commit with clear messages
4. Open a PR

---

## 📄 License

MIT — free to use and adapt for any temple/community group.

---

*Jay Swaminarayan 🙏 — Built with love for BAPS Boston Campus Connect*
