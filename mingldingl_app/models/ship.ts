import type { components } from '../lib/api/api.generated';

export interface PendingShip {
  shipId: string;
  weaverDisplayName: string;
}

export function parsePendingShip(d: components['schemas']['PendingShipResponse']): PendingShip {
  return {
    shipId: d.shipId ?? '',
    weaverDisplayName: d.weaverDisplayName ?? '',
  };
}
