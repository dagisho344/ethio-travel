import { PartialType } from '@nestjs/swagger';
import { CreateBusinessCategoryDto } from './create-business-category.dto';

export class UpdateBusinessCategoryDto extends PartialType(
  CreateBusinessCategoryDto,
) {}
