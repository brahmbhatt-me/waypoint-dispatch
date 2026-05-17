import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone, getThisSaturday } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone");
  if (!phone) return NextResponse.json(null);

  try {
    const normalized = normalizePhone(phone);
    const user = await prisma.user.findUnique({ where: { phone: normalized } });
    if (!user) return NextResponse.json(null);

    const saturday = getThisSaturday();
    const trip = await prisma.trip.findUnique({ where: { date: saturday } });
    if (!trip) return NextResponse.json(null);

    const attendance = await prisma.attendance.findUnique({
      where: { userId_tripId: { userId: user.id, tripId: trip.id } },
      include: {
        assignment: {
          include: {
            driverSession: {
              include: { user: { select: { name: true, phone: true } } },
            },
            passengers: true,
          },
        },
      },
    });

    if (!attendance) return NextResponse.json(null);

    // Find stop number
    let stopNumber: number | undefined;
    let totalStops: number | undefined;
    if (attendance.assignment) {
      const stopOrder = (attendance.assignment.stopOrder as string[]) ?? [];
      const idx = stopOrder.indexOf(attendance.id);
      if (idx >= 0) {
        stopNumber = idx + 1;
        totalStops = stopOrder.length;
      }
      totalStops = totalStops ?? attendance.assignment.passengers.length;
    }

    return NextResponse.json({
      name: user.name,
      attending: attendance.attending,
      dropoffAddress: attendance.dropoffAddress,
      pickupPreference: attendance.pickupPreference,
      pickupAddress: attendance.pickupAddress,
      tripDate: trip.date,
      stopNumber,
      totalStops,
      assignedDriver: attendance.assignment
        ? {
            name: attendance.assignment.driverSession.user.name,
            phone: attendance.assignment.driverSession.user.phone,
            carType: attendance.assignment.driverSession.carType,
            mapsUrl: attendance.assignment.mapsUrl,
            seats: attendance.assignment.driverSession.seats,
          }
        : null,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(null);
  }
}
