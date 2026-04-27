import { describe, expect, it } from 'vitest';
import { applyDelta, customerResolver, RESOLVERS, serverWins, terminalWins } from './conflict.js';

describe('conflict resolvers', () => {
  it('terminalWins always returns the client copy', () => {
    expect(terminalWins({ server: { v: 1 }, client: { v: 2 } })).toEqual({ v: 2 });
    expect(terminalWins({ server: null, client: { v: 2 } })).toEqual({ v: 2 });
  });

  it('serverWins prefers server, falls back to client when server is null', () => {
    expect(serverWins({ server: { v: 1 }, client: { v: 2 } })).toEqual({ v: 1 });
    expect(serverWins({ server: null, client: { v: 2 } })).toEqual({ v: 2 });
  });

  it('applyDelta sums quantities', () => {
    const result = applyDelta({ quantityMilli: BigInt(5_000) }, { deltaMilli: BigInt(-1_500) });
    expect(result.quantityMilli).toBe(BigInt(3_500));
  });

  it('customerResolver: server wins for profile fields, max wins for activity counters', () => {
    const out = customerResolver({
      server: {
        fullName: 'Server Name',
        email: 'server@x.com',
        phoneHash: 'hashS',
        lastVisitAt: '2026-05-01T00:00:00Z',
        visitCount: 3,
      },
      client: {
        fullName: 'Client Name',
        email: 'client@x.com',
        phoneHash: 'hashC',
        lastVisitAt: '2026-05-05T00:00:00Z',
        visitCount: 5,
      },
    });
    expect(out.fullName).toBe('Server Name');
    expect(out.email).toBe('server@x.com');
    expect(out.lastVisitAt).toBe('2026-05-05T00:00:00Z');
    expect(out.visitCount).toBe(5);
  });

  it('RESOLVERS map covers expected entity kinds', () => {
    expect(RESOLVERS.order).toBe(terminalWins);
    expect(RESOLVERS.payment).toBe(terminalWins);
    expect(RESOLVERS.menu_item).toBe(serverWins);
    expect(RESOLVERS.settings).toBe(serverWins);
  });
});
