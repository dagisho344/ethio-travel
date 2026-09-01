export type ServiceStatus = 'up' | 'down';

export interface FoundationHealth {
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
  };
  status: 'ok' | 'degraded';
  timestamp: string;
}
