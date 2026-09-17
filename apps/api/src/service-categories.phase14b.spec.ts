import { ServiceCategoryFamily } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateServiceCategoryDto } from './service-categories/dto/create-service-category.dto';
import { UpdateServiceCategoryDto } from './service-categories/dto/update-service-category.dto';

describe('Phase 14B service category families', () => {
  it('accepts an explicit stable family for admin category creation and updates', async () => {
    const create = plainToInstance(CreateServiceCategoryDto, {
      code: 'HOTEL',
      family: ServiceCategoryFamily.ACCOMMODATION,
      name: 'Hotel',
    });
    const update = plainToInstance(UpdateServiceCategoryDto, {
      family: ServiceCategoryFamily.ACCOMMODATION,
    });

    await expect(validate(create)).resolves.toHaveLength(0);
    await expect(validate(update)).resolves.toHaveLength(0);
  });

  it('rejects an unknown service category family', async () => {
    const dto = plainToInstance(CreateServiceCategoryDto, {
      code: 'UNSAFE',
      family: 'DATABASE_SECRET',
      name: 'Unsafe category',
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'family')).toBe(true);
  });
});
