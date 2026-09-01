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

const businessCategories = [
  { code: 'HOTEL', name: 'Hotel', sortOrder: 10 },
  { code: 'RESTAURANT', name: 'Restaurant', sortOrder: 20 },
  { code: 'TOUR_OPERATOR', name: 'Tour Operator', sortOrder: 30 },
  { code: 'TRANSPORT', name: 'Transport', sortOrder: 40 },
  { code: 'CAFE', name: 'Cafe', sortOrder: 50 },
  { code: 'SHOPPING', name: 'Shopping', sortOrder: 60 },
  { code: 'ENTERTAINMENT', name: 'Entertainment', sortOrder: 70 },
  { code: 'HEALTH', name: 'Health', sortOrder: 80 },
  { code: 'FINANCIAL_SERVICE', name: 'Financial Service', sortOrder: 90 },
  { code: 'OTHER', name: 'Other', sortOrder: 100 },
];
const serviceCategories = [
  { code: 'ROOM', name: 'Room', sortOrder: 10 },
  { code: 'MEAL', name: 'Meal', sortOrder: 20 },
  { code: 'TOUR', name: 'Tour', sortOrder: 30 },
  { code: 'TRANSFER', name: 'Transfer', sortOrder: 40 },
  { code: 'RENTAL', name: 'Rental', sortOrder: 50 },
  { code: 'EVENT_PACKAGE', name: 'Event Package', sortOrder: 60 },
  { code: 'ACTIVITY', name: 'Activity', sortOrder: 70 },
  { code: 'WELLNESS', name: 'Wellness', sortOrder: 80 },
  { code: 'TICKET', name: 'Ticket', sortOrder: 90 },
  { code: 'GENERAL', name: 'General', sortOrder: 100 },
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

async function seedBusinessCategories(): Promise<void> {
  for (const category of businessCategories) {
    await prisma.businessCategory.upsert({
      create: {
        ...category,
        isActive: true,
      },
      update: {
        isActive: true,
        name: category.name,
        sortOrder: category.sortOrder,
      },
      where: { code: category.code },
    });
  }
}
async function seedServiceCategories(): Promise<void> {
  for (const category of serviceCategories) {
    await prisma.serviceCategory.upsert({
      create: {
        ...category,
        isActive: true,
      },
      update: {
        isActive: true,
        name: category.name,
        sortOrder: category.sortOrder,
      },
      where: { code: category.code },
    });
  }
}
async function main(): Promise<void> {
  await seedRoles();
  await seedBusinessCategories();
  await seedServiceCategories();
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
