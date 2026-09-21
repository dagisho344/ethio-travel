export const serviceCategoryFamilies = [
  'ACCOMMODATION',
  'RESTAURANT',
  'TOUR',
  'TRANSPORT',
  'OTHER',
] as const;

export type ServiceCategoryFamily = (typeof serviceCategoryFamilies)[number];
type SupportedServiceCategoryFamily = Exclude<ServiceCategoryFamily, 'OTHER'>;

export type ServiceCategoryEditorConfig = {
  family: SupportedServiceCategoryFamily;
  label: string;
  description: string;
  routeSegment: 'accommodation' | 'restaurant' | 'tour' | 'transport';
};

const categoryEditors: Record<
  SupportedServiceCategoryFamily,
  ServiceCategoryEditorConfig
> = {
  ACCOMMODATION: {
    family: 'ACCOMMODATION',
    label: 'Accommodation Details',
    description: 'Property details and room types',
    routeSegment: 'accommodation',
  },
  RESTAURANT: {
    family: 'RESTAURANT',
    label: 'Restaurant Details',
    description: 'Cuisine, menus, and menu items',
    routeSegment: 'restaurant',
  },
  TOUR: {
    family: 'TOUR',
    label: 'Tour Details',
    description: 'Tour information and itinerary',
    routeSegment: 'tour',
  },
  TRANSPORT: {
    family: 'TRANSPORT',
    label: 'Transport Details',
    description: 'Routes and dated schedules',
    routeSegment: 'transport',
  },
};

export function getServiceCategoryEditor(
  family: string | null | undefined,
): ServiceCategoryEditorConfig | null {
  switch (family) {
    case 'ACCOMMODATION':
      return categoryEditors.ACCOMMODATION;
    case 'RESTAURANT':
      return categoryEditors.RESTAURANT;
    case 'TOUR':
      return categoryEditors.TOUR;
    case 'TRANSPORT':
      return categoryEditors.TRANSPORT;
    default:
      return null;
  }
}

export function serviceCategoryEditorPath(
  businessId: string,
  serviceId: string,
  family: string | null | undefined,
): string | null {
  const editor = getServiceCategoryEditor(family);
  return editor
    ? `/businesses/manage/${businessId}/services/${serviceId}/${editor.routeSegment}`
    : null;
}
