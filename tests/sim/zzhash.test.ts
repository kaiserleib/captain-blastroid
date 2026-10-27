import { it } from 'vitest';
import { dodgerBot, godBot } from './bots';
import { runSim } from './harness';

it('hashes', () => {
  const out: string[] = [];
  out.push('god ' + runSim('hash-god', godBot(), 300).hash);
  out.push('dodger ' + runSim('hash-dodger', dodgerBot(), 200).hash);
  for (const id of ['kessler', 'ionShoals', 'eventHorizon', 'pulsarNursery', 'armada'])
    out.push(id + ' ' + runSim('hash-' + id, dodgerBot(), 120, { levelId: id }).hash);
  console.log(out.join('\n'));
}, 600000);
