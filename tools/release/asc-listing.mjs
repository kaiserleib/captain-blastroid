// Fills the App Store listing for the current version from store/listing.md and
// store/screenshots/ios. Safe to re-run. Does not submit anything for review.
//   set -a; . ./.env.local; set +a; node tools/release/asc-listing.mjs
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { asc } from './asc.mjs';

const BUNDLE = 'com.comedy302.captainblastroid';
const SITE = 'https://kaiserleib.github.io/captain-blastroid/';
const PRIVACY = `${SITE}privacy.html`;
const md = readFileSync(new URL('../../store/listing.md', import.meta.url), 'utf8');
const section = (title) => {
  const m = md.match(new RegExp(`^## ${title}[^\\n]*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm'));
  if (!m) throw new Error(`listing.md has no "${title}" section`);
  return m[1].trim();
};
const step = async (name, fn) => {
  try {
    await fn();
    console.log(`ok    ${name}`);
  } catch (e) {
    console.log(`FAIL  ${name}: ${e.message}`);
  }
};

const app = (await asc('GET', `/v1/apps?filter[bundleId]=${BUNDLE}`)).data[0];
const infos = await asc('GET', `/v1/apps/${app.id}/appInfos?include=appInfoLocalizations`);
const info = infos.data[0];
const infoLoc = infos.included.find((i) => i.type === 'appInfoLocalizations');
const vers = await asc(
  'GET',
  `/v1/apps/${app.id}/appStoreVersions?include=appStoreVersionLocalizations`,
);
const ver = vers.data[0];
const verLoc = vers.included.find((i) => i.type === 'appStoreVersionLocalizations');

await step('subtitle and privacy policy URL', () =>
  asc('PATCH', `/v1/appInfoLocalizations/${infoLoc.id}`, {
    data: {
      type: 'appInfoLocalizations',
      id: infoLoc.id,
      attributes: { subtitle: section('Subtitle'), privacyPolicyUrl: PRIVACY },
    },
  }),
);

const cat = (id) => ({ data: { type: 'appCategories', id } });
await step('category: Games (Action)', () =>
  asc('PATCH', `/v1/appInfos/${info.id}`, {
    data: {
      type: 'appInfos',
      id: info.id,
      relationships: {
        primaryCategory: cat('GAMES'),
        primarySubcategoryOne: cat('GAMES_ACTION'),
      },
    },
  }),
);

await step('version 1.0.0 and copyright', () =>
  asc('PATCH', `/v1/appStoreVersions/${ver.id}`, {
    data: {
      type: 'appStoreVersions',
      id: ver.id,
      attributes: { versionString: '1.0.0', copyright: '2026 302 Comedy LLC' },
    },
  }),
);

await step('description, keywords, promotional text, URLs', () =>
  asc('PATCH', `/v1/appStoreVersionLocalizations/${verLoc.id}`, {
    data: {
      type: 'appStoreVersionLocalizations',
      id: verLoc.id,
      attributes: {
        description: section('Description'),
        keywords: section('Keywords'),
        promotionalText: section('Promotional text'),
        supportUrl: PRIVACY,
        marketingUrl: SITE,
      },
    },
  }),
);

await step('content rights: no third-party content', () =>
  asc('PATCH', `/v1/apps/${app.id}`, {
    data: {
      type: 'apps',
      id: app.id,
      attributes: { contentRightsDeclaration: 'DOES_NOT_USE_THIRD_PARTY_CONTENT' },
    },
  }),
);

await step('age rating: mild cartoon violence only', () =>
  asc('PATCH', `/v1/ageRatingDeclarations/${info.id}`, {
    data: {
      type: 'ageRatingDeclarations',
      id: info.id,
      attributes: {
        violenceCartoonOrFantasy: 'INFREQUENT_OR_MILD',
        violenceRealistic: 'NONE',
        violenceRealisticProlongedGraphicOrSadistic: 'NONE',
        alcoholTobaccoOrDrugUseOrReferences: 'NONE',
        contests: 'NONE',
        gamblingSimulated: 'NONE',
        gunsOrOtherWeapons: 'NONE',
        medicalOrTreatmentInformation: 'NONE',
        profanityOrCrudeHumor: 'NONE',
        sexualContentGraphicAndNudity: 'NONE',
        sexualContentOrNudity: 'NONE',
        horrorOrFearThemes: 'NONE',
        matureOrSuggestiveThemes: 'NONE',
        advertising: false,
        gambling: false,
        lootBox: false,
        unrestrictedWebAccess: false,
        userGeneratedContent: false,
        messagingAndChat: false,
        parentalControls: false,
        ageAssurance: false,
        healthOrWellnessTopics: false,
        socialMedia: false,
        socialMediaAgeRestricted: false,
        sharedLocation: false,
        datingAndRelationships: false,
      },
    },
  }),
);

await step('review notes', async () => {
  const existing = await asc('GET', `/v1/appStoreVersions/${ver.id}/appStoreReviewDetail`).catch(
    () => null,
  );
  const attributes = { notes: section('Review notes'), demoAccountRequired: false };
  // Once it exists, Apple wants the contact fields with every change; those are set by hand.
  if (existing?.data?.attributes.notes === attributes.notes) return;
  if (existing?.data) {
    await asc('PATCH', `/v1/appStoreReviewDetails/${existing.data.id}`, {
      data: { type: 'appStoreReviewDetails', id: existing.data.id, attributes },
    });
  } else {
    await asc('POST', '/v1/appStoreReviewDetails', {
      data: {
        type: 'appStoreReviewDetails',
        attributes,
        relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: ver.id } } },
      },
    });
  }
});

await step('screenshots (6.9" iPhone)', async () => {
  const dir = new URL('../../store/screenshots/ios/', import.meta.url);
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.png'))
    .sort();
  const sets = await asc(
    'GET',
    `/v1/appStoreVersionLocalizations/${verLoc.id}/appScreenshotSets?include=appScreenshots`,
  );
  let set = sets.data.find((s) => s.attributes.screenshotDisplayType === 'APP_IPHONE_67');
  if (set && (sets.included ?? []).length > 0) {
    console.log('      already uploaded; delete them in App Store Connect to replace');
    return;
  }
  set ??= (
    await asc('POST', '/v1/appScreenshotSets', {
      data: {
        type: 'appScreenshotSets',
        attributes: { screenshotDisplayType: 'APP_IPHONE_67' },
        relationships: {
          appStoreVersionLocalization: {
            data: { type: 'appStoreVersionLocalizations', id: verLoc.id },
          },
        },
      },
    })
  ).data;
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
    console.log(`      ${f}`);
  }
});
