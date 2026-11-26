// Replaces one App Store screenshot with the file of the same name from
// store/screenshots/ios:  node tools/release/asc-screenshot.mjs 8-title.png
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { asc } from './asc.mjs';

const name = process.argv[2];
if (!name) throw new Error('usage: asc-screenshot.mjs <file name>');
const bytes = readFileSync(new URL(`../../store/screenshots/ios/${name}`, import.meta.url));
const app = (await asc('GET', '/v1/apps?filter[bundleId]=com.comedy302.captainblastroid')).data[0];
const vers = await asc(
  'GET',
  `/v1/apps/${app.id}/appStoreVersions?include=appStoreVersionLocalizations`,
);
const loc = vers.included.find((i) => i.type === 'appStoreVersionLocalizations');
const sets = await asc(
  'GET',
  `/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?include=appScreenshots&limit[appScreenshots]=10`,
);
const set = sets.data.find((s) => s.attributes.screenshotDisplayType === 'APP_IPHONE_67');
const shots = (sets.included ?? []).filter((i) => i.type === 'appScreenshots');
const order = set.relationships.appScreenshots.data.map((d) => d.id);
const old = shots.find((s) => s.attributes.fileName === name);
if (old) await asc('DELETE', `/v1/appScreenshots/${old.id}`);

const shot = (
  await asc('POST', '/v1/appScreenshots', {
    data: {
      type: 'appScreenshots',
      attributes: { fileName: name, fileSize: bytes.length },
      relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } },
    },
  })
).data;
for (const op of shot.attributes.uploadOperations) {
  const headers = Object.fromEntries(op.requestHeaders.map((h) => [h.name, h.value]));
  const res = await fetch(op.url, {
    method: op.method,
    headers,
    body: bytes.subarray(op.offset, op.offset + op.length),
  });
  if (!res.ok) throw new Error(`upload → ${res.status}`);
}
await asc('PATCH', `/v1/appScreenshots/${shot.id}`, {
  data: {
    type: 'appScreenshots',
    id: shot.id,
    attributes: {
      uploaded: true,
      sourceFileChecksum: createHash('md5').update(bytes).digest('hex'),
    },
  },
});
// Keep the old position.
const next = order.map((id) => (old && id === old.id ? shot.id : id));
if (!old) next.push(shot.id);
await asc('PATCH', `/v1/appScreenshotSets/${set.id}/relationships/appScreenshots`, {
  data: next.map((id) => ({ type: 'appScreenshots', id })),
});
console.log(`${old ? 'replaced' : 'added'} ${name}; ${next.length} screenshots in the set`);
