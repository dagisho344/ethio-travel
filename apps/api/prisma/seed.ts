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

type SeedCity = {
  name: string;
  slug: string;
  latitude: number;
  longitude: number;
};

type SeedRegion = {
  name: string;
  slug: string;
  description: string;
  cities: SeedCity[];
};

const developmentLocations: SeedRegion[] = [
  {
    name: 'Addis Ababa',
    slug: 'addis-ababa',
    description:
      'Development seed city administration for EthioTravel location testing.',
    cities: [
      {
        name: 'Addis Ketema',
        slug: 'addis-ketema',
        latitude: 9.035,
        longitude: 38.735,
      },
      {
        name: 'Akaki Kality',
        slug: 'akaki-kality',
        latitude: 8.88,
        longitude: 38.79,
      },
      { name: 'Arada', slug: 'arada', latitude: 9.035, longitude: 38.761 },
      { name: 'Bole', slug: 'bole', latitude: 8.99, longitude: 38.79 },
      { name: 'Gullele', slug: 'gullele', latitude: 9.071, longitude: 38.728 },
      { name: 'Kirkos', slug: 'kirkos', latitude: 9.01, longitude: 38.761 },
      {
        name: 'Kolfe Keranio',
        slug: 'kolfe-keranio',
        latitude: 9.034,
        longitude: 38.681,
      },
      { name: 'Lideta', slug: 'lideta', latitude: 9.011, longitude: 38.735 },
      {
        name: 'Nifas Silk-Lafto',
        slug: 'nifas-silk-lafto',
        latitude: 8.963,
        longitude: 38.724,
      },
      { name: 'Yeka', slug: 'yeka', latitude: 9.036, longitude: 38.819 },
      {
        name: 'Lemi Kura',
        slug: 'lemi-kura',
        latitude: 9.005,
        longitude: 38.855,
      },
    ],
  },
  {
    name: 'Dire Dawa',
    slug: 'dire-dawa',
    description:
      'Development seed city administration for EthioTravel location testing.',
    cities: [
      { name: 'Dire Dawa', slug: 'dire-dawa', latitude: 9.6, longitude: 41.86 },
      {
        name: 'Melka Jebdu',
        slug: 'melka-jebdu',
        latitude: 9.63,
        longitude: 41.78,
      },
    ],
  },
  {
    name: 'Afar',
    slug: 'afar',
    description: 'Development seed region for EthioTravel location testing.',
    cities: [
      { name: 'Semera', slug: 'semera', latitude: 11.79, longitude: 41.01 },
      { name: 'Asaita', slug: 'asaita', latitude: 11.57, longitude: 41.44 },
      { name: 'Awash', slug: 'awash', latitude: 8.98, longitude: 40.17 },
      { name: 'Logiya', slug: 'logiya', latitude: 11.72, longitude: 41.08 },
    ],
  },
  {
    name: 'Amhara',
    slug: 'amhara',
    description: 'Development seed region for EthioTravel location testing.',
    cities: [
      {
        name: 'Bahir Dar',
        slug: 'bahir-dar',
        latitude: 11.59,
        longitude: 37.39,
      },
      { name: 'Gondar', slug: 'gondar', latitude: 12.6, longitude: 37.47 },
      { name: 'Dessie', slug: 'dessie', latitude: 11.13, longitude: 39.63 },
      {
        name: 'Debre Birhan',
        slug: 'debre-birhan',
        latitude: 9.68,
        longitude: 39.53,
      },
      {
        name: 'Debre Markos',
        slug: 'debre-markos',
        latitude: 10.34,
        longitude: 37.72,
      },
      { name: 'Lalibela', slug: 'lalibela', latitude: 12.03, longitude: 39.05 },
      { name: 'Woldiya', slug: 'woldiya', latitude: 11.83, longitude: 39.6 },
    ],
  },
  {
    name: 'Benishangul-Gumuz',
    slug: 'benishangul-gumuz',
    description: 'Development seed region for EthioTravel location testing.',
    cities: [
      { name: 'Assosa', slug: 'assosa', latitude: 10.07, longitude: 34.53 },
      { name: 'Bambasi', slug: 'bambasi', latitude: 9.75, longitude: 34.73 },
      {
        name: 'Gilgel Beles',
        slug: 'gilgel-beles',
        latitude: 11.2,
        longitude: 36.35,
      },
    ],
  },
  {
    name: 'Central Ethiopia Regional State',
    slug: 'central-ethiopia-regional-state',
    description: 'Development seed region for EthioTravel location testing.',
    cities: [
      { name: 'Hosaena', slug: 'hosaena', latitude: 7.55, longitude: 37.85 },
      { name: 'Butajira', slug: 'butajira', latitude: 8.12, longitude: 38.37 },
      { name: 'Wolkite', slug: 'wolkite', latitude: 8.28, longitude: 37.78 },
      { name: 'Durame', slug: 'durame', latitude: 7.24, longitude: 37.88 },
      {
        name: 'Halaba Kulito',
        slug: 'halaba-kulito',
        latitude: 7.3,
        longitude: 38.09,
      },
    ],
  },
  {
    name: 'Gambella',
    slug: 'gambella',
    description: 'Development seed region for EthioTravel location testing.',
    cities: [
      { name: 'Gambella', slug: 'gambella', latitude: 8.25, longitude: 34.59 },
      { name: 'Itang', slug: 'itang', latitude: 8.2, longitude: 34.27 },
      { name: 'Abobo', slug: 'abobo', latitude: 7.85, longitude: 34.55 },
    ],
  },
  {
    name: 'Harari',
    slug: 'harari',
    description: 'Development seed region for EthioTravel location testing.',
    cities: [
      { name: 'Harar', slug: 'harar', latitude: 9.31, longitude: 42.13 },
      {
        name: 'Dire Teyara',
        slug: 'dire-teyara',
        latitude: 9.36,
        longitude: 42.07,
      },
    ],
  },
  {
    name: 'Oromia',
    slug: 'oromia',
    description: 'Development seed region for EthioTravel location testing.',
    cities: [
      { name: 'Adama', slug: 'adama', latitude: 8.54, longitude: 39.27 },
      { name: 'Bishoftu', slug: 'bishoftu', latitude: 8.75, longitude: 38.98 },
      { name: 'Jimma', slug: 'jimma', latitude: 7.67, longitude: 36.83 },
      {
        name: 'Shashamane',
        slug: 'shashamane',
        latitude: 7.2,
        longitude: 38.59,
      },
      { name: 'Nekemte', slug: 'nekemte', latitude: 9.09, longitude: 36.55 },
      { name: 'Ambo', slug: 'ambo', latitude: 8.98, longitude: 37.86 },
      { name: 'Asella', slug: 'asella', latitude: 7.95, longitude: 39.14 },
      { name: 'Bale Robe', slug: 'bale-robe', latitude: 7.13, longitude: 40.0 },
      { name: 'Mojo', slug: 'mojo', latitude: 8.59, longitude: 39.12 },
      { name: 'Sebeta', slug: 'sebeta', latitude: 8.92, longitude: 38.62 },
    ],
  },
  {
    name: 'Sidama',
    slug: 'sidama',
    description: 'Development seed region for EthioTravel location testing.',
    cities: [
      { name: 'Hawassa', slug: 'hawassa', latitude: 7.05, longitude: 38.48 },
      { name: 'Yirgalem', slug: 'yirgalem', latitude: 6.75, longitude: 38.42 },
      {
        name: 'Aleta Wondo',
        slug: 'aleta-wondo',
        latitude: 6.6,
        longitude: 38.42,
      },
      { name: 'Daye', slug: 'daye', latitude: 6.72, longitude: 38.32 },
    ],
  },
  {
    name: 'Somali',
    slug: 'somali',
    description: 'Development seed region for EthioTravel location testing.',
    cities: [
      { name: 'Jijiga', slug: 'jijiga', latitude: 9.35, longitude: 42.8 },
      { name: 'Gode', slug: 'gode', latitude: 5.95, longitude: 43.45 },
      {
        name: 'Degehabur',
        slug: 'degehabur',
        latitude: 8.22,
        longitude: 43.57,
      },
      {
        name: 'Kebri Dehar',
        slug: 'kebri-dehar',
        latitude: 6.74,
        longitude: 44.28,
      },
      {
        name: 'Tog Wajaale',
        slug: 'tog-wajaale',
        latitude: 9.6,
        longitude: 43.33,
      },
    ],
  },
  {
    name: 'South Ethiopia Regional State',
    slug: 'south-ethiopia-regional-state',
    description: 'Development seed region for EthioTravel location testing.',
    cities: [
      {
        name: 'Wolaita Sodo',
        slug: 'wolaita-sodo',
        latitude: 6.855,
        longitude: 37.761,
      },
      {
        name: 'Arba Minch',
        slug: 'arba-minch',
        latitude: 6.04,
        longitude: 37.55,
      },
      { name: 'Jinka', slug: 'jinka', latitude: 5.79, longitude: 36.57 },
      { name: 'Dilla', slug: 'dilla', latitude: 6.41, longitude: 38.31 },
      { name: 'Sawla', slug: 'sawla', latitude: 6.29, longitude: 36.88 },
    ],
  },
  {
    name: 'South West Ethiopia Peoples Region',
    slug: 'south-west-ethiopia-peoples-region',
    description: 'Development seed region for EthioTravel location testing.',
    cities: [
      { name: 'Bonga', slug: 'bonga', latitude: 7.27, longitude: 36.24 },
      {
        name: 'Mizan Teferi',
        slug: 'mizan-teferi',
        latitude: 6.99,
        longitude: 35.59,
      },
      { name: 'Tepi', slug: 'tepi', latitude: 7.2, longitude: 35.45 },
      { name: 'Tercha', slug: 'tercha', latitude: 7.18, longitude: 37.45 },
    ],
  },
  {
    name: 'Tigray',
    slug: 'tigray',
    description: 'Development seed region for EthioTravel location testing.',
    cities: [
      { name: 'Mekelle', slug: 'mekelle', latitude: 13.5, longitude: 39.47 },
      { name: 'Axum', slug: 'axum', latitude: 14.12, longitude: 38.72 },
      { name: 'Adigrat', slug: 'adigrat', latitude: 14.28, longitude: 39.47 },
      { name: 'Shire', slug: 'shire', latitude: 14.1, longitude: 38.28 },
      { name: 'Adwa', slug: 'adwa', latitude: 14.17, longitude: 38.9 },
    ],
  },
];

async function seedDevelopmentLocations(): Promise<void> {
  for (const seedRegion of developmentLocations) {
    const region = await prisma.region.upsert({
      create: {
        name: seedRegion.name,
        slug: seedRegion.slug,
        description: seedRegion.description,
        status: LocationStatus.ACTIVE,
      },
      update: {
        name: seedRegion.name,
        description: seedRegion.description,
        status: LocationStatus.ACTIVE,
      },
      where: { slug: seedRegion.slug },
    });

    for (const seedCity of seedRegion.cities) {
      await prisma.city.upsert({
        create: {
          name: seedCity.name,
          slug: seedCity.slug,
          description:
            'Development seed city for EthioTravel location testing.',
          latitude: seedCity.latitude,
          longitude: seedCity.longitude,
          status: LocationStatus.ACTIVE,
          regionId: region.id,
        },
        update: {
          name: seedCity.name,
          description:
            'Development seed city for EthioTravel location testing.',
          latitude: seedCity.latitude,
          longitude: seedCity.longitude,
          status: LocationStatus.ACTIVE,
        },
        where: {
          regionId_slug: {
            regionId: region.id,
            slug: seedCity.slug,
          },
        },
      });
    }
  }
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
