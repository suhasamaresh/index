import { PrismaClient } from '@prisma/client';
import { encryptCredentials } from "../lib/encrypt";

console.log(encryptCredentials);
const prisma = new PrismaClient();

async function main() {
  await prisma.userIndexPrefs.deleteMany();
  console.log("Cleared existing data");

  const encryptedCreds = await encryptCredentials("suhas9481", "vault-secret");

  await prisma.userIndexPrefs.create({
    data: {
      config: { events: [{ type: "NFT_BID" }] },
      pgCreds: encryptedCreds,
      webhookId: "webhook",
    },
  });
  console.log("Inserted row with encrypted creds!");
}

main().catch(console.error).finally(() => prisma.$disconnect());