import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getThisSaturday } from "@/lib/utils";

// GET /api/trips — returns current active trip (creates it if needed)
export async function GET() {
  try {
    const saturday = getThisSaturday();

    // Upsert this week's trip
    const trip = await prisma.trip.upsert({
      where: { date: saturday },
      update: {},
      create: { date: saturday, status: "OPEN" },
      include: {
        _count: {
          select: {
            attendances: { where: { attending: true } },
            driverSessions: { where: { available: true } },
          },
        },
        driverSessions: {
          where: { available: true },
          select: { seats: true },
        },
      },
    });

    const totalSeats = trip.driverSessions.reduce((s, d) => s + d.seats, 0);

    return NextResponse.json({
      ...trip,
      passengerCount: trip._count.attendances,
      driverCount: trip._count.driverSessions,
      totalSeats,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to get trip" }, { status: 500 });
  }
}

// POST /api/trips — admin: update trip status
export async function POST(req: NextRequest) {
  try {
    const { tripId, status, notes } = await req.json();

    const trip = await prisma.trip.update({
      where: { id: tripId },
      data: { status, notes },
    });

    return NextResponse.json(trip);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update trip" }, { status: 500 });
  }
}
