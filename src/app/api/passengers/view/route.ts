import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getThisSaturday } from "@/lib/utils";

// GET /api/passengers/view?userId=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  try {
    const saturday = getThisSaturday();
    const trip = await prisma.trip.findUnique({ where: { date: saturday } });

    if (!trip) {
      return NextResponse.json(null);
    }

    const attendance = await prisma.attendance.findUnique({
      where: { userId_tripId: { userId, tripId: trip.id } },
      include: {
        user: { select: { name: true, phone: true } },
        assignment: {
          include: {
            driverSession: {
              include: { user: { select: { name: true, phone: true } } },
            },
          },
        },
      },
    });

    if (!attendance) return NextResponse.json(null);

    return NextResponse.json({
      name: attendance.user.name,
      phone: attendance.user.phone,
      dropoffAddress: attendance.dropoffAddress,
      tripDate: trip.date,
      assignedDriver: attendance.assignment
        ? {
            name: attendance.assignment.driverSession.user.name,
            phone: attendance.assignment.driverSession.user.phone,
            carType: attendance.assignment.driverSession.carType,
            mapsUrl: attendance.assignment.mapsUrl,
          }
        : null,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
