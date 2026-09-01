export interface HealthResponse {
  services: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
  };
  status: 'ok' | 'degraded';
  timestamp: string;
}
