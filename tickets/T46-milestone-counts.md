# T46 — Anonymous milestone counts for the free expansion
Status: in progress (code done; backend not deployed)
Wave: — (release) · Depends on: T45 · Blocks: deciding when to charge for the next pack

## Goal
Act II is free and claimed inside the app, so neither store can say how many players take it. Count that, on both stores, without identifying anyone.

## Owns
`src/meta/telemetry.ts`, `src/platform/os.ts`, `tools/telemetry/supabase.sql`.

## Acceptance criteria
- [x] Five milestones, each reported once per install: `first_open`, `act1_clear` (first clear of the last base sector), `offer_seen_<pack>` (store page opened while unowned), `pack_get_<pack>` (free claim or purchase), `pack_play_<pack>` (first run in one of the pack's sectors finished).
- [x] A report is `{ event, platform, version }` and nothing else: no install, device or user id.
- [x] Milestones reached offline are queued in storage and sent on a later launch or resume.
- [x] Off unless the build sets `VITE_TELEMETRY_URL`; never sent from dev, `?save=` / `?dlc=store` sessions or automated browsers.
- [x] Backend SQL: a daily-totals table closed to the API and one whitelisting function callable with the publishable key. Checked against an in-process Postgres (PGlite), not against Supabase.
- [x] Privacy policy and the store data-safety answers describe the counts.
- [ ] Backend deployed, `.env.production` written, and a real device seen to add to the totals.
- [x] build / test / lint pass.

## Contract changes (additive)
- `meta/telemetry`: `milestone`, `initTelemetry`, `flushTelemetry`, `httpSender`.
- `platform`: `runtimeOs()`.
- New storage key `captain-blastroid.telemetry`. The save format is unchanged.

## Limits
- Counts are installs, not people: a reinstall counts again.
- Anyone with the public key can inflate a total; only whitelisted event names are accepted.
