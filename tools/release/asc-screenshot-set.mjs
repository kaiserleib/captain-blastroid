// Uploads a folder of screenshots as one App Store screenshot set, replacing what is there:
//   node tools/release/asc-screenshot-set.mjs ipad APP_IPAD_PRO_3GEN_129
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import process from 'node:process';
import { asc } from './asc.mjs';

const [folder, displayType] = process.argv.slice(2);
if (!folder || !displayType)
  throw new Error('usage: asc-screenshot-set.mjs <folder> <displayType>');
const dir = new URL(`../../store/screenshots/${folder}/`, import.meta.url);
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.png'))
  .sort();
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
let set = sets.data.find((s) => s.attributes.screenshotDisplayType === displayType);
if (set) {
  for (const d of set.relationships.appScreenshots.data)
    await asc('DELETE', `/v1/appScreenshots/${d.id}`);
} else {
  set = (
    await asc('POST', '/v1/appScreenshotSets', {
      data: {
        type: 'appScreenshotSets',
        attributes: { screenshotDisplayType: displayType },
        relationships: {
          appStoreVersionLocalization: {
            data: { type: 'appStoreVersionLocalizations', id: loc.id },
          },
        },
      },
    })
  ).data;
}
for (const f of files) {
  const bytes = readFileSync(new URL(f, dir));
  const shot = (
    await asc('POST', '/v1/appScreenshots', {
      data: {
        type: 'appScreenshots',
        attributes: { fileName: f, fileSize: bytes.length },
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
    if (!res.ok) throw new Error(`upload of ${f} → ${res.status}`);
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
  console.log(f);
}
