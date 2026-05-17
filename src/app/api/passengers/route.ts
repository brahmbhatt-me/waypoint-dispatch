import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { geocodeAddress } from "@/lib/maps";
import { normalizePhone, getThisSaturday } from "@/lib/utils";

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
          addressHistory: { orderBy: { usedAt: "desc" }, take: 5 },
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
          pickupPreference: a.pickupPreference,
          pickupAddress: a.pickupAddress,
          notes: a.notes,
          attending: a.attending,
          markedAbsent: a.markedAbsent,
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name, phone,
      dropoffAddress, dropoffLat, dropoffLng,
      pickupPreference = "RUGGLES",
      pickupAddress, pickupLat, pickupLng,
      saveAsDefault, notes, attending = true,
    } = body;

    if (!name || !phone || !dropoffAddress) {
      return NextResponse.json({ error: "Name, phone, and address required" }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(phone);
    const saturday = getThisSaturday();

    // Geocode if lat/lng not provided by autocomplete
    let finalLat = dropoffLat ?? null;
    let finalLng = dropoffLng ?? null;
    let finalAddress = dropoffAddress;

    if (!finalLat || !finalLng) {
      const geo = await geocodeAddress(dropoffAddress);
      if (geo) { finalAddress = geo.address; finalLat = geo.lat; finalLng = geo.lng; }
    }

    // Geocode pickup address if needed
    let finalPickupLat = pickupLat ?? null;
    let finalPickupLng = pickupLng ?? null;
    let finalPickupAddress = pickupAddress;
    if (pickupPreference === "DRIVER" && pickupAddress && !finalPickupLat) {
      const geo = await geocodeAddress(pickupAddress);
      if (geo) { finalPickupAddress = geo.address; finalPickupLat = geo.lat; finalPickupLng = geo.lng; }
    }

    const user = await prisma.user.upsert({
      where: { phone: normalizedPhone },
      update: {
        name,
        ...(saveAsDefault && { defaultAddress: finalAddress, defaultLat: finalLat, defaultLng: finalLng }),
      },
      create: {
        name, phone: normalizedPhone,
        defaultAddress: saveAsDefault ? finalAddress : undefined,
        defaultLat: saveAsDefault ? finalLat : undefined,
        defaultLng: saveAsDefault ? finalLng : undefined,
      },
    });

    const trip = await prisma.trip.upsert({
      where: { date: saturday },
      update: {},
      create: { date: saturday, status: "OPEN" },
    });

    if (trip.status === "LOCKED") {
      return NextResponse.json({ error: "Assignments are locked. Contact the organizer." }, { status: 403 });
    }

    const attendance = await prisma.attendance.upsert({
      where: { userId_tripId: { userId: user.id, tripId: trip.id } },
      update: {
        dropoffAddress: finalAddress,
        dropoffLat: finalLat,
        dropoffLng: finalLng,
        pickupPreference,
        pickupAddress: pickupPreference === "DRIVER" ? finalPickupAddress : null,
        pickupLat: pickupPreference === "DRIVER" ? finalPickupLat : null,
        pickupLng: pickupPreference === "DRIVER" ? finalPickupLng : null,
        notes, attending,
        assignmentId: null,
        confirmedAddress: true,
      },
      create: {
        userId: user.id, tripId: trip.id,
        dropoffAddress: finalAddress,
        dropoffLat: finalLat, dropoffLng: finalLng,
        pickupPreference,
        pickupAddress: pickupPreference === "DRIVER" ? finalPickupAddress : null,
        pickupLat: pickupPreference === "DRIVER" ? finalPickupLat : null,
        pickupLng: pickupPreference === "DRIVER" ? finalPickupLng : null,
        notes, attending,
      },
    });

    if (attending && finalAddress) {
      await prisma.addressHistory.create({
        data: { userId: user.id, address: finalAddress, lat: finalLat, lng: finalLng },
      });
    }

    return NextResponse.json({ success: true, attendanceId: attendance.id, userId: user.id, tripDate: saturday });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { attendanceId, attending } = await req.json();
    const updated = await prisma.attendance.update({ where: { id: attendanceId }, data: { attending } });
    return NextResponse.json({ success: true, attending: updated.attending });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
