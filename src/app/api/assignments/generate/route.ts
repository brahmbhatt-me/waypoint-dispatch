import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateAssignments, type PassengerPoint, type DriverSlot } from "@/lib/clustering";
import { getOptimizedRoute, buildGoogleMapsUrl, TEMPLE, RUGGLES } from "@/lib/maps";
import { getThisSaturday } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const { tripId: bodyTripId, adminCode } = await req.json();

    if (adminCode !== (process.env.ADMIN_PASSCODE || "baps2024")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    await prisma.trip.update({ where: { id: tripId }, data: { status: "GENERATING" } });

    // Fetch attending passengers (not marked absent)
    const attendances = await prisma.attendance.findMany({
      where: { tripId, attending: true, markedAbsent: false },
      include: { user: { select: { id: true, name: true, phone: true } } },
    });

    const driverSessions = await prisma.driverSession.findMany({
      where: { tripId, available: true },
      include: { user: { select: { id: true, name: true, phone: true } } },
    });

    if (driverSessions.length === 0) {
      await prisma.trip.update({ where: { id: tripId }, data: { status: "OPEN" } });
      return NextResponse.json({ error: "No available drivers" }, { status: 400 });
    }

    if (attendances.length === 0) {
      await prisma.trip.update({ where: { id: tripId }, data: { status: "OPEN" } });
      return NextResponse.json({ error: "No attending passengers" }, { status: 400 });
    }

    const ungeocoded = attendances.filter((a) => !a.dropoffLat || !a.dropoffLng);

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

    // Run clustering algorithm
    const clusterResults = generateAssignments(passengers, drivers);

    // Clear old assignments
    await prisma.attendance.updateMany({ where: { tripId }, data: { assignmentId: null } });
    await prisma.assignment.deleteMany({ where: { tripId } });

    // Create new assignments with Google Directions routes
    const created = await Promise.all(
      clusterResults
        .filter((r) => r.passengers.length > 0)
        .map(async (result) => {
          const driver = driverSessions.find((d) => d.id === result.driverSessionId);

          // Return trip: Temple → optimized stops (no tolls, with traffic)
          const returnStops = result.stopOrder
            .map((id) => result.passengers.find((p) => p.attendanceId === id))
            .filter(Boolean)
            .map((p) => ({ attendanceId: p!.attendanceId, address: p!.address, lat: p!.lat, lng: p!.lng }));

          const returnRoute = await getOptimizedRoute(TEMPLE.address, returnStops);

          // Going trip: Driver start → pickup passengers needing ride → Ruggles
          let goingMapsUrl: string | undefined;
          if (driver?.startAddress && driver?.startLat && driver?.startLng) {
            const pickupPassengers = attendances
              .filter((a) => {
                const isInThisCar = result.passengers.some((p) => p.attendanceId === a.id);
                return isInThisCar && a.pickupPreference === "DRIVER" && a.pickupAddress && a.pickupLat && a.pickupLng;
              })
              .map((a) => a.pickupAddress!);

            const goingStops = [...pickupPassengers, RUGGLES.address];
            goingMapsUrl = buildGoogleMapsUrl(driver.startAddress, goingStops);
          }

          const finalStopOrder = returnRoute.optimizedStopOrder ?? result.stopOrder;

          const assignment = await prisma.assignment.create({
            data: {
              tripId,
              driverSessionId: result.driverSessionId,
              stopOrder: finalStopOrder,
              mapsUrl: returnRoute.mapsUrl,
              goingMapsUrl: goingMapsUrl ?? null,
              estimatedMinutes: returnRoute.estimatedMinutes,
            },
          });

          // Link passengers
          await prisma.attendance.updateMany({
            where: { id: { in: result.passengers.map((p) => p.attendanceId) } },
            data: { assignmentId: assignment.id },
          });

          return assignment;
        })
    );

    // Handle ungeocoded passengers
    if (ungeocoded.length > 0) {
      const assignmentCounts = await prisma.assignment.findMany({
        where: { tripId },
        include: { _count: { select: { passengers: true } }, driverSession: true },
      });
      const bestCar = assignmentCounts.sort(
        (a, b) => (a.driverSession.seats - a._count.passengers) - (b.driverSession.seats - b._count.passengers)
      )[0];
      if (bestCar) {
        await prisma.attendance.updateMany({
          where: { id: { in: ungeocoded.map((a) => a.id) } },
          data: { assignmentId: bestCar.id },
        });
      }
    }

    await prisma.trip.update({ where: { id: tripId }, data: { status: "OPEN" } });

    return NextResponse.json({
      success: true,
      assignmentsCreated: created.length,
      totalPassengersAssigned: passengers.length,
      ungeocodedCount: ungeocoded.length,
      summary: clusterResults.map((r) => ({
        driverName: r.driverName,
        carType: r.carType,
        passengerCount: r.passengers.length,
        mapsUrl: r.mapsUrl,
      })),
    });
  } catch (err) {
    console.error("Assignment generation error:", err);
    return NextResponse.json({ error: "Assignment generation failed", detail: String(err) }, { status: 500 });
  }
}
