import { ServiceCategoryFamily } from '@prisma/client';
import { PrismaService } from './prisma/prisma.service';
import { ServiceCategoryQueryDto } from './service-categories/dto/service-category-query.dto';
import { ServiceCategoriesService } from './service-categories/service-categories.service';
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

describe('Phase 14H public service category filtering', () => {
  it('uses the active family predicate in the database query', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = {
      serviceCategory: { findMany, count },
      $transaction: jest.fn((operations: readonly unknown[]) =>
        Promise.all(operations),
      ),
    } as unknown as PrismaService;

    await new ServiceCategoriesService(prisma).findPublic({
      family: ServiceCategoryFamily.RESTAURANT,
      page: 1,
      limit: 20,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          family: ServiceCategoryFamily.RESTAURANT,
          isActive: true,
        },
      }),
    );
  });

  it('validates the optional public category family as an enum', async () => {
    const valid = plainToInstance(ServiceCategoryQueryDto, {
      family: ServiceCategoryFamily.TRANSPORT,
      page: 1,
      limit: 20,
    });
    const invalid = plainToInstance(ServiceCategoryQueryDto, {
      family: 'UNSUPPORTED',
      page: 1,
      limit: 20,
    });

    await expect(validate(valid)).resolves.toHaveLength(0);
    const errors = await validate(invalid);
    expect(errors.some((error) => error.property === 'family')).toBe(true);
  });
});
