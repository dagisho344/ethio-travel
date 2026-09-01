import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const roles = [
  { name: 'TRAVELER', description: 'Default traveler account role.' },
  { name: 'BUSINESS_OWNER', description: 'Can own and manage businesses.' },
  {
    name: 'BUSINESS_STAFF',
    description: 'Can help manage assigned businesses.',
  },
  { name: 'ADMIN', description: 'Platform administrator.' },
];

async function main(): Promise<void> {
  for (const role of roles) {
    await prisma.role.upsert({
      create: role,
      update: { description: role.description },
      where: { name: role.name },
    });
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
