# Codex Quota Monitor — Contributor Rules

This file is the persistent engineering contract for Codex and human contributors.
Read it before changing the project. Update it whenever a new invariant, failure
mode, or regression is discovered.

## Scope and packaging

- This is a Windows x64 Electron desktop application, not a website.
- The production UI uses one fixed 460 × 690 transparent, frameless liquid-glass
  window whose visible region can be clipped to a 76 × 76 floating orb.
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
- Show the account lifetime Token total and current consecutive-work-day streak.
- Show an animated Token usage line chart switchable between daily, weekly, and
  monthly aggregation.
- Report Codex online only when the local app-server can reach the OpenAI service
  and return quota data.
- Give an offline VPN/network/sign-in hint, including the mainland-China case.
- Support complete Chinese and English UI.
- Support click-to-upload and drag-to-upload backgrounds, manual fixed-ratio
  cropping, and background opacity.
- Support native window movement, position lock, always-on-top, tray hide/show,
  manual refresh, and 60-second auto-refresh.
- Support immediate collapse to a freely movable floating orb and restoration to
  the full card without a cross-window snapshot animation.

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
- `src/token-usage.js`
  - Normalizes account Token summaries and daily buckets, restores the last safe
    snapshot when needed, and performs deterministic day/week/month aggregation.
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

The app uses exactly one persistent 460 × 690 native window:

- Width, height, minimum size, and maximum size remain 460 × 690 for the whole
  lifetime.
- Floating-orb mode clips that same native surface and hit-test region to a
  76 × 76 rectangle at the saved anchor with `setShape()`. The renderer hides
  the full card and draws an antialiased CSS circle inside that transparent
  region. It does not create, hide, show, resize, or swap another BrowserWindow.
- Do not create an orb BrowserWindow, transition BrowserWindow, capture renderer
  snapshots, or interpolate native bounds. A bounded two-frame renderer paint
  synchronization before applying the circular shape is allowed to prevent a
  stale full-card frame from being clipped into the orb.
- Keep `resizable: false`, `maximizable: false`, `fullscreenable: false`,
  `frame: false`, `thickFrame: false`, and `hasShadow: false`.
- Keep the native `will-resize` prevention as a final guard.
- Never create transparent padding outside the visible rounded card.
- Never add a system shadow or wrapper that produces an outer ring.

Movement must use Electron/Chromium native `-webkit-app-region: drag` areas:

- The title-bar free space and all four edge strips are drag regions.
- Buttons, connection controls, popovers, dialogs, upload controls, crop controls,
  status buttons, and scrollable lists are `no-drag`.
- Keep `.titlebar` itself `no-drag`; its expanding `.brand` child owns the native
  drag region and the sibling `.window-actions` remains `no-drag`. Making the
  whole title bar draggable can swallow every action-button click while unlocked.
- Keep the collapse control in the connection strip's ordinary `no-drag`
  interaction area. The Windows title hit-test path is not reliable enough for
  this mode-changing action while the card is movable.
- When position is locked, every full-card drag region must be disabled together.
  The floating orb remains movable so it can always be repositioned.
- Crop, history, and Token analytics views must keep native drag access through
  their free heading space and all four edge strips; their close and content
  controls remain `no-drag`.
- The floating orb's whole 76 × 76 surface starts one Windows native system-move
  command through the narrow preload bridge. When that command returns, unchanged
  native bounds restore the card and changed bounds retain the moved orb.
- Collapse and expand share the collapse button's measured screen anchor.
  Moving the orb changes where the full card is restored.
- The orb uses the existing application icon and must have no `no-drag` hole.
- Lock controls window movement only. It is not the always-on-top setting.
- Outside the explicitly bounded orb gesture above, do not implement
  pointer/mouse move loops that call `setBounds`, `setPosition`, or continually
  calculate cursor deltas.
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
10. The visual card collapsed toward the window corner, then jumped sideways to
    an orb because the animation and native bounds change used different anchors.
11. Any separate restore hotspot inside the orb made “drag anywhere” false.
12. Resizing the live renderer during collapse or expand caused flashing,
    stuttering, and hard positional jumps. Keep one fixed 460 × 690 window and
    change only its native shape.
13. Snapshot transition overlays repeatedly caused click stalls, DWM flashes,
    missed completion events, stale loading screenshots, and unclickable frames.
    The overlay, capture pipeline, and transition renderer are retired.
14. DOM-derived collapse anchors may contain fractional coordinates, which blur
    the orb icon and misalign native clipping. Round the anchor and final window
    positions, and always clear the mode-change guard in a `finally` block so one
    failure cannot permanently disable collapse.
15. Keeping two live windows visible, hiding/showing them, using native opacity
    zero, and parking one offscreen all proved unreliable: Windows can recycle or
    remount transparent surfaces and restore focus/z-order unexpectedly.
16. Polling the cursor and calling `setPosition` every animation frame makes the
    orb trail the pointer and then jump. Start one Windows system-move command and
    compare the native bounds after it returns; never drive orb movement from a
    JavaScript timer.
17. Same-level `moveTop()` calls are not a reliable Windows z-order contract and
    can leave the disabled full card above the orb. Do not use z-order swapping
    as mode state.
18. An opaque shaped orb produced a visible black 76 × 76 square on affected
    Windows systems. Keep the orb and native window transparent, hide the full
    card while collapsed, and load the orb before enabling the collapse control.
19. A visually ambitious cross-window animation is not worth blocking the mode
    switch. Do not reintroduce `capturePage`, transition IPC, animation waits, or
    a third BrowserWindow without a native-compositor design and explicit user
    approval.
20. Multiple monitor processes can leave an old orb and a new full card visible
    simultaneously, producing apparent flicker and stale behavior. Hold Electron's
    single-instance lock for the whole app lifetime. A second launch restores the
    existing instance instead of creating another window set.
21. Electron drag regions intentionally ignore renderer pointer events. A center
    `no-drag` expand control made dragging depend on where the user pressed, while
    hooked non-client messages failed to deliver reliable click release events on
    the transparent shaped window. Keep the whole orb `no-drag`, capture one
    renderer `pointerdown`, and immediately hand movement to Windows with
    `ReleaseCapture` plus the synchronous
    `SendMessage(WM_SYSCOMMAND, SC_MOVE | HTCAPTION)` modal move loop. Sending a
    synthetic `WM_NCLBUTTONDOWN` is not sufficient because Chromium can consume
    it and return before movement begins. Electron's native handle Buffer stores
    the HWND value; decode that value before passing it to Koffi and validate it
    with `IsWindow` rather than passing the Buffer's memory address. Do not use
    focus heuristics, delayed click timers, or JavaScript movement loops.
22. Register the full card's `ready-to-show` listener before calling `loadFile`.
    Fast local loads can otherwise emit the event first and leave a healthy
    process with both live windows hidden.
23. Some transparent-window starts may never emit `ready-to-show` despite a
    successful renderer load. Use one idempotent initial-show function from both
    `ready-to-show` and `webContents.did-finish-load`.
24. Even an animation-free show/hide swap between two transparent BrowserWindows
    can flash because DWM remounts a surface. Orb mode therefore uses `setShape`
    on the existing full-size window and a pre-rendered in-page orb; mode changes
    must not call native show/hide or switch compositor surfaces.
25. Focus is not a click signal. Expanding on focus makes the orb open as soon as
    the user presses it to drag, while blur/focusability toggles add latency. Keep
    focus stable and classify native down/move/up for both lock states.
26. A stale single-instance process can make every source restart appear to have
    failed. Before manual verification, confirm the root Electron PID and creation
    time changed; do not trust a launch command alone.
27. A circular `setShape()` boundary exposes Windows' integer scanline aliasing,
    and overscanning it exposes pieces of the full card beneath the orb. Use a
    76 × 76 rectangular native region, hide the full card while collapsed, and
    let the clipped CSS orb provide the only visible antialiased circle.
28. Persistent data states must not reuse hover-like card backgrounds. Official
    reset history is conveyed by copy and its positive status icon; hover styling
    only appears while the pointer is actually over the card.
29. `opacity: 0` and `pointer-events: none` do not disable an Electron native drag
    region. The hidden orb must be explicitly `no-drag` in full-card mode, then
    become `drag` only in collapsed mode; otherwise it silently covers part of
    the language and connection controls.
30. A hidden center `no-drag` control made the orb appear to fail randomly: center
    presses could not move it while edge presses could. The expand control may
    remain for keyboard accessibility, but in collapsed mode its whole surface is
    part of the native drag region and has no pointer hit target.

Do not call a dragging change complete from static inspection. Manually verify:

- unlocked title drag;
- unlocked top, right, bottom, and left edge drag;
- smooth continuous movement for several seconds;
- unchanged 460 × 690 bounds throughout full-card movement;
- locked title and edge behavior;
- immediate clipping to a 76 × 76 visible orb, smooth unlocked orb drag, click
  restore, and unchanged 460 × 690 native bounds throughout;
- locked orb behavior and restoration while locked;
- controls near each edge remain clickable;
- hide to tray, single-click restore, release the mouse, then use other controls;
- no cursor capture, sticking, resize cursor, jitter, lag, or outer ring.

## Layout and readability invariants

- The two quota panels are equal-width cards in one left/right row.
- The three status cards are one row immediately below the quota row, ordered:
  new reset credit, official reset, Codex client update.
- The reset-credit section is last, above the footer.
- The compact Token overview sits between the three status cards and the final
  reset-credit section; selecting it opens the full chart dialog.
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
- Secondary dialogs must remain translucent enough for the user's custom
  background to stay visibly continuous behind them.

### Reset-list capacity

- Show each returned credit as its own row.
- One through six rows must fit without moving the window boundary.
- Reset rows use a compact fixed height and must never stretch vertically just
  because only one or two credits are available.
- More than six rows must scroll inside the reset list.
- Large counts must not stretch the card, overlap the footer, or squeeze the quota
  and status rows.
- If the service returns a total count but temporarily omits some details, render
  the known rows plus one localized missing-details row.
- The Token overview and reset section share a fixed vertical budget: unused
  reset-list height expands the Token trend area, while up to six reset rows take
  back only the space they need.

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

## Token usage analytics

- Read account usage only through the local app-server `account/usage/read`
  request with protocol `params: null`.
- Use `summary.lifetimeTokens` as the cumulative account total and
  `summary.currentStreakDays` as the current consecutive-work-day value. Do not
  infer either value from local conversations or quota percentages.
- Normalize `dailyUsageBuckets` by validated `YYYY-MM-DD` dates and non-negative
  integer Token counts. Treat the response as untrusted input.
- Daily aggregation fills missing dates with zero. Weekly aggregation starts on
  Monday. Monthly aggregation uses calendar months.
- The day/week/month chart switch must animate and remain keyboard accessible.
- A Token usage endpoint failure must not make an otherwise successful quota read
  appear offline. Preserve and clearly identify the last normalized Token usage
  snapshot instead.
- Expose only normalized summary numbers and dated Token buckets to the renderer.
  Never expose raw account responses, authentication data, prompts, conversation
  content, or unrelated thread metadata.

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
- The last normalized Token usage summary and daily buckets are also stored in
  `quota-state.json` for temporary endpoint failures.
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
- account lifetime Token and streak normalization, cached fallback, and
  day/week/month aggregation;
- crop containment, movement, resize, ratio, and source-to-output mapping;
- side-by-side quota cards, three-card status row, reset section ordering;
- bilingual key parity and dynamic accessibility labels;
- development-file package exclusion.

For UI or main-window changes, also run a full-card and floating-orb
visual/manual matrix:

- Chinese and English;
- online and offline;
- 5-hour present and paused;
- zero credits, one credit, six credits, and more than six credits;
- no official history and multiple history records;
- current client, update ready, and update installed;
- Token data available/unavailable, day/week/month chart modes, and chart dialog
  transitions in Chinese and English;
- default background and light/dark custom backgrounds;
- background popover, crop dialog, and reset-history dialog;
- unlocked/locked title and four-edge movement;
- instant collapse/restore, plus unlocked/locked orb movement;
- hide and single-click restore from tray.

Verify:

- no overflow beyond the active 460 × 690 or 76 × 76 boundary;
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
