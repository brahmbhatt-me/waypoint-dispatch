import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateAssignments,
  type PassengerPoint,
  type DriverSlot,
} from "@/lib/clustering";
import { getThisSaturday } from "@/lib/utils";

/**
 * POST /api/assignments/generate
 *
 * Main admin action: run the clustering algorithm and persist assignments.
 * Clears any previous assignments for the trip first.
 *
 * Body: { tripId?: string, adminCode: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { tripId: bodyTripId, adminCode } = await req.json();

    // Simple admin auth (replace with proper session in production)
    if (adminCode !== (process.env.ADMIN_PASSCODE || "baps2024")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve trip
    let tripId = bodyTripId;
    if (!tripId) {
      const saturday = getThisSaturday();
      const trip = await prisma.trip.upsert({
        where: { date: saturday },
        update: {},
        create: { date: saturday, status: "OPEN" },
      });
      tripId = trip.id;
    }

    // Mark trip as generating
    await prisma.trip.update({
      where: { id: tripId },
      data: { status: "GENERATING" },
    });

    // Fetch all attending passengers with geocoded coords
    const attendances = await prisma.attendance.findMany({
      where: { tripId, attending: true },
      include: {
        user: { select: { id: true, name: true, phone: true } },
      },
    });

    // Fetch all available drivers
    const driverSessions = await prisma.driverSession.findMany({
      where: { tripId, available: true },
      include: {
        user: { select: { id: true, name: true, phone: true } },
      },
    });

    if (driverSessions.length === 0) {
      await prisma.trip.update({ where: { id: tripId }, data: { status: "OPEN" } });
      return NextResponse.json({ error: "No available drivers" }, { status: 400 });
    }

    if (attendances.length === 0) {
      await prisma.trip.update({ where: { id: tripId }, data: { status: "OPEN" } });
      return NextResponse.json({ error: "No attending passengers" }, { status: 400 });
    }

    // Flag passengers missing geocoords
    const ungeocoded = attendances.filter((a) => !a.dropoffLat || !a.dropoffLng);
    if (ungeocoded.length > 0) {
      console.warn(
        `${ungeocoded.length} passengers missing geocoords:`,
        ungeocoded.map((a) => a.user.name)
      );
    }

    // Build typed passenger points (skip those without coords)
    const passengers: PassengerPoint[] = attendances
      .filter((a) => a.dropoffLat && a.dropoffLng)
      .map((a) => ({
        attendanceId: a.id,
        userId: a.userId,
        name: a.user.name,
        phone: a.user.phone,
        address: a.dropoffAddress,
        lat: a.dropoffLat!,
        lng: a.dropoffLng!,
        notes: a.notes,
      }));

    const drivers: DriverSlot[] = driverSessions.map((d) => ({
      driverSessionId: d.id,
      driverId: d.userId,
      driverName: d.user.name,
      driverPhone: d.user.phone,
      carType: d.carType,
      seats: d.seats,
    }));

    // ─── RUN THE ALGORITHM ───────────────────────────────────────────────────
    const clusterResults = generateAssignments(passengers, drivers);

    // ─── PERSIST TO DATABASE ─────────────────────────────────────────────────
    // Clear old assignments for this trip
    await prisma.attendance.updateMany({
      where: { tripId },
      data: { assignmentId: null },
    });
    await prisma.assignment.deleteMany({ where: { tripId } });

    // Create new assignments
    const created = await Promise.all(
      clusterResults
        .filter((r) => r.passengers.length > 0)
        .map(async (result) => {
          const assignment = await prisma.assignment.create({
            data: {
              tripId,
              driverSessionId: result.driverSessionId,
              stopOrder: result.stopOrder,
              mapsUrl: result.mapsUrl,
            },
          });

          // Link each passenger's attendance to this assignment
          await prisma.attendance.updateMany({
            where: {
              id: { in: result.passengers.map((p) => p.attendanceId) },
            },
            data: { assignmentId: assignment.id },
          });

          return assignment;
        })
    );

    // Handle passengers who couldn't be geocoded — assign to car with most space
    if (ungeocoded.length > 0) {
      const assignmentCounts = await prisma.assignment.findMany({
        where: { tripId },
        include: { _count: { select: { passengers: true } }, driverSession: true },
      });
      const bestCar = assignmentCounts.sort(
        (a, b) => a.driverSession.seats - a._count.passengers - (b.driverSession.seats - b._count.passengers)
      )[0];

      if (bestCar) {
        await prisma.attendance.updateMany({
          where: { id: { in: ungeocoded.map((a) => a.id) } },
          data: { assignmentId: bestCar.id },
        });
      }
    }

    // Update trip status back to OPEN (admin can review before locking)
    await prisma.trip.update({
      where: { id: tripId },
      data: { status: "OPEN" },
    });

    // Return summary
    const summary = clusterResults.map((r) => ({
      driverName: r.driverName,
      carType: r.carType,
      seats: r.seats,
      passengerCount: r.passengers.length,
      passengers: r.passengers.map((p) => ({ name: p.name, address: p.address })),
      mapsUrl: r.mapsUrl,
    }));

    return NextResponse.json({
      success: true,
      assignmentsCreated: created.length,
      totalPassengersAssigned: passengers.length,
      ungeocodedCount: ungeocoded.length,
      summary,
    });
  } catch (err) {
    console.error("Assignment generation error:", err);
    // Reset trip status on error
    return NextResponse.json(
      { error: "Assignment generation failed", detail: String(err) },
      { status: 500 }
    );
  }
}
