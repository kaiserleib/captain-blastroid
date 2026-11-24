# T45 — Store release split: base game + Act II expansion
Status: done
Wave: — (release) · Depends on: T44 · Blocks: store submission

## Goal
Ship sectors 1–5 as the base game, with sectors 6–10 plus the Gauntlet as a separate expansion. The second wave of ships, pilots and weapons is only available with the expansion. The expansion is free at launch (claimed in the app); the next pack will be paid.

## Owns
`src/content/packs.ts`, `src/meta/entitlements.ts`, `src/platform/capacitor/store.ts`, `src/platform/web/devStore.ts`, `src/scenes/ExpansionScene.ts`, plus the gating edits listed under "Contract changes".

## Acceptance criteria
- [x] One content pack, `act2`: sectors 6–10 and the Gauntlet, ships Shrike / Ferret / Wraith / Revenant / Nova, pilots Ines / Rook / Nyx / Halasz / Wren, weapons Arc / Ricochet / Flak. The lists are derived from where content is earned, and a test pins them.
- [x] Without the pack: those sectors can't be selected or launched, the ships and pilots can't be selected, and the weapons never drop, even when the save already has them (a save code from another device, a refund). Progress is kept, so owning the pack again restores everything.
- [x] Act II is a free pack (`productId: null`): GET FREE on its store page claims it on the device with no store transaction, and the claim persists.
- [x] For paid packs, ownership comes from the store account, not the save: StoreKit 2 / Play Billing through `@capgo/native-purchases`, cached locally for offline launches, re-checked at boot, on resume and on store transaction updates.
- [x] Store page (`ExpansionScene`): contents, then GET FREE for a free pack, or the store's localized price with BUY and RESTORE PURCHASE for a paid one. Reached from a locked sector card, a locked ship or pilot, and from the results screen after the first sector 5 clear.
- [x] The web build has no store. The Pages workflow builds it with `VITE_WEB_DLC=locked`, so the public web version is the base game only.
- [x] Release identity: `com.comedy302.captainblastroid`, team 302 Comedy LLC, version 1.0.0, iPhone only, signed Android bundle, release scripts in `tools/release/`, listing in `store/listing.md`, privacy policy at `public/privacy.html`.
- [x] Dev: `?dlc=0` previews the base game, `?dlc=store` adds a fake store to walk buy and restore.
- [x] build / test / test:sim / lint / e2e pass; the iOS simulator build and the Android debug build both succeed with the plugin.

## Contract changes (additive)
- `Platform.store: Store | null` (`owned`, `product`, `purchase`, `restore`, `onChange`). Null on the web.
- `content/packs`: `PACKS`, `PACK_ORDER`, `packOf(kind, id)`, `packForProduct()`, `isFreePack()`.
- `meta/entitlements`: `ownsPack`, `owns`, `canGetPacks`, `initEntitlements`, `refreshEntitlements`, `buyPack`, `restorePacks`, `packPrice`, `onEntitlementsChange`, `setOwnedPacks`.
- `meta/progression`: `ShipStatus` gains `'pack'`; `isLevelUnlocked`, `selectShip`, `selectPilot` and `bankRun`'s next-sector pick respect ownership; new `pilotAvailable`, `usableWeapons`, `enforceOwnership`.
- `SectorInfo.needsPack`; `flow.expansion(pack, back)`; `flow.sectors(focusLevel?)`.
- `DebugFlags.lockPacks`, `DebugFlags.fakeStore`.
- The save format is unchanged (still v3).

## Notes
- **Ownership is not in the save** so that an exported save code can't carry the expansion to a device that hasn't bought it. The cache key is `captain-blastroid.packs`.
- **A failed store query keeps the last known answer**; a successful one replaces it, which is how a refund removes the pack.
- **Hangar upgrades stay in the base game**, including the late-game ones added with Act II.
- **Free claims are stored separately** (`captain-blastroid.packs.claimed`) and are never removed by a store refresh, so a pack that later becomes paid stays open for whoever claimed it.
- **Nothing counts claims.** The game has no analytics, so the stores report installs but not how many players took the expansion.

## For a human
The store-side steps (app records, listing, upload) are in `docs/mobile.md` → "Store release".
