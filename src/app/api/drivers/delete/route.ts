import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { sessionId, adminCode } = await req.json();
    if (adminCode !== (process.env.ADMIN_PASSCODE || "baps2024")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await prisma.driverSession.update({
      where: { id: sessionId },
      data: { available: false },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
