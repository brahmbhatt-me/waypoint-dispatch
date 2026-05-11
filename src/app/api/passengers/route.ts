import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { geocodeAddress } from "@/lib/maps";
import { normalizePhone, getThisSaturday } from "@/lib/utils";

// GET /api/passengers?tripId=...  — list all attending passengers for a trip
// GET /api/passengers?phone=...   — look up a user by phone
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tripId = searchParams.get("tripId");
  const phone = searchParams.get("phone");

  try {
    if (phone) {
      const normalized = normalizePhone(phone);
      const user = await prisma.user.findUnique({
        where: { phone: normalized },
        include: {
          addressHistory: {
            orderBy: { usedAt: "desc" },
            take: 5,
          },
        },
      });
      return NextResponse.json(user ?? null);
    }

    if (tripId) {
      const attendances = await prisma.attendance.findMany({
        where: { tripId, attending: true },
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
        orderBy: { createdAt: "asc" },
      });

      return NextResponse.json(
        attendances.map((a) => ({
          id: a.id,
          userId: a.userId,
          name: a.user.name,
          phone: a.user.phone,
          dropoffAddress: a.dropoffAddress,
          dropoffLat: a.dropoffLat,
          dropoffLng: a.dropoffLng,
          notes: a.notes,
          attending: a.attending,
          assignmentId: a.assignmentId,
          assignedDriver: a.assignment
            ? {
                name: a.assignment.driverSession.user.name,
                phone: a.assignment.driverSession.user.phone,
                carType: a.assignment.driverSession.carType,
                mapsUrl: a.assignment.mapsUrl,
              }
            : null,
        }))
      );
    }

    return NextResponse.json({ error: "Provide tripId or phone" }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
}

// POST /api/passengers — register/update attendance for this week
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      phone,
      dropoffAddress,
      saveAsDefault,
      notes,
      attending = true,
    } = body;

    if (!name || !phone || !dropoffAddress) {
      return NextResponse.json({ error: "Name, phone, and address required" }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(phone);
    const saturday = getThisSaturday();

    // Geocode the address
    const geo = await geocodeAddress(dropoffAddress);
    const finalAddress = geo?.address ?? dropoffAddress;
    const lat = geo?.lat ?? null;
    const lng = geo?.lng ?? null;

    // Upsert user
    const user = await prisma.user.upsert({
      where: { phone: normalizedPhone },
      update: {
        name,
        ...(saveAsDefault && {
          defaultAddress: finalAddress,
          defaultLat: lat,
          defaultLng: lng,
        }),
      },
      create: {
        name,
        phone: normalizedPhone,
        defaultAddress: saveAsDefault ? finalAddress : undefined,
        defaultLat: saveAsDefault ? lat : undefined,
        defaultLng: saveAsDefault ? lng : undefined,
      },
    });

    // Upsert this week's trip
    const trip = await prisma.trip.upsert({
      where: { date: saturday },
      update: {},
      create: { date: saturday, status: "OPEN" },
    });

    if (trip.status === "LOCKED") {
      return NextResponse.json(
        { error: "Assignments are locked. Contact the organizer to make changes." },
        { status: 403 }
      );
    }

    // Upsert attendance
    const attendance = await prisma.attendance.upsert({
      where: { userId_tripId: { userId: user.id, tripId: trip.id } },
      update: {
        dropoffAddress: finalAddress,
        dropoffLat: lat,
        dropoffLng: lng,
        notes,
        attending,
        // Clear prior assignment if address changed
        assignmentId: null,
      },
      create: {
        userId: user.id,
        tripId: trip.id,
        dropoffAddress: finalAddress,
        dropoffLat: lat,
        dropoffLng: lng,
        notes,
        attending,
      },
    });

    // Save to address history (if attending and address is new)
    if (attending && finalAddress) {
      await prisma.addressHistory.create({
        data: {
          userId: user.id,
          address: finalAddress,
          lat,
          lng,
        },
      });
    }

    return NextResponse.json({
      success: true,
      attendanceId: attendance.id,
      userId: user.id,
      tripDate: saturday,
      geocoded: !!geo,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PATCH /api/passengers — update attending status
export async function PATCH(req: NextRequest) {
  try {
    const { attendanceId, attending } = await req.json();

    const updated = await prisma.attendance.update({
      where: { id: attendanceId },
      data: { attending },
    });

    return NextResponse.json({ success: true, attending: updated.attending });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
