import { LocationStatus, PrismaClient } from '@prisma/client';

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

async function seedRoles(): Promise<void> {
  for (const role of roles) {
    await prisma.role.upsert({
      create: role,
      update: { description: role.description },
      where: { name: role.name },
    });
  }
}

async function seedDevelopmentLocations(): Promise<void> {
  const southEthiopia = await prisma.region.upsert({
    create: {
      name: 'South Ethiopia Regional State',
      slug: 'south-ethiopia-regional-state',
      description: 'Development seed region for EthioTravel location testing.',
      status: LocationStatus.ACTIVE,
    },
    update: {
      description: 'Development seed region for EthioTravel location testing.',
      status: LocationStatus.ACTIVE,
    },
    where: { slug: 'south-ethiopia-regional-state' },
  });

  await prisma.city.upsert({
    create: {
      name: 'Wolaita Sodo',
      slug: 'wolaita-sodo',
      description: 'Development seed city for EthioTravel location testing.',
      latitude: 6.855,
      longitude: 37.761,
      status: LocationStatus.ACTIVE,
      regionId: southEthiopia.id,
    },
    update: {
      description: 'Development seed city for EthioTravel location testing.',
      latitude: 6.855,
      longitude: 37.761,
      status: LocationStatus.ACTIVE,
    },
    where: {
      regionId_slug: {
        regionId: southEthiopia.id,
        slug: 'wolaita-sodo',
      },
    },
  });

  const addisAbaba = await prisma.region.upsert({
    create: {
      name: 'Addis Ababa',
      slug: 'addis-ababa',
      description:
        'Development seed city-region for EthioTravel location testing.',
      status: LocationStatus.ACTIVE,
    },
    update: {
      description:
        'Development seed city-region for EthioTravel location testing.',
      status: LocationStatus.ACTIVE,
    },
    where: { slug: 'addis-ababa' },
  });

  await prisma.city.upsert({
    create: {
      name: 'Addis Ababa',
      slug: 'addis-ababa',
      description: 'Development seed city for EthioTravel location testing.',
      latitude: 9.03,
      longitude: 38.74,
      status: LocationStatus.ACTIVE,
      regionId: addisAbaba.id,
    },
    update: {
      description: 'Development seed city for EthioTravel location testing.',
      latitude: 9.03,
      longitude: 38.74,
      status: LocationStatus.ACTIVE,
    },
    where: {
      regionId_slug: {
        regionId: addisAbaba.id,
        slug: 'addis-ababa',
      },
    },
  });
}

async function main(): Promise<void> {
  await seedRoles();
  await seedDevelopmentLocations();
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
