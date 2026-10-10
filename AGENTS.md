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
- Never add a negative-only `build.win.files` list: Windows platform patterns
  override the application allowlist and can accidentally package development
  files. Filter nested dependency README/AGENTS files in the bounded beforePack
  collector hook before ASAR integrity is calculated; retain dependency licenses.
- Normalize both Windows and POSIX separators when inspecting ASAR entry lists.
  Use native paths for ASAR extraction and compare packaged source bytes.
- `README.md`, `AGENTS.md`, tests, preview scripts, source-control metadata, logs,
  and temporary files must remain outside packaged apps.
- `test/packaging.test.js` protects this rule. After a release build, also inspect
  `app.asar` rather than trusting configuration alone.

## Product contract

The monitor must:

- Show the 5-hour quota, remaining percentage, and scheduled recovery.
- Show the weekly quota, remaining percentage, and scheduled recovery.
- Show the GPT Reserve weekly quota as a third compact bar when the independent
  `gpt-reserve` app-server bucket is present; never infer it from Codex usage.
- Handle the official special state in which the 5-hour window is not returned.
- Show every available reset credit, with localized type and its own expiry.
- Detect newly received reset credits without treating the first run as an event.
- Permanently retain newly received reset-credit history and expose it together
  with the current available-credit list in a clickable detail view.
- distinguish a user-consumed reset credit from an official remote reset.
- Permanently retain detected user-consumed reset-credit history and expose its
  count, observation time, and safely identifiable credit details in the reset
  detail view.
- Retain validated website reset announcements and show the latest on the card;
  never display or restore retired local inferred non-natural reset records.
- Detect both a Codex client update ready to install and a newly installed version.
- Permanently retain observed installed-version changes and expose them as a
  clickable client update timeline.
- Show the account lifetime Token total and cumulative days with recorded work.
- Show daily-average Tokens and daily-average API-equivalent cost using the same
  cumulative work-day denominator, without inventing calendar-day activity.
- Show an animated Token usage bar chart switchable between daily, weekly, and
  monthly aggregation.
- Make a recognized Codex subscription plan clickable and show cumulative work
  days, subscription expiry, and a live countdown to the next renewal.
- Estimate the standard API-equivalent USD cost of locally recorded Codex model
  calls and show model-level input, cached input, output, and cache-hit details.
- Show all currently active local Codex tasks, live elapsed time, and each
  project's API-equivalent cost in a clickable detail view.
- Retain a newly completed task in that detail view until the user confirms it
  or returns to Codex, and permanently retain the longest duration and highest
  single-task API-equivalent cost as monotonic records.
- Distinguish completed, manually interrupted, and abnormally interrupted tasks;
  stop their clocks at the last evidenced terminal point and alert once when an
  abnormal interruption is first observed.
- Permanently retain numeric task totals for count, elapsed time, estimated cost,
  outcome counts, averages, longest duration, and highest single-task cost.
- In secondary Token/task analytics only, put a clickable circular coverage
  marker beside every statistic whose source cannot fully cover all account
  activity. Do not add those markers to the main card. Its bilingual dialog must
  state the exact included population, exclusions, denominator, and current
  truncation or missing-duration limitation.
- Report Codex online only when the local app-server can reach the OpenAI service
  and return quota data.
- Show a localized red-glass connection dialog on the first offline detection of
  each app session, with client, sign-in, API-key mode, network, VPN, firewall,
  proxy, OpenAI-service, and timeout checks.
- Keep the breathing connection light clickable. It opens a green normal-status
  dialog while online and reopens the red diagnostic dialog while offline.
- Support complete Chinese and English UI.
- Support click-to-upload and drag-to-upload backgrounds, manual fixed-ratio
  cropping, and background opacity.
- Support native window movement, position lock, always-on-top, tray hide/show,
  manual refresh, event-driven synchronization and bounded low-frequency fallback checks.
- Support optional single-window top-edge docking: after an unlocked card is
  moved within a generous acquisition zone of a display's top edge, snap and
  retract the same fixed surface above that display, leave one small
  downward-arrow hit target, reveal on pointer approach, and allow the revealed
  card to be deliberately dragged away without polling the cursor. Use hysteresis:
  a docked card tolerates a substantially larger downward movement than an
  undocked card needs to acquire the top edge.
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
- `src/codex-cost-usage.js`
  - Reads only model and Token-count events from bounded local Codex rollouts,
    de-duplicates replayed counters, and calculates standard API-equivalent cost.
- `src/codex-active-tasks.js`
  - Identifies active turns from explicit lifecycle events and exposes only the
    project basename, elapsed time, normalized model usage, and estimated cost.
- `src/codex-window-focus.js`
  - Finds only a visible window owned by the installed OpenAI Codex Store
    package and brings it to the foreground for the completed-task handoff.
- `src/refresh-policy.js`
  - Pure active/idle refresh timing and lightweight task-probe wake-up policy.
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
  synchronization before applying a small native shape is allowed to prevent a
  stale full-card frame from being clipped into the orb or top-dock tab.
- Restore the full-card native region with `setShape([])`, the Electron reset
  operation. Do not substitute a nominal 460 × 690 custom region: Windows may
  retain that stale clipping region after rapid top-dock or orb transitions.
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
31. Top-dock reveal can emit synthetic move and pointer-leave events while the
    native window moves from its off-screen tab position. Ignore the internal
    move, do not re-run automatic retract for an already docked window, and
    refuse renderer retract requests while the pointer is within the restored
    full bounds or the reveal grace period is active.
32. Applying the top-tab native shape before its renderer frame has painted can
    remove the last visible and interactive pixels. Require a bounded two-frame
    renderer acknowledgement carrying the tab's measured bounds before clipping;
    add the native content-area inset instead of assuming the content and outer
    bounds share an origin. If acknowledgement fails, keep the full card visible.
    On reveal, move the still-clipped tab first, clear the native shape with
    `setShape([])`, and only then expose the full card.
33. On fractional Windows display scaling, repeated `setPosition()` calls around
    shaped-window transitions can accumulate native width and height rounding,
    moving the renderer tab away from its native region and progressively
    clipping the restored card. Every programmatic top-dock/show reposition must
    use one non-animated `setBounds()` call that reasserts 460 × 690. This is a
    bounded transition correction, never a pointer-driven movement loop.
34. A single small threshold for both top-dock acquisition and release makes the
    card detach on a tiny movement yet remain difficult to snap back. Keep
    separate hysteresis thresholds: acquire within 96 device-independent pixels,
    retain docking until moved more than 160 pixels down, and evaluate only after
    native movement settles. Do not clear dock state in the live `move` event.

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

- The three quotas share one compact glass surface with three columns and horizontal bars: 5-hour,
  weekly and GPT Reserve. An unavailable Reserve bucket stays explicitly unavailable.
- The three status cards immediately below it are reset management (available
  credits and official resets), independent 24/48-hour reset odds, and client update.
- The available-reset card is the entry point to a secondary detail view that
  shows current credit details, permanent newly received history, and permanent
  user-consumed history.
- The Token overview sits below the three status cards and opens the full chart
  dialog. The active-task card occupies the final content area below it and opens
  a scrollable concurrent-task detail view.
- Between quotas and status cards, show a compact latest-completed-turn board
  with first-token latency, total tokens, peak/minimum/average output rates.
  First-token latency must come from `time_to_first_token_ms`, never an invented
  subtraction. Total tokens include input (already containing cached input) plus
  output. Peak/minimum are rates between timestamped token-counter records;
  whole-turn average includes tool/wait time. Label these as recorded intervals,
  not decoder throughput. De-duplicate replayed counters; counter rollback,
  uncovered output, missing timestamps or partial scans invalidate extrema.
  Missing fields remain unavailable; partial token totals are lower bounds.
  Disclose the bounded local population and exclusions in the task dialog.
- The active-task card uses its full height: one compact title row, then a
  left/right split. The left side is a 2 × 4 data table for running, pending,
  longest duration, highest cost, average duration, average cost, total tasks,
  and total elapsed time. The right side previews at most two running projects
  with model, elapsed time, and cost. Pending completed/interrupted rows live in
  the detail dialog rather than occupying the main-card preview. Additional
  running tasks use a localized “more” count and remain available in details.
- Keep only one refresh control: the refresh button in the connection strip.
  The removed top-left refresh button must not return.
- The footer and full-height active-task card remain unchanged in online and
  offline states. Offline guidance is an overlay dialog and must never be inserted
  into or squeeze the main layout.
- Default body text must be comfortably readable at 460 × 690. Do not reduce text
  merely to make a layout fit.
- English strings must wrap or reflow. Do not use `text-overflow: ellipsis` for
  status, quota, reset, update, or accessibility-critical copy.
- Check real English text, not only placeholder dashes.
- Keep the liquid-glass layers, translucency, blur, refraction, subtle borders,
  and readable contrast over both light and dark custom backgrounds.
- Secondary dialogs must remain translucent enough for the user's custom
  background to stay visibly continuous behind them.
- The task detail dialog may use nearly the full fixed window height. Give its
  eight summary cards enough height for unbroken metric labels and values; wrap
  only at word boundaries rather than splitting Chinese labels or English words.
- Secondary dialogs enter and exit through one interruptible renderer-only
  opacity/translate/scale state machine, including a bounded close fallback.
  Entrance content may stagger, but all motion must honor reduced motion. Do not
  resize, hide, or replace the native window to animate a dialog.

### Reset-list capacity

- Show each returned credit as its own row.
- Current credit details live in the reset-credit secondary dialog, not on the
  main card.
- One through six rows must fit inside that dialog without moving the window
  boundary.
- Reset rows use a compact fixed height and must never stretch vertically just
  because only one or two credits are available.
- More than six rows must scroll inside the reset list.
- Large counts must not stretch the window or squeeze the main quota and status
  rows.
- If the service returns a total count but temporarily omits some details, render
  the known rows plus one localized missing-details row.
- Newly received history has its own bounded scroll area in the same dialog so
  current details and the close action remain reachable.

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
- When an item ID is absent, use a deterministic fingerprint of normalized reset
  metadata so an unchanged credit is not repeatedly reported.
- A later unseen identity may create a new-credit event.
- The UI notice is retained for seven days.
- Persist the seen baseline in `quota-state.json`.
- Append detected grants to permanent `receivedResetHistory` with the observation
  time, count, and normalized credit details.
- Migrate the legacy `lastNewResetAt` and `lastNewResetCount` values into one
  permanent history entry without inventing unavailable item details.
- Display received history newest-first and do not clear it merely because a
  later quota read is offline.

### User manual resets

A user-triggered reset normally restores quota while consuming at least one
available reset credit. If the available count decreases across the same snapshots:

- require an early full-quota recovery pattern, complete before/after credit
  details, and exact stable identities for every disappeared credit;
- retain the first strongly evidenced decrease only as a pending candidate and
  require the next successful complete snapshot to keep every disappeared
  identity absent before classifying it as a manual reset;
- discard the candidate when the next successful snapshot rebounds above the
  candidate count, because transient incomplete/zero responses are not usage;
- preserve credit-consumption evidence across transient list omissions;
- show that it was excluded;
- never append it to official-reset history;
- do not let simultaneous quota recovery override the consumed-credit evidence.
- append one permanent `consumedResetHistory` record per unique credit identity,
  with the observation time,
  consumed count, before/after available counts, and exact missing credit details
  only when both item lists are complete;
- never record count-only decreases, incomplete credit lists, repeated
  disappearances of the same identity, or decreases without a matching early
  quota recovery; exclude complete comparisons when every disappeared credit
  reached its expiry;
- treat pre-evidence-version manual-reset records as invalid in recovery because
  older clients permanently recorded transient list omissions; immutable archive
  files may remain on disk, but those invalid entries must not re-enter the UI;
- preserve and reconcile that history across primary state and archive
  generations, and force an immutable archive when a new usage event is added.

### Official remote reset display

- User-requested contract for v1.3.0-beta: official reset display and history use
  only validated public website announcements. Do not append inferred account
  resets or expose legacy local inference history.
- Persist officialResetSource=community so archive reconciliation cannot restore
  retired local records. Keep immutable archive files and credit grant/consumption
  history intact. Local early-recovery comparisons are still needed solely to
  validate credit consumption; they must never produce official-reset records.
- Public announcements do not prove that this account reset. Keep links, source
  freshness, samples and experimental probability limitations visible.

### Community checkpoints and Reserve fallback (v1.3.0-beta)

- Read only pinned HTTPS public endpoints from codex-reset.com and the inert
  JSON data from codexresettracker.com, with timeouts and byte limits. Never
  evaluate remote scripts. Accept confirmed global resets only; exclude grants,
  previews and speculative feed labels. Validate official-source links.
- Community announcements are a separate permanent history, never reconstructed
  account-local resets. They remain available after offline periods and archive
  recovery. Show source freshness, retrieval time and population separately.
- Prefer the fresh checkpoint's experimental 24/48-hour forecast; disclose its
  sample size and experimental limitation. Historical median estimates are a
  labeled fallback. Hide probabilities after 24 hours without a source check or
  with fewer than three intervals. First fetch is not a new account reset.
- Reserve may be omitted by the CLI even with supportsLunaReserve. The main
  process may read the installed client's official usage route with existing
  ChatGPT authentication. Keep credentials exclusively inside the bounded reader;
  never return or persist identity fields, credentials or raw responses. Support
  SSE usage.snapshot and the ordinary usage route; throttle unsupported SSE.
- Only an independent exact gpt-reserve bucket supplies Reserve. A missing bucket
  stays unavailable; never substitute the main quota or synthesize a percentage.
- Recognize modern final_answer lifecycle evidence and whitespace in JSON lines.
  On Windows, NTFS mtime can remain stale while an open log is appended. Use
  the newest validated in-log timestamp together with mtime for inactivity;
  never mark a long running task abnormal from stale filesystem metadata alone.
  Collect preceding terminal turns even when a later turn starts between polls.
  A missing task needs two complete reads before an inferred terminal notice;
  truncated reads and rebounding tasks must never trigger that inference.
- Read only bounded goal status/budget counters from the read-only goals database,
  omitting objectives. Recognize session_meta subagent.thread_spawn and parent IDs.
  Managed goal steps have their own outcome counter and do not alert as abnormal.
  Retain actual manually interrupted and abnormal outcomes with terminal evidence.
- The task dialog supports context/status filtering, persistent sorting and one
  action confirming all completed rows. Confirming does not alter numeric records
  or dismiss running/interrupted rows. Verify controls and close buttons in both
  languages; movement/orb/window-size invariants remain mandatory.
- GPT-6.1 Sol pricing uses the official Standard card dated 2026-10-10:
  USD/million input 2, cached input 0.10, cache write 2.5, output 10; beyond
  272K input use 2x input classes and 1.5x output. Pricing-only changes must preserve compatible schema-6 and schema-7
  numeric ledgers. Missing historical prices show pending recalculation until a
  user-requested full scan; never discard recorded Tokens to add a price.

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
- Each later higher installed version appends one permanent timeline record with
  the previous version, new version, and the time this monitor first observed it.
- Migrate the legacy single installed-update record into the timeline, de-duplicate
  adjacent refreshes, and never create timeline entries for rollbacks.

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
- Use `summary.lifetimeTokens` as the cumulative account total. Derive cumulative
  work days deterministically from normalized non-zero `dailyUsageBuckets`; do
  not infer either value from local conversations or quota percentages.
- Normalize `dailyUsageBuckets` by validated `YYYY-MM-DD` dates and non-negative
  integer Token counts. Treat the response as untrusted input.
- Daily aggregation fills missing dates with zero. Weekly aggregation starts on
  Monday. Monthly aggregation uses calendar months.
- The day/week/month chart switch must animate and remain keyboard accessible.
- The full Token chart draws every statistical node. Hovering a node shows its
  localized day, week range, or month plus the exact Token count; the tooltip
  must stay inside the chart boundary.
- API-equivalent cost pricing must cover the current native Codex catalog and
  historical native Codex model IDs that can remain in rollout history:
  `codex-mini-latest`, GPT-5/Codex/Codex-Mini, GPT-5.1 and its Codex variants,
  GPT-5.2/Codex, GPT-5.3-Codex, GPT-5.4/mini, GPT-5.5/Cyber, and the GPT-5.6
  family. Match official dated snapshot suffixes without treating arbitrary
  provider suffixes as an OpenAI model.
- Include GPT-6 Sol and Luna standard rates. Treat `gpt-reserve`/`gptreverse`
  cost as a user-requested GPT-5.6 Luna equivalent, not a published Reserve
  API price.
- `codex-auto-review` uses the documented GPT-5.3-Codex code-review rate.
- Models without a published standard API-equivalent rate, including research
  previews and third-party providers, remain visibly unpriced rather than
  borrowing a similarly named model's price.
- Recognized Codex++ routes for DeepSeek, GLM, Qwen, MiniMax, and Kimi may use
  checked-in vendor prices. Match bounded family/version tokens through explicit
  regular expressions so safe provider prefixes and routing/date suffixes do not
  hide a known model; never use a bare substring or price an unknown variant.
- Codex++ reports third-party uncached input and cached input as disjoint counts.
  Add them for displayed total input and cost splitting, and do not calibrate
  recognized third-party usage against OpenAI account-usage buckets.
- A Token usage endpoint failure must not make an otherwise successful quota read
  appear offline. Preserve and clearly identify the last normalized Token usage
  snapshot instead.
- Expose only normalized summary numbers and dated Token buckets to the renderer.
  Never expose raw account responses, authentication data, prompts, conversation
  content, or unrelated thread metadata.
- `account/usage/read` does not expose a model breakdown. Model cost details come
  from a bounded scan of local Codex rollout JSONL files instead.
- Persist raw model aggregates by validated event date, then cap each day's local
  attributed-plus-unattributed input to that day's official account Token bucket
  before displaying model totals or calculating API-equivalent cost. Scale down
  local model/cache/output/call evidence proportionally for an overfull day;
  never scale local evidence up to fill an official gap, and show both removed
  replay Tokens and official Tokens without local model detail as coverage notes.
- In model-cost details, `inputTokens` is total request input and already includes
  cached input. Label cached input as a subset and never present the two columns
  as additive or comparable to the official account lifetime Token total.
- A Token-count event without a directly preceding valid model context is
  unattributed coverage, not an `unknown` model. Exclude it from model totals and
  estimated cost, retain only normalized aggregate coverage counts, and never
  guess its model from a later context.
- A genuinely incompatible counter schema may require a rebuild. Pricing-only
  changes are compatible and must retain recorded model Tokens. Schema 6 and 7
  share the same counter semantics and must reconcile without an automatic rebuild.
- Replay de-duplication spans the whole rollout file. A repeated complete
  cumulative-plus-last Token signature remains a duplicate across turn-context
  records; equal per-call usage with different cumulative counters remains a
  distinct call.
- Before parsing a rollout line, reject every record except `turn_context` and
  `event_msg` records tagged `token_count`. From accepted records retain only the
  normalized model slug and Token counters. Never retain or expose prompts,
  messages, tool payloads, workspace paths, thread titles, or rollout filenames.
- De-duplicate replayed `token_count` records by their cumulative and last-usage
  counters before aggregation. Ignore synthetic counter events with no input,
  output, or cache-write usage.
- Estimate cost with the checked-in, dated standard OpenAI API price table. Use
  uncached input, cached input, cache-write input, and output rates separately;
  apply documented long-context multipliers per call where applicable.
- The estimate is not a Codex subscription charge. Third-party and otherwise
  unpriced model slugs remain visible but do not contribute to the USD total;
  unattributed events are coverage rather than a model card, and the UI must make
  partial pricing explicit.
- Cache ordinary production cost recovery for 30 seconds and task-history recovery
  for 60 seconds; manual cost rebuilds use bounded background passes instead; reuse the last normalized
  persisted snapshot across restarts and temporary scan failures. Do not rescan
  multi-gigabyte rollout history on every change notification.
- Cost aggregation must include readable rollout files from both
  `.codex/sessions` and `.codex/archived_sessions`. Moving a session into the
  Codex archive must not lower the cumulative API-equivalent estimate.
- De-duplicate the same stable rollout identity across active and archived roots
  during move/copy transitions, preferring the more complete readable copy so a
  session is neither double-counted nor partially replaced.
- Treat the total-byte scan limit as a per-pass work budget, never as the
  cumulative population. Persist a privacy-safe hashed rollout index containing
  only normalized model counters and merge unfinished batches on later reads;
  sessions that leave the current filesystem inventory must not erase previously
  observed cumulative usage.
- Scope replay-counter signatures to one rollout. Equal cumulative/last counters
  in two distinct rollouts are distinct usage evidence and must not be globally
  de-duplicated.
- Reconcile API-equivalent snapshots within compatible cost-ledger schemas.
  Merge compatible hashed rollout entries across immutable archives, but never
  restore an incompatible aggregate or use it as a migration floor; rebuild it
  from readable rollout files so corrected de-duplication can lower bad totals.
- Treat each successful `account/usage/read` response as one authoritative
  account snapshot. Replace the cached Token summary and daily buckets together;
  never take historical maxima or merge dated buckets across snapshots because
  backend corrections, account changes, or scope changes can otherwise preserve
  an inflated total indefinitely. Use only the newest complete stored snapshot
  when the endpoint is unavailable.

### Subscription details

- The plan shown in the online connection strip is a keyboard-accessible,
  clickable entry to a bilingual subscription-detail dialog.
- Use normalized non-zero account usage days for “assisted development days”;
  do not substitute calendar age, conversation counts, or local file dates.
- The public app-server account and rate-limit methods do not expose subscription
  expiry. Read only the signed ID-token payload's plan and subscription
  start/end/check timestamps from the bounded local Codex auth file.
- Never expose, persist, or log the ID token, access token, refresh token, API
  key, email, account ID, user ID, or unrelated claims.
- Validate the auth file size, JWT structure, claim namespace, plan enum, and
  timestamps. API-key login and malformed or missing claims are unavailable
  states, not guessed subscriptions.
- When Codex still reports a paid plan but the signed claim contains the previous
  billing period, project the next renewal using that period's calendar-month
  cadence and label the displayed date as estimated.
- Keep the renewal countdown live to the second while its dialog is open.

### Active task monitoring

- A task is active only when the most recent explicit lifecycle event in its
  rollout is `task_started`; `task_complete` and `turn_aborted` exclude it
  immediately. Do not infer active work from file modification time alone.
- Classify an explicit `turn_aborted` with reason `interrupted` as a manual
  interruption. Classify an observed active task that disappears without either
  a normal completion or manual-interruption event as abnormal; an unfinished
  task moved into the archive or superseded by a new task is also abnormal.
- Use the terminal event's duration/end timestamp when present. If an active task
  disappears without a terminal event, freeze it at its last observed elapsed
  time; never add the next refresh interval or continue its renderer timer.
- If a rollout still ends in `task_started` but has produced no filesystem or
  event evidence for 15 minutes, classify it as abnormally interrupted and
  freeze it at the last timestamp in that rollout. This prevents abandoned or
  crashed sessions from remaining active forever without relying on modification
  time as the sole evidence that a task started.
- Show the red-glass abnormal-interruption dialog once per newly observed event.
  Both completed and interrupted handoffs remain in the pending area until the
  user confirms them or returns to Codex.
- Support multiple simultaneous active rollouts and keep their timers updating
  through a visible-only renderer paint clock, without fixed one-second data polling.
- Tail reads must remain bounded by file count, age, bytes per turn, total bytes,
  and task count. Expand a tail only until the last lifecycle event is found.
- From active rollouts expose only the validated turn ID, project directory
  basename, start time, normalized model Token totals, and estimated cost. Never
  expose the full workspace path, prompt, task title, message, or tool payload.
- Active-task snapshots remain volatile. When a previously observed active task
  disappears from a complete, non-truncated read, expose one bounded completion
  handoff entry without continuing its timer or treating it as running.
- A completion handoff remains in renderer memory until its `Return to Codex` or
  `Confirm` action is used. `Return to Codex` must foreground only the trusted
  installed Codex Store window; both actions remove the completed entry.
- Reconstruct aggregate task history from readable rollout lifecycle and
  Token-count records in both `.codex/sessions` and
  `.codex/archived_sessions`, de-duplicating the same rollout identity during
  move/copy transitions. This recovery may be bounded and must say so internally.
- Persist monotonic numeric records for total terminal task count, total elapsed
  time, total API-equivalent cost, completed/manual/abnormal counts, longest
  duration, and highest single-task cost. A bounded hashed-rollout index may
  retain only these per-rollout numeric aggregates so changing scan windows can
  be merged without double counting. Do not persist task IDs, project names,
  paths, models, or pending handoff entries.
- Exclude legacy completions that provide neither a duration nor a completion
  timestamp from total/average elapsed-time calculations; still include them in
  total task and outcome counts. Never turn replay delay into task duration.
- Reconcile those numeric records by maximum value across the primary state and
  archive generations so a reset or older state cannot lower them. A newly
  recovered aggregate or terminal task forces an immutable archive immediately.
- If the monitor is always-on-top, returning to Codex may temporarily yield that
  native level. Restore the saved always-on-top preference only when the monitor
  is focused or shown again.
- Use filesystem changes and app-server notifications for synchronization. Batch
  local events for 180 ms, serialize readers, adaptively yield after slow reads,
  and coalesce remote reads with a 3-second minimum gap. Official non-push fields
  use 30/60-second fallback checks; do not claim per-token streaming support.
- Parse local usage in one background worker with a 128 MiB old-space limit,
  64 MiB history scan batches, an 8 MiB compact tail cache, and bounded queues.
  Reuse unchanged files and read appended bytes; never retain conversation text
  in compact complete-record caches. Freeze partial telemetry rather than inventing
  speeds. Retry failed workers with backoff and terminate them on exit.
- Coalesce live record persistence to 30 seconds, flush on exit, and immediately
  archive terminal outcomes. Historical recovery remains explicitly partial until
  indexed. Do not rescan multi-gigabyte history on every file event.
- Windows SQLite read-only queries emit change events for goals_1.sqlite-shm.
  Never use shared-memory notifications to schedule another read: that creates
  an endless self-refresh loop. Watch only the database and WAL for Goal changes.
- The main-card and per-task elapsed time visually pulses only while at least one
  task is active. Respect the operating system's reduced-motion preference.

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

- The Chinese product and window title is `Codex监测台`; the English title
  remains `Codex Quota Monitor`.
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
- The last normalized model Token totals and API-equivalent cost snapshot are
  stored in `quota-state.json`; rollout paths and raw records are never stored.
- Active-task snapshots and completion handoff entries are not stored; only the
  numeric longest-duration and highest-cost records are persisted.
- Keep versioned, immutable quota-state archives in the adjacent
  `quota-state.json.archive` directory. Archive at least every 15 minutes while
  state writes continue and immediately whenever a permanent history or the
  seen-credit identity set changes.
- Write the primary state and every archive through a same-directory temporary
  file or exclusive archive creation, flush the file before rename, and never
  overwrite an existing archive generation.
- On startup, inspect the primary state, interrupted-write temporary files, and a
  bounded set of newest archives. Ignore corrupt generations, reconcile all
  permanent monotonic histories, and repair the primary automatically.
- A missing, unreadable, truncated, syntactically invalid, or valid-but-reset
  primary file must not erase richer website-announcement, received-reset, or
  client-update history held by an archive. These histories and seen identities
  may only grow.
- Recovery must not block legitimate changes to volatile state, including an
  installed-version rollback baseline, clearing a completed pending update, or
  dropping stale reset-credit details.
- Retention counts only validated archives. Corrupt files must never cause valid
  recovery generations to be pruned.
- Offline startup must still expose website announcements, received-reset,
  and client-update histories to the renderer.
- Cropped background is stored in the Electron user-data directory.
- Write sensitive local state with restrictive file permissions where supported.
- Never ask the user for an OpenAI API key.
- Authentication belongs to the local Codex app-server.
- Do not persist raw protocol responses or app-server stderr.
- Offline handling must distinguish at least not-installed, not-signed-in,
  timeout/network failure, and generic connection failure where evidence allows.
- The offline connection dialog must continue to mention mainland-China VPN and
  network checks in both languages. It may auto-open only once per app session:
  periodic refreshes, language redraws, and later online/offline flapping must not
  reset that eligibility. The red breathing light can always reopen it manually.
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
- permanent client-version timeline append, migration, de-duplication, and
  rollback exclusion;
- periodic immutable state archives, corrupt-primary recovery, corrupt-archive
  fallback, valid-but-reset primary repair, and permanent-history anti-rollback;
- account lifetime Token and cumulative-work-day normalization, cached fallback, and
  day/week/month aggregation;
- bounded subscription-claim extraction without credential leakage, stale monthly
  period projection, clickable plan details, and bilingual renewal countdown;
- local model usage de-duplication, cached-input rate, unknown-model handling,
  API-equivalent cost, long-context pricing, and persisted scan reuse;
- exact task lifecycle classification, one-shot completion handoff, both
  completion actions, concurrent active tasks, project-path sanitization,
  task-level cost isolation, and monotonic performance-record recovery;
- event coalescing, backpressure, worker recovery, and active/idle fallback checks;
- crop containment, movement, resize, ratio, and source-to-output mapping;
- three unified quota bars, the clickable reset entry in the three-card status
  row, reset-detail/history dialog, the connection-status dialog, and the reserved
  bottom area;
- one-shot automatic offline-dialog display per app session, no eligibility reset
  after connection flapping, manual reopening from the red breathing light, and
  the green normal-status dialog;
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
- empty and multi-entry client update timelines, including a pending target;
- Token data available/unavailable, day/week/month chart modes, and chart dialog
  transitions in Chinese and English;
- zero, one, and multiple active tasks; live timer pulse; completed-task actions;
  persistent longest/highest records; task detail scrolling;
- default background and light/dark custom backgrounds;
- background popover, crop dialog, and reset-history dialog;
- unlocked/locked title and four-edge movement;
- instant collapse/restore, plus unlocked/locked orb movement;
- enabled/disabled top docking, snap and retract on every display, arrow-hover
  reveal, repeated reveal/retract cycles without a missing tab, no immediate
  synthetic retraction, full hit testing after reveal, drag-away undocking, and
  interaction with position lock and orb mode;
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
   Padded display versions use valid SemVer internally: 1.3.51 in package/lock
   metadata, with displayVersion/buildVersion and filenames set to 1.3.051.
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


## Persistent model ledger and self-updates (1.3.0)

- Do not re-read already indexed legacy sessions automatically, even when their
  metadata changes. Preserve the numeric record and offer an explicit full scan.
  New resumable records read appended bytes only. Archive moves and missing files
  retain their recorded totals. File-count and byte limits are per-pass budgets.
- Stream large JSONL lines using a whitelist projector; store only model/type/
  timestamp metadata, numeric counters, UTF-8 pending bytes and hashed replay
  signatures. Unknown object keys and conversation strings must be discarded
  before a persisted chunk boundary. Never retain line fragments or tool bodies.
- A manual full scan covers both session roots and keeps committed records visible
  until each replacement reaches EOF. Its new generation may legitimately lower
  corrected totals; older archives must not resurrect the previous generation.
  Resume persisted work after restart. Coalesce worker requests and use bounded
  64 MiB passes with adaptive rest time; never parse history on the main thread.
- The larger three-quota panel and latest-task board share one left/right row.
  Set min-height: 0 on its grid children; wrapped telemetry must stay within
  the fixed row. Verify panel bounds and text bounds in both languages so the
  reset row cannot cover the Reserve progress bar when metrics are added.
  Latest-turn Tokens and interval telemetry update while running. Cache hit rate
  is cached input divided by input over observed calls, weighted across models;
  output is excluded and missing/zero input stays unavailable.
- Task details label goals and subagents, show the database's goal-wide numeric
  Tokens/time separately from current-turn elapsed time and model-level cost.
  Never expose the objective text or imply current-turn cost is lifetime goal cost.
- All UI copy is bilingual. Avoid decorative middle-dot strings. Wrap long names
  and durations or provide an explicit bounded scroll area. Check text bounds in
  every secondary view. Six reset rows require 188 px (6*28 + 5*4), not 186 px.
- Monitor self-updates use only Nahida728/codex-quota-monitor on GitHub. Stable
  installs exclude prereleases; beta installs can receive beta or stable upgrades.
  Never downgrade, accept draft releases, arbitrary URLs or asset-provided paths.
- NSIS uses electron-updater's verified update flow. Portable uses the exact x64
  asset and GitHub's SHA-256 digest, streamed size limits, a second pre-install
  hash check, and one hidden PowerShell handover copied outside ASAR. Paths come
  from the local bootstrap environment and user-data staging directory only.
- Replacing Electron binaries requires restarting the monitor. It must never stop
  Codex or its agents. Save state and position, wait for observed tasks to be idle
  before automatic installation, and allow an explicit restart/update action.
  Keep the previous portable executable for rollback and restore it on failed
  replacement/launch. Network failures must preserve an already verified update.
- Release asset names are ASCII and include the SemVer version. Publish latest.yml (beta.yml for beta channels)
  and the setup blockmap alongside the setup, portable, and SHA-256 manifest.
  Keep build.files as the src/package allowlist and inspect actual ASAR contents.
