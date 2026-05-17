import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

function getNextSaturdayUTC() {
  const now = new Date();
  const day = now.getUTCDay();
  const daysUntilSat = day === 6 ? 7 : 6 - day;
  const sat = new Date(now);
  sat.setUTCDate(now.getUTCDate() + daysUntilSat);
  sat.setUTCHours(0, 0, 0, 0);
  return sat;
}

async function main() {
  console.log('Seeding...');
  await prisma.assignment.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.driverSession.deleteMany();
  await prisma.addressHistory.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.user.deleteMany();

  const d1 = await prisma.user.create({ data: { name: 'Raj Patel', phone: '6175551001', role: Role.DRIVER, defaultAddress: '150 Tremont St, Boston, MA 02111', defaultLat: 42.3519, defaultLng: -71.0638 } });
  const d2 = await prisma.user.create({ data: { name: 'Neel Shah', phone: '6175551002', role: Role.DRIVER, defaultAddress: '750 Morrissey Blvd, Boston, MA 02122', defaultLat: 42.3089, defaultLng: -71.0535 } });
  const d3 = await prisma.user.create({ data: { name: 'Amit Desai', phone: '6175551003', role: Role.DRIVER, defaultAddress: '100 Cabot St, Medford, MA 02155', defaultLat: 42.4161, defaultLng: -71.1016 } });
  const p1 = await prisma.user.create({ data: { name: 'Priya Mehta', phone: '6175552001', defaultAddress: '45 Winthrop Ave, Quincy, MA 02170', defaultLat: 42.2529, defaultLng: -71.0023 } });
  const p2 = await prisma.user.create({ data: { name: 'Vivek Sharma', phone: '6175552002', defaultAddress: '220 Hancock St, Dorchester, MA 02125', defaultLat: 42.3208, defaultLng: -71.0653 } });
  const p3 = await prisma.user.create({ data: { name: 'Hetal Joshi', phone: '6175552003', defaultAddress: '89 Broadway, Malden, MA 02148', defaultLat: 42.4293, defaultLng: -71.0662 } });
  const p4 = await prisma.user.create({ data: { name: 'Karan Thakkar', phone: '6175552004', defaultAddress: '5 Summer St, Everett, MA 02149', defaultLat: 42.4084, defaultLng: -71.0537 } });
  const p5 = await prisma.user.create({ data: { name: 'Neha Trivedi', phone: '6175552005', defaultAddress: '303 Cambridge St, Cambridge, MA 02141', defaultLat: 42.3735, defaultLng: -71.0944 } });
  const p6 = await prisma.user.create({ data: { name: 'Sanjay Kapoor', phone: '6175552006', defaultAddress: '100 Highland Ave, Somerville, MA 02143', defaultLat: 42.3876, defaultLng: -71.0995 } });
  const p7 = await prisma.user.create({ data: { name: 'Anjali Gupta', phone: '6175552007', defaultAddress: '47 Central Ave, Medford, MA 02155', defaultLat: 42.4209, defaultLng: -71.0965 } });
  const p8 = await prisma.user.create({ data: { name: 'Dhruv Patel', phone: '6175552008', defaultAddress: '12 Oak St, Brookline, MA 02445', defaultLat: 42.3318, defaultLng: -71.1212 } });
  const p9 = await prisma.user.create({ data: { name: 'Riya Bhatt', phone: '6175552009', defaultAddress: '500 Harvard St, Mattapan, MA 02126', defaultLat: 42.2745, defaultLng: -71.0915 } });
  const p10 = await prisma.user.create({ data: { name: 'Mihir Dave', phone: '6175552010', defaultAddress: '99 Elm St, Waltham, MA 02453', defaultLat: 42.3765, defaultLng: -71.2356 } });

  const saturday = getNextSaturdayUTC();
  const trip = await prisma.trip.create({ data: { date: saturday, status: 'OPEN' } });

  for (const d of [d1, d2, d3]) {
    await prisma.driverSession.create({ data: { userId: d.id, tripId: trip.id, seats: 3, carType: 'Toyota Camry', available: true } });
  }
  for (const p of [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10]) {
    await prisma.attendance.create({ data: { userId: p.id, tripId: trip.id, dropoffAddress: p.defaultAddress as string, dropoffLat: p.defaultLat, dropoffLng: p.defaultLng, attending: true } });
  }

  console.log('Done: 10 passengers, 3 drivers, trip: ' + saturday.toISOString());
}

main().catch(console.error).finally(() => prisma.$disconnect());
