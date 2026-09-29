import { BadRequestException, PipeTransform } from '@nestjs/common';

/** Scope this root-shape check to Region commands; do not change global DTO behavior. */
export class RegionTranslationBodyPipe implements PipeTransform {
  transform(value: unknown): unknown {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException(
        'A Region translation command requires an object body.',
      );
    }
    return value;
  }
}
