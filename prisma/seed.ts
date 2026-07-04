import { Role, UserStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";

const SUPER_ADMIN_EMAIL = "admin@ipsm.local";
const SUPER_ADMIN_NAME = "System Administrator";
const SUPER_ADMIN_AUTH_ID = process.env.IPSM_SEED_SUPER_ADMIN_AUTH_ID;

async function protectSuperAdminProfile() {
  const existingSuperAdmin = await prisma.userProfile.findUnique({
    where: { email: SUPER_ADMIN_EMAIL },
  });

  if (existingSuperAdmin) {
    await prisma.userProfile.update({
      where: { email: SUPER_ADMIN_EMAIL },
      data: {
        name: existingSuperAdmin.name || SUPER_ADMIN_NAME,
        role: Role.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    console.info(`${SUPER_ADMIN_EMAIL} exists and has been kept as an active SUPER_ADMIN.`);
    return;
  }

  if (!SUPER_ADMIN_AUTH_ID) {
    console.info(
      `No ${SUPER_ADMIN_EMAIL} profile exists. Skipping SUPER_ADMIN creation because ` +
        "IPSM_SEED_SUPER_ADMIN_AUTH_ID is not set.",
    );
    return;
  }

  await prisma.userProfile.create({
    data: {
      authId: SUPER_ADMIN_AUTH_ID,
      name: SUPER_ADMIN_NAME,
      email: SUPER_ADMIN_EMAIL,
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  console.info(`${SUPER_ADMIN_EMAIL} was created as an active SUPER_ADMIN.`);
}

async function main() {
  await protectSuperAdminProfile();

  console.info(
    "Production seed complete. No demo families, students, teachers, seasons, enrollments, " +
      "sessions, payments, receipts, expenses, courses, levels, or pricing were created.",
  );
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
