import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryStorage } from '../platform';
import {
  flushTelemetry,
  httpSender,
  initTelemetry,
  milestone,
  resetTelemetry,
  TELEMETRY_KEY,
  type Milestone,
} from './telemetry';

const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

async function saved(s: MemoryStorage): Promise<{ done: string[]; queue: string[] }> {
  return JSON.parse((await s.get(TELEMETRY_KEY)) ?? '{}') as { done: string[]; queue: string[] };
}

describe('telemetry', () => {
  beforeEach(() => resetTelemetry());

  it('reports first_open once per install, and each milestone once', async () => {
    const s = new MemoryStorage();
    const sent: Milestone[] = [];
    const send = (m: Milestone): Promise<boolean> => {
      sent.push(m);
      return Promise.resolve(true);
    };
    await initTelemetry(s, send);
    milestone('pack_get_act2');
    milestone('pack_get_act2');
    await settle();
    expect(sent).toEqual(['first_open', 'pack_get_act2']);
    expect(await saved(s)).toEqual({ done: ['first_open', 'pack_get_act2'], queue: [] });

    // Next launch: nothing is repeated.
    await initTelemetry(s, send);
    milestone('pack_get_act2');
    await settle();
    expect(sent).toHaveLength(2);
  });

  it('keeps milestones reached offline and sends them later, in order', async () => {
    const s = new MemoryStorage();
    let online = false;
    const sent: Milestone[] = [];
    const send = (m: Milestone): Promise<boolean> => {
      if (!online) return Promise.reject(new Error('offline'));
      sent.push(m);
      return Promise.resolve(true);
    };
    await initTelemetry(s, send);
    milestone('act1_clear');
    await settle();
    expect(sent).toEqual([]);
    expect((await saved(s)).queue).toEqual(['first_open', 'act1_clear']);

    // A later launch with a connection.
    online = true;
    await initTelemetry(s, send);
    await settle();
    expect(sent).toEqual(['first_open', 'act1_clear']);
    expect((await saved(s)).queue).toEqual([]);
  });

  it('stops at a rejected send and retries on the next flush', async () => {
    const s = new MemoryStorage();
    let ok = false;
    let calls = 0;
    await initTelemetry(s, () => {
      calls++;
      return Promise.resolve(ok);
    });
    await settle();
    expect(calls).toBe(1);
    ok = true;
    await flushTelemetry();
    expect((await saved(s)).queue).toEqual([]);
  });

  it('records nothing when reporting is off', async () => {
    const s = new MemoryStorage();
    await initTelemetry(s, null);
    milestone('act1_clear');
    await settle();
    expect(await s.get(TELEMETRY_KEY)).toBeNull();
  });

  it('survives a corrupt record', async () => {
    const s = new MemoryStorage();
    await s.set(TELEMETRY_KEY, '{not json');
    const sent: Milestone[] = [];
    await initTelemetry(s, (m) => {
      sent.push(m);
      return Promise.resolve(true);
    });
    await settle();
    expect(sent).toEqual(['first_open']);
  });
});

describe('httpSender', () => {
  it('posts the milestone with no identifier', async () => {
    const calls: { url: string; headers: Record<string, string>; body: string }[] = [];
    const send = httpSender(
      'https://example.test/count',
      'pk',
      { platform: 'ios', version: '1.0.0' },
      (url, init) => {
        calls.push({ url, headers: init.headers, body: init.body });
        return Promise.resolve({ ok: true });
      },
    );
    expect(await send('pack_get_act2')).toBe(true);
    expect(calls[0]?.url).toBe('https://example.test/count');
    expect(calls[0]?.headers.apikey).toBe('pk');
    expect(JSON.parse(calls[0]?.body ?? '')).toEqual({
      event: 'pack_get_act2',
      platform: 'ios',
      version: '1.0.0',
    });
  });

  it('reports a server refusal as not sent', async () => {
    const send = httpSender('u', null, { platform: 'web', version: '1' }, () =>
      Promise.resolve({ ok: false }),
    );
    expect(await send('first_open')).toBe(false);
  });
});
