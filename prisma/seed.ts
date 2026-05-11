import { PrismaClient, Role } from "@prisma/client";
import { addDays, nextSaturday, startOfDay } from "date-fns";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { phone: "6175550000" },
    update: {},
    create: {
      name: "Admin",
      phone: "6175550000",
      role: Role.ADMIN,
    },
  });

  // Create some test drivers
  const drivers = await Promise.all([
    prisma.user.upsert({
      where: { phone: "6175551001" },
      update: {},
      create: {
        name: "Raj Patel",
        phone: "6175551001",
        role: Role.DRIVER,
        defaultAddress: "150 Tremont St, Boston, MA 02111",
        defaultLat: 42.3519,
        defaultLng: -71.0638,
      },
    }),
    prisma.user.upsert({
      where: { phone: "6175551002" },
      update: {},
      create: {
        name: "Neel Shah",
        phone: "6175551002",
        role: Role.DRIVER,
        defaultAddress: "750 Morrissey Blvd, Boston, MA 02122",
        defaultLat: 42.3089,
        defaultLng: -71.0535,
      },
    }),
    prisma.user.upsert({
      where: { phone: "6175551003" },
      update: {},
      create: {
        name: "Amit Desai",
        phone: "6175551003",
        role: Role.DRIVER,
        defaultAddress: "100 Cabot St, Medford, MA 02155",
        defaultLat: 42.4161,
        defaultLng: -71.1016,
      },
    }),
  ]);

  // Create test passengers
  const passengers = await Promise.all([
    prisma.user.upsert({
      where: { phone: "6175552001" },
      update: {},
      create: {
        name: "Priya Mehta",
        phone: "6175552001",
        defaultAddress: "45 Winthrop Ave, Quincy, MA 02170",
        defaultLat: 42.2529,
        defaultLng: -71.0023,
      },
    }),
    prisma.user.upsert({
      where: { phone: "6175552002" },
      update: {},
      create: {
        name: "Vivek Sharma",
        phone: "6175552002",
        defaultAddress: "220 Hancock St, Dorchester, MA 02125",
        defaultLat: 42.3208,
        defaultLng: -71.0653,
      },
    }),
    prisma.user.upsert({
      where: { phone: "6175552003" },
      update: {},
      create: {
        name: "Hetal Joshi",
        phone: "6175552003",
        defaultAddress: "89 Broadway, Malden, MA 02148",
        defaultLat: 42.4293,
        defaultLng: -71.0662,
      },
    }),
    prisma.user.upsert({
      where: { phone: "6175552004" },
      update: {},
      create: {
        name: "Karan Thakkar",
        phone: "6175552004",
        defaultAddress: "5 Summer St, Everett, MA 02149",
        defaultLat: 42.4084,
        defaultLng: -71.0537,
      },
    }),
    prisma.user.upsert({
      where: { phone: "6175552005" },
      update: {},
      create: {
        name: "Neha Trivedi",
        phone: "6175552005",
        defaultAddress: "303 Cambridge St, Cambridge, MA 02141",
        defaultLat: 42.3735,
        defaultLng: -71.0944,
      },
    }),
    prisma.user.upsert({
      where: { phone: "6175552006" },
      update: {},
      create: {
        name: "Sanjay Kapoor",
        phone: "6175552006",
        defaultAddress: "100 Highland Ave, Somerville, MA 02143",
        defaultLat: 42.3876,
        defaultLng: -71.0995,
      },
    }),
    prisma.user.upsert({
      where: { phone: "6175552007" },
      update: {},
      create: {
        name: "Anjali Gupta",
        phone: "6175552007",
        defaultAddress: "47 Central Ave, Medford, MA 02155",
        defaultLat: 42.4209,
        defaultLng: -71.0965,
      },
    }),
    prisma.user.upsert({
      where: { phone: "6175552008" },
      update: {},
      create: {
        name: "Dhruv Patel",
        phone: "6175552008",
        defaultAddress: "12 Oak St, Brookline, MA 02445",
        defaultLat: 42.3318,
        defaultLng: -71.1212,
      },
    }),
    prisma.user.upsert({
      where: { phone: "6175552009" },
      update: {},
      create: {
        name: "Riya Bhatt",
        phone: "6175552009",
        defaultAddress: "500 Harvard St, Mattapan, MA 02126",
        defaultLat: 42.2745,
        defaultLng: -71.0915,
      },
    }),
    prisma.user.upsert({
      where: { phone: "6175552010" },
      update: {},
      create: {
        name: "Mihir Dave",
        phone: "6175552010",
        defaultAddress: "99 Elm St, Waltham, MA 02453",
        defaultLat: 42.3765,
        defaultLng: -71.2356,
      },
    }),
  ]);

  // Create the upcoming Saturday trip
  const upcomingSaturday = nextSaturday(startOfDay(new Date()));
  const trip = await prisma.trip.upsert({
    where: { date: upcomingSaturday },
    update: {},
    create: {
      date: upcomingSaturday,
      status: "OPEN",
    },
  });

  // Register drivers for this trip
  await Promise.all([
    prisma.driverSession.upsert({
      where: { userId_tripId: { userId: drivers[0].id, tripId: trip.id } },
      update: {},
      create: {
        userId: drivers[0].id,
        tripId: trip.id,
        seats: 4,
        carType: "Honda Odyssey (White)",
        available: true,
      },
    }),
    prisma.driverSession.upsert({
      where: { userId_tripId: { userId: drivers[1].id, tripId: trip.id } },
      update: {},
      create: {
        userId: drivers[1].id,
        tripId: trip.id,
        seats: 3,
        carType: "Toyota Camry (Silver)",
        available: true,
      },
    }),
    prisma.driverSession.upsert({
      where: { userId_tripId: { userId: drivers[2].id, tripId: trip.id } },
      update: {},
      create: {
        userId: drivers[2].id,
        tripId: trip.id,
        seats: 3,
        carType: "Subaru Outback (Blue)",
        available: true,
      },
    }),
  ]);

  // Register passengers for this trip
  await Promise.all(
    passengers.map((p) =>
      prisma.attendance.upsert({
        where: { userId_tripId: { userId: p.id, tripId: trip.id } },
        update: {},
        create: {
          userId: p.id,
          tripId: trip.id,
          dropoffAddress: p.defaultAddress!,
          dropoffLat: p.defaultLat,
          dropoffLng: p.defaultLng,
          attending: true,
        },
      })
    )
  );

  console.log(`✅ Seeded: ${passengers.length} passengers, ${drivers.length} drivers, 1 trip`);
  console.log(`📅 Trip date: ${upcomingSaturday.toDateString()}`);
  console.log(`🔑 Admin phone: 6175550000 (use as login)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
