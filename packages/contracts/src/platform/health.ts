export const SERVICE_NAMES = {
  GATEWAY: 'gateway',
  CORE: 'core',
} as const;

export type ServiceName = (typeof SERVICE_NAMES)[keyof typeof SERVICE_NAMES];

export interface HealthResponse {
  service: ServiceName;
  status: 'ok';
  timestamp: string;
}
