// app/api/store-encrypted/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { encryptWithVault } from "../../../lib/vault-client";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const { config, pgCreds, webhookId } = await req.json();

    if (!config || !pgCreds || !webhookId) {
      return NextResponse.json(
        { error: "Missing required fields: config, pgCreds, or webhookId" },
        { status: 400 }
      );
    }

    const encryptedCreds = await encryptWithVault(pgCreds);

    const result = await prisma.userIndexPrefs.upsert({
      where: { webhookId },
      update: {
        config,
        pgCreds: Buffer.from(encryptedCreds),
      },
      create: {
        config,
        pgCreds: Buffer.from(encryptedCreds),
        webhookId,
      },
    });

    return NextResponse.json({ message: "Stored successfully", result });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}