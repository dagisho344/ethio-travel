import { PartialType, PickType } from '@nestjs/swagger';
import { CreateBusinessDto } from './create-business.dto';

export class UpdateBusinessDto extends PartialType(CreateBusinessDto) {}
export class OwnerUpdateBusinessDto extends PartialType(
  PickType(CreateBusinessDto, [
    'cityId',
    'destinationId',
    'categoryId',
    'name',
    'slug',
    'description',
    'phone',
    'email',
    'website',
    'addressLine1',
    'addressLine2',
    'neighborhood',
    'postalCode',
    'latitude',
    'longitude',
  ] as const),
) {}
