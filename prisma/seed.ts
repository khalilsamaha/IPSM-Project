import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.userProfile.upsert({
    where: { email: "admin@ipsm.local" },
    update: { role: Role.ADMIN, status: "ACTIVE" },
    create: {
      authId: "00000000-0000-0000-0000-000000000001",
      name: "System Administrator",
      email: "admin@ipsm.local",
      role: Role.ADMIN,
    },
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
