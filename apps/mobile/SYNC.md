# Mobile cloud sync

Optional Supabase-backed sync between this app and the web app. Local SQLite is always the
source of truth for ringing: alarms fire from the device even offline or signed out. The
cloud is a mirror/backup, never a dependency.

## Design

- **Auth**: Supabase email+password (`src/services/supabase.ts`), same project as the web.
  Session stored in expo-secure-store (Keychain/Keystore). Signed out ⇒ every sync call is a
  silent no-op.
- **Sync engine**: `src/services/sync.ts`. `syncNow()` runs a full pull+push cycle
  (alarms, then recordings) and coalesces concurrent calls into the one in flight.
  `requestSync(reason)` is the fire-and-forget wrapper — it never throws; failures only log.

## Triggers

- App start and every AppState transition to `active` (`app/_layout.tsx`).
- After alarm mutations in the lab (`app/index.tsx`: schedule test alarm).
- After sign-in / sign-up and the manual "Sync now" button (`app/account.tsx`).
- Local deletes go through `deleteAlarmEverywhere(id)`, which deletes locally and then
  best-effort deletes the cloud row.

## Merge rules

- **Alarms**: last-write-wins by `updatedAt` (ISO string compare), per row.
  Pull rows that are new or newer than local; push rows missing remotely or newer locally.
  Pulled changes re-arm the native scheduler (cancel + schedule) so fire times stay correct.
- **Deletes**: no tombstones. A delete while signed in removes both copies immediately;
  a delete made offline can be resurrected by the next pull. Accepted trade-off for the MVP.
- **Recordings**: content-addressed by id and immutable — added/removed, never merged.
  Cloud rows are cached in the local `cloud_recordings` table (metadata only); rows that
  disappear from the cloud are dropped along with any downloaded file. Device recordings
  missing in the cloud are uploaded (storage path `userId/id.ext`, private bucket; the DB
  insert is rolled back if it fails after upload).

## Recordings caching

Audio is downloaded on demand (`downloadRecording(id)`) via a 1-hour signed URL into
`Paths.document/cloud-recordings/`, and `local_uri` is remembered so playback works offline
afterwards. A missing/deleted local file triggers a re-download.

## Limits

- No realtime: sync happens only on the triggers above.
- LWW granularity is the whole alarm row (no field-level merge).
- Recording uploads/downloads are whole files; very large files just take longer — there is
  no chunking or resume.
- Clock skew can mis-order LWW since `updatedAt` comes from each device.
- Errors never surface to alarm flows; check the logs (Diagnostics) or the Account screen's
  "Last synced" timestamp.
