import { PartialType } from '@nestjs/swagger';
import { CreateAttractionDto } from './create-attraction.dto';

export class UpdateAttractionDto extends PartialType(CreateAttractionDto) {}
