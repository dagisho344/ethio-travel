import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { HealthResponse } from './health.types';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOkResponse({ description: 'Returns application dependency health.' })
  async getHealth(): Promise<HealthResponse> {
    return this.healthService.check();
  }
}
