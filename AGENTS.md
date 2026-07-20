# Codex Quota Monitor — Contributor Rules

This file is the persistent engineering contract for Codex and human contributors.
Read it before changing the project. Update it whenever a new invariant, failure
mode, or regression is discovered.

## Scope and packaging

- This is a Windows x64 Electron desktop application, not a website.
- The production window is a fixed 460 × 690 transparent, frameless liquid-glass
  card.
- `AGENTS.md` is development-only. It must be committed to the repository but
  must never be included in portable, installer, unpacked, or ASAR output.
- Keep `build.files` as an explicit allowlist containing only `src/**/*` and
  `package.json`. Do not replace it with a broad glob.
- `README.md`, `AGENTS.md`, tests, preview scripts, source-control metadata, logs,
  and temporary files must remain outside packaged apps.
- `test/packaging.test.js` protects this rule. After a release build, also inspect
  `app.asar` rather than trusting configuration alone.

## Product contract

The monitor must:

- Show the 5-hour quota, remaining percentage, and scheduled recovery.
- Show the weekly quota, remaining percentage, and scheduled recovery.
- Handle the official special state in which the 5-hour window is not returned.
- Show every available reset credit, with localized type and its own expiry.
- Detect newly received reset credits without treating the first run as an event.
- distinguish a user-consumed reset credit from an official remote reset.
- Permanently retain official-reset history and show the latest event on the card.
- Detect both a Codex client update ready to install and a newly installed version.
- Report Codex online only when the local app-server can reach the OpenAI service
  and return quota data.
- Give an offline VPN/network/sign-in hint, including the mainland-China case.
- Support complete Chinese and English UI.
- Support click-to-upload and drag-to-upload backgrounds, manual fixed-ratio
  cropping, and background opacity.
- Support native window movement, position lock, always-on-top, tray hide/show,
  manual refresh, and 60-second auto-refresh.

Do not remove or weaken an existing function while implementing a visual change.

## Architecture

- `src/main.js`
  - Electron lifecycle, fixed window constraints, tray, native dialogs, settings
    IPC, background persistence.
- `src/preload.js`
  - Minimal sandboxed bridge. Keep the exposed API narrow.
- `src/quota-service.js`
  - Coordinates app-server reads, stored baselines, event detection, and client
    update status.
- `src/quota-normalizer.js`
  - Normalizes server rate-limit windows and reset-credit details.
- `src/codex-update-service.js`
  - Reads the installed Store package version and only the Codex Windows Store
    updater status lines needed to detect pending updates.
- `src/store.js`
  - Local JSON persistence.
- `src/renderer/index.html`
  - Semantic UI structure.
- `src/renderer/styles.css`
  - Fixed-size liquid-glass layout, native drag regions, overflow behavior.
- `src/renderer/renderer.js`
  - i18n dictionaries, rendering, interactions, crop workflow, refresh state.
- `src/renderer/crop-geometry.js`
  - Pure crop geometry.
- `test/`
  - Node tests for quota/event logic, update logic, crop geometry, layout,
    localization, and packaging.
- `scripts/renderer-preview-*`
  - Local visual-regression preview only; never package it.

Renderer security settings are non-negotiable:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- A restrictive Content Security Policy
- No credentials, API keys, tokens, raw app-server payloads, or conversation
  content exposed to or logged by the renderer

## Fixed window and dragging invariants

The window must remain exactly 460 × 690 during its whole lifetime:

- `width`, `height`, minimum size, and maximum size must all remain 460 × 690.
- Keep `resizable: false`, `maximizable: false`, `fullscreenable: false`,
  `frame: false`, `thickFrame: false`, and `hasShadow: false`.
- Keep the native `will-resize` prevention as a final guard.
- Never create transparent padding outside the visible rounded card.
- Never add a system shadow or wrapper that produces an outer ring.

Movement must use Electron/Chromium native `-webkit-app-region: drag` areas:

- The title-bar free space and all four edge strips are drag regions.
- Buttons, connection controls, popovers, dialogs, upload controls, crop controls,
  status buttons, and scrollable lists are `no-drag`.
- When position is locked, every drag region must be disabled together.
- Lock controls window movement only. It is not the always-on-top setting.
- Do not implement pointer/mouse move loops that call `setBounds`, `setPosition`,
  or continually calculate cursor deltas.
- Do not use resize hit-testing as a substitute for movement.
- Do not change edge-strip width or stacking without interactive verification.
- Saving the final position may be debounced; moving the window may not be.
- Tray show/focus must never synthesize or preserve a drag gesture.

### Historical and recurring movement failures

These regressions have occurred repeatedly and require manual testing after any
change to main-process window options, CSS hit regions, overlays, or tray logic:

1. The window could only be dragged from the title bar.
2. Pressing an edge stretched the window indefinitely.
3. An edge oscillated between resize and forced fixed size.
4. Edge hover hit-testing became intermittent or impossible.
5. The window began stretching only after movement started.
6. Dragging became severely laggy due to per-frame JS movement or bound writes.
7. Clicking the tray icon woke the window already attached to the mouse cursor,
   blocking other mouse actions.
8. Fixing lag accidentally made all drag regions stop working.
9. A transparent or shadowed outer border appeared around the card.

Do not call a dragging change complete from static inspection. Manually verify:

- unlocked title drag;
- unlocked top, right, bottom, and left edge drag;
- smooth continuous movement for several seconds;
- unchanged 460 × 690 bounds throughout;
- locked title and edge behavior;
- controls near each edge remain clickable;
- hide to tray, single-click restore, release the mouse, then use other controls;
- no cursor capture, sticking, resize cursor, jitter, lag, or outer ring.

## Layout and readability invariants

- The two quota panels are equal-width cards in one left/right row.
- The three status cards are one row immediately below the quota row, ordered:
  new reset credit, official reset, Codex client update.
- The reset-credit section is last, above the footer.
- Keep only one refresh control: the refresh button in the connection strip.
  The removed top-left refresh button must not return.
- The footer must remain visible in online and offline states with no unexplained
  bottom blank area.
- Default body text must be comfortably readable at 460 × 690. Do not reduce text
  merely to make a layout fit.
- English strings must wrap or reflow. Do not use `text-overflow: ellipsis` for
  status, quota, reset, update, or accessibility-critical copy.
- Check real English text, not only placeholder dashes.
- Keep the liquid-glass layers, translucency, blur, refraction, subtle borders,
  and readable contrast over both light and dark custom backgrounds.

### Reset-list capacity

- Show each returned credit as its own row.
- One through six rows must fit without moving the window boundary.
- More than six rows must scroll inside the reset list.
- Large counts must not stretch the card, overlap the footer, or squeeze the quota
  and status rows.
- If the service returns a total count but temporarily omits some details, render
  the known rows plus one localized missing-details row.

## Quota normalization

- Identify quota windows by `windowDurationMins`, not by `primary`/`secondary`
  order or object position.
- The 5-hour target is approximately 300 minutes.
- The weekly target is approximately 10,080 minutes.
- Retain a small duration tolerance for server variation.
- Missing 5-hour data with valid weekly data is an official paused/disabled
  special state, not offline, not missing weekly data, and not itself a reset.
- Preserve the most recent complete reset-credit details when a same-count server
  response temporarily contains only a count.
- Validate numeric timestamps and percentages before rendering or comparing them.

## Reset-credit and event rules

### Newly received credits

- The first successful snapshot establishes the baseline and must not report old
  credits as newly received.
- Prefer stable item IDs for comparison.
- A later unseen ID may create a new-credit event.
- The UI notice is retained for seven days.
- Persist the seen baseline in `quota-state.json`.

### User manual resets

A user-triggered reset normally restores quota while consuming at least one
available reset credit. If the available count decreases across the same snapshots:

- classify it as a manual reset;
- show that it was excluded;
- never append it to official-reset history;
- do not let simultaneous quota recovery override the consumed-credit evidence.

### Official remote resets

An official reset is a local inference, not an OpenAI event API. Required evidence:

- Codex is online for the new snapshot.
- Consecutive comparable snapshots exist.
- The relevant quota previously had actual usage.
- It returns to 100% before the old scheduled recovery time, with at least the
  established safety margin (currently about 90 seconds).
- Available reset credits do not decrease.

Supported modes:

- `all-limits`: both 5-hour and weekly windows exist before and after, and both
  restore early to 100%.
- `weekly-only-five-hour-disabled`: the official 5-hour window is absent and the
  weekly quota alone restores early to 100%.

Never infer an official reset from:

- first run;
- an offline or failed read;
- missing previous evidence;
- an ordinary scheduled recovery;
- a 5-hour window merely disappearing;
- a quota increase that does not reach 100%;
- a simultaneous decrease in reset credits.

Official-reset records are permanent:

- append to history in `quota-state.json`;
- retain detection time and mode;
- display the most recent event on the main card;
- display all records newest-first in the history dialog;
- migrate the old single `officialResetAt` value;
- de-duplicate adjacent refreshes of the same event;
- never expire history after one minute or seven days.

The displayed time is when the monitor first observed the reset. If the app was
closed, offline, or lacked the preceding snapshot, it cannot reconstruct history.

## Codex client update detection

Keep these states distinct:

- `update-ready`: Codex has found and downloaded/staged a newer Store update.
- `updated`: the installed Store package version increased.
- `current`: a valid check reports no pending or newly installed update.
- `unavailable`: installed/update status cannot be determined safely.

Pending update rules:

- Read the installed `OpenAI.Codex` or compatible `OpenAI.ChatGPT` Store package
  version locally.
- Parse only lines tagged `[windows-store-updater]`.
- A positive pending signal requires the updater result to include
  `canSilentlyDownload=true`, `completed=true`, and `hasUpdate=true`.
- The log's checked/build version must match the installed version.
- The target/manifest version must be newer than the installed version.
- Persist the pending target across monitor restarts.
- Clear it only after that version is installed or a later explicit updater result
  for the same installed version says no update.
- Detecting a higher installed version creates an installed-update notice retained
  for seven days.
- The first observed installed version is a baseline, not an update event.

Performance and privacy:

- Keep the updater scan bounded by file count, bytes, and age.
- Keep the 15-minute scan cache unless a tested reason requires changing it.
- Do not scan or store conversation bodies, prompts, account credentials, or
  unrelated log contents.
- Do not use `winget`, arbitrary web releases, filename guesses, or account UI text
  as the authoritative latest-version source.
- A quota connection failure must not erase a valid local pending-update state.

The old implementation only compared installed versions and therefore missed the
client's visible “Update” button before installation. Do not regress to that model.

## Background workflow

- Upload must work by both clicking the upload area/button and dragging a file
  onto the upload zone.
- Accept PNG, JPG/JPEG, WebP, and GIF inputs up to 20 MB.
- Source width must be strictly greater than 460 pixels.
- Source height must be strictly greater than 690 pixels.
- Equal-size and undersized images must be rejected with localized feedback.
- The user must manually position and resize a 460:690 crop frame.
- The crop frame must remain inside the source image.
- Export the stored background as 460 × 690 PNG.
- Keep opacity adjustable within the established range.
- Upload/crop/drop interactions must never start a window drag.
- Background contrast must not make text or controls unreadable.

## Internationalization

Chinese and English are equally supported product modes.

- Every user-visible string must have both `zh` and `en` entries.
- The dictionaries must expose exactly the same keys.
- Localize dynamic statuses, reset types, errors, dates, dialog text, tray menu
  text, tray tooltip, window title, `title` attributes, `aria-label` values, and
  region/dialog names.
- `data-i18n` covers static visible text; `applyLanguage()` must update dynamic and
  accessibility-only attributes.
- The language button intentionally shows the *target* language: `EN` in Chinese
  mode and `中` in English mode.
- Product/section marks such as `CODEX PULSE`, `RESET CREDITS`, and
  `BACKGROUND CROP` may remain English as intentional visual branding.
- Known API enums must use localized application copy before raw server titles.
  In particular, `resetType === "codexRateLimits"` maps to localized `fullReset`.
- Unknown server-provided proper names may be displayed verbatim only when no safe
  mapping exists.
- Run `test/localization.test.js` after adding, removing, or renaming any copy.
- Visually inspect the entire English window, every popover/dialog, online/offline,
  the 5-hour-paused state, long reset dates, and update states for clipping.

Historical language/readability failures:

- English mode retained Chinese button and region accessibility labels.
- The document/window title remained Chinese after switching to English.
- The tray tooltip remained Chinese.
- Some longer English copy was rendered as `...`.
- Typography was reduced until normal text became difficult to read.
- A raw server `Full reset` title bypassed Chinese localization.

## Tray and icon rules

- Use the current original-style Codex-derived desktop/tray assets.
- Do not redesign or replace the icon unless the user explicitly requests it.
- Keep dark- and light-theme tray variants.
- Single-clicking the tray icon toggles visibility.
- Closing the card hides it to the tray; quitting is a tray-menu action.
- Tray menu and tooltip must update immediately after language changes.
- Portable and installer builds have the same runtime features. They differ only
  in installation, shortcuts, and uninstall integration.

## State, privacy, and error handling

- Settings are stored in `settings.json`.
- Event baselines, reset history, credit detail cache, and client-update state are
  stored in `quota-state.json`.
- Cropped background is stored in the Electron user-data directory.
- Write sensitive local state with restrictive file permissions where supported.
- Never ask the user for an OpenAI API key.
- Authentication belongs to the local Codex app-server.
- Do not persist raw protocol responses or app-server stderr.
- Offline handling must distinguish at least not-installed, not-signed-in,
  timeout/network failure, and generic connection failure where evidence allows.
- The mainland-China offline message must continue to mention VPN and network
  checks in both languages.
- Avoid destructive state migrations. Preserve prior reset and update history.

## Testing matrix

Run `npm test` for every functional change. Add regression coverage before or with
the fix. At minimum, automated tests must continue covering:

- 5-hour and weekly duration-based identification;
- missing/paused 5-hour window;
- credit detail retention and six-plus overflow contract;
- first-run baseline and newly received credit detection;
- scheduled recovery versus early official reset;
- both official-reset modes;
- manual reset exclusion;
- permanent history migration and de-duplication;
- Store updater log parsing, pending persistence/clearing, and installed updates;
- crop containment, movement, resize, ratio, and source-to-output mapping;
- side-by-side quota cards, three-card status row, reset section ordering;
- bilingual key parity and dynamic accessibility labels;
- development-file package exclusion.

For UI or main-window changes, also run a 460 × 690 visual/manual matrix:

- Chinese and English;
- online and offline;
- 5-hour present and paused;
- zero credits, one credit, six credits, and more than six credits;
- no official history and multiple history records;
- current client, update ready, and update installed;
- default background and light/dark custom backgrounds;
- background popover, crop dialog, and reset-history dialog;
- unlocked/locked title and four-edge movement;
- hide and single-click restore from tray.

Verify:

- no overflow beyond 460 × 690;
- no clipped or ellipsized English;
- footer remains visible;
- reset list alone scrolls when needed;
- no duplicate refresh button;
- no outer ring or extra transparent border;
- no movement lag, stretch, jitter, cursor capture, or tray sticking.

## Build and release checklist

1. Preserve unrelated user changes in a dirty worktree.
2. Never use destructive reset/checkout operations to clean the tree.
3. Update `package.json` and `package-lock.json` versions together when a new
   public version is required.
4. Run `node --check` for changed JavaScript where useful.
5. Run `npm test`.
6. Complete the visual/manual matrix proportionate to the change.
7. Run `npm run build`.
8. Confirm portable and NSIS filenames and architectures.
9. Inspect the packaged ASAR:
   - required `src` files are present;
   - `AGENTS.md`, `README.md`, `test/`, `scripts/`, and repository metadata are
     absent.
10. Record output sizes and SHA-256 hashes.
11. Smoke-launch the newly built executable, not an older process or artifact.
12. Do not commit, push, create a GitHub release, or upload artifacts unless the
    user explicitly authorizes that external action.

## Change discipline

- Prefer small, evidence-backed changes over rewrites.
- Preserve established visual style and interaction behavior.
- Fix root causes; do not hide symptoms by shrinking text, forcing bounds every
  frame, expiring history, or suppressing state.
- Keep pure detection/geometry logic independently testable.
- Treat server schemas and Store updater logs as untrusted input.
- Bound filesystem scans and expensive work.
- If a reported issue cannot be reproduced, inspect persisted state, real local
  logs, and the current packaged version before changing detection heuristics.
- When a regression or new product rule is found, add:
  1. a focused test where automation is possible;
  2. a manual checklist item where native interaction is involved;
  3. a concise entry in this `AGENTS.md`.
