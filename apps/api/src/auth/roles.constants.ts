export const ROLE_NAMES = [
  'TRAVELER',
  'BUSINESS_OWNER',
  'BUSINESS_STAFF',
  'ADMIN',
] as const;

export type RoleName = (typeof ROLE_NAMES)[number];
