import { parsePendingShip } from '../ship';

describe('parsePendingShip', () => {
  it('parses shipId and weaverDisplayName', () => {
    const ship = parsePendingShip({ shipId: 's1', weaverDisplayName: 'Bataar' } as any);
    expect(ship).toEqual({ shipId: 's1', weaverDisplayName: 'Bataar' });
  });
});
