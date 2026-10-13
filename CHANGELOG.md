# Changelog / 更新日志

## 尚未发布 / Unreleased

### 中文

- 重置概率卡片优先显示检查站的 Tibo 承诺概率，明确目标时间时展示倒计时和金色“即将重置”提示。时间未定、等待确认、源数据过期及已确认重置分别处理，不将承诺写入已完成公告历史。
- 概率详情重构为独立看板：承诺状态、目标窗口、历史 24/48 小时概率及区间、样本与间隔统计、来源和检查时间。移除与重置管理重复的公告列表；倒计时仅更新变化文字，隐藏窗口时停止绘制。
- 客户端升级历史按月份折叠、按日期分组，突出版本与时间并保留展开状态。修复版本基线已更新但历史仍落后的漏记情况，补记采用发现时间。版本检查缓存缩短至一分钟，手动刷新可重新读取；缓存不变的更新日志，优先识别 Codex 包。
- 修复小样本导致周额度预测错误显示 0% 的问题。原计算把五小时额度变化 2 个百分点、周额度变化 1 个百分点直接外推，放大了整数读数跨越边界的误差。
- 预测现在要求同一窗口内五小时、周额度至少分别变化 10、2 个百分点，并计算读数误差下的剩余范围。范围超过 10 个百分点，或范围仍允许剩余额度却估算为 0% 时，隐藏刻线并说明原因。等待期间保留样本，提示展示已观察增量及可用的误差范围。

### English

- Prioritize the checkpoint's Tibo commitment probability on the reset card, with a countdown and gold “Reset soon” state when an explicit target exists. Distinguish unspecified timing, awaiting confirmation, stale sources and confirmed resets; promises never enter completed-reset history.
- Rebuild odds details as a forecast dashboard: commitment state, announced window, historical 24/48-hour probabilities and ranges, interval statistics, sources and check times. Remove the duplicated announcement list. Update only changed clock text and stop painting hidden windows.
- Group client upgrades by month/date with preserved expansion state. Repair timelines left behind an already advanced version baseline, using recovery time. Shorten version caching to one minute, allow manual revalidation, cache unchanged updater logs and prefer the Codex package.
- Fixed small samples incorrectly predicting 0% weekly quota remaining. Extrapolating a two-point 5-hour change and a one-point weekly change magnified the error of rounded percentages crossing a boundary.
- Estimates now require at least 10 and 2 percentage points of observed 5-hour and weekly change within the same window, with bounds for percentage resolution. Hide the marker when the range exceeds 10 points or still permits remaining quota despite a zero estimate. Retain samples while waiting and explain observed deltas and available bounds in the tooltip.

## 1.3.41 补丁 / Patch — 2026-10-13

### 中文

**错误来源**：1.3.4 按完全相等的恢复时间戳判断额度窗口。实际同一窗口的时间戳会前后变化 1 秒，采样基线因此反复被清空，预测经常停留在“采样中”。重置日历为了让全年格子同时显示，把点击区域压到了 6 像素。

**修复情况**

- 对原始采样窗口使用有界的 5 秒时间戳容差，保留微小波动下的样本。真正换窗口、额度回升或原始窗口到期时仍重新采样；不允许连续漂移扩大容差。
- 周额度读数尚未变化时显示“等待周额度变化”，提示中列出两种额度的已观察增量。百分比读数可能暂时无法显示小额消耗，不把它算作零消耗。
- 格子放大到 12 像素，间距增至 3 像素，全年记录在内部横向滚动。年份和键盘选择会定位到所选格子；详情、原始记录和来源保留。

### English

**Cause**: 1.3.4 required identical recovery timestamps to recognize the same quota window. One-second variations in actual responses repeatedly cleared the sampling anchor, leaving the estimate collecting samples. Fitting a full calendar year into one view also reduced day targets to six pixels.

**Fixes**

- Preserve samples through timestamp jitter with a bounded five-second tolerance against the original anchor. Real window changes, counter decreases and an expired anchor still restart sampling; successive shifts cannot extend the tolerance.
- Show “Awaiting weekly data” while the weekly percentage remains unchanged, with observed consumption deltas in the tooltip. Rounded percentages may hide small changes temporarily; no zero-consumption ratio is invented.
- Increase day cells to 12 pixels with three-pixel gaps and internal horizontal scrolling. Year and keyboard selection keep the selected cell visible. Details, original records and sources remain available.

## 1.3.4 — 2026-10-13

### 中文

- 周额度条新增预测刻线和预计剩余比例。根据同一轮 5 小时窗口内两种额度的消耗增量，估算用尽本轮 5 小时额度后的周额度余额。采样不足、窗口切换、额度回升或周额度提前恢复时隐藏预测；提示中说明计算依据和比例假设。
- 官方重置公告、收到的可储存重置次数、消耗记录改为全年日历格子。按天聚合，颜色深浅表示次数；可切换历史年份，点击查看时间、额度类型、余额变化和公告来源。
- 保留原有历史数据和可用重置列表。日历缓存相同数据，详情按需分批显示；历史区可滚动，六条可用记录存在时关闭按钮仍可达。

### English

- Added a weekly-quota marker and estimated remaining percentage after exhausting the current 5-hour quota, based on observed consumption deltas within the same window. Insufficient samples, window changes, counter decreases and an earlier weekly renewal suppress the estimate. The tooltip explains its inputs and constant-ratio assumption.
- Replaced official announcements and received/consumed banked-reset history with yearly calendar grids. Daily color intensity represents reset counts; year selection and day details retain timestamps, credit types, balance changes and source links.
- Retained existing history and available-credit details. Unchanged calendars are cached and day details load in batches. History scrolls within the dialog, keeping the close control reachable with six available credits.

## 1.3.3 紧急补丁 / Emergency patch — 2026-10-11

### 中文

**建议 1.3.2 及更早版本用户升级。** 修复升级重启后 API 等价金额下降、任务累计耗时异常增加的问题。

**错误来源**：状态写入器能保存超过 4 MiB 的账本，启动读取器却拒绝这些文件，连同有效归档一起跳过，导致历史统计从头扫描。任务扫描器又提前使用旧会话回放的 `final_answer` 时间戳计算耗时，把回放前的数天间隔计入任务，忽略了随后提供的正确完成耗时。这些问题在 1.3.2 重启后暴露；该版本没有调整模型价格。

**修复情况**

- 状态读写统一采用 64 MiB 上限，超限写入保留原文件；有效的大账本可从不可变归档恢复。
- 恢复任务账本时识别原有数据代次，排除状态丢失后错误重扫产生的累计值，同时保留重置和客户端更新历史。
- 优先使用明确的完成耗时。缺少完成耗时的回放记录标记为耗时未知，不再把回放时间算成工作时间。
- 逐份合并归档，缓存校验结果并限制每次额外校验数量，避免把全部大账本同时载入内存或在每次写入时重复解析。

恢复保留已经扫描的旧会话数值，增量读取后续追加记录。完整会话重扫仍由用户手动启动。恢复范围取决于本机保留的有效账本及归档，缺失的历史不能凭空补齐。

### English

**Recommended for users of 1.3.2 and earlier.** Fixed API-equivalent cost falling after an upgrade restart and cumulative task duration increasing unexpectedly.

**Cause**: The writer could save ledgers above 4 MiB, but the startup reader rejected both those files and their valid archives, restarting historical scans. The task scanner also used a replayed `final_answer` timestamp before reading the explicit completion duration, counting days between original execution and replay as work. These defects surfaced after the 1.3.2 restart; that release did not change model prices.

**Fixes**

- Apply the same 64 MiB bound to state reads and writes. Oversized writes preserve the previous file, and valid large ledgers can be recovered from immutable archives.
- Recover task records from the intact ledger generation, excluding totals produced by the erroneous reset scan while retaining reset and client-update history.
- Prefer explicit completion durations. Replayed records without reliable duration evidence remain untimed.
- Merge archives individually, cache validation results and bound additional retention checks to avoid loading every large ledger simultaneously or repeatedly parsing them on each write.

Previously indexed sessions retain their recorded numbers. Subsequent appends are read incrementally; a complete rescan remains a manual action. Recovery depends on valid local ledgers and retained archives; missing history cannot be reconstructed without evidence.

## 1.3.2 补丁 / Patch — 2026-10-11

### 中文

修复“官方重置”停留在旧公告的问题，建议 1.3.1 及更早版本升级。

**错误来源**：检查站的实时公告使用 `confirmed: true`，同时保留 `confidence: medium` 和待核验标记。旧解析器只接受高置信度归档或另一种验证标记，误过滤了已经明确确认的新公告。手动刷新还会命中一分钟缓存；公告显示与额度、消费读取绑定，也可能被慢请求延后。

**修复情况**

- 兼容实时公告的明确确认字段，继续排除未确认记录、预告、重置卡赠送及不安全来源链接。
- 手动刷新重新校验网站数据，自动请求也向 HTTP 缓存发起校验。合并进行中的请求，增加五秒防连点保护。
- 重置公告和 24 / 48 小时概率读取完成后立即同步，不再等待额度和本地统计；旧整页快照不能覆盖较新的检查站数据。
- 保留历史公告及现有设置、统计。断网或来源失败时沿用历史记录，不恢复本机推断的重置。

来源目前通过定时检查同步，自动检查最长约一分钟，另加网站自身更新及网络延迟；不提供网站推送或逐秒刷新。

### English

Fixed the official-reset card retaining an older announcement. Recommended for 1.3.1 and earlier users.

**Cause**: Live checkpoint records use `confirmed: true` while retaining `confidence: medium` and a pending verification flag. The old parser required high-confidence archive records or a different verification flag, discarding explicit new confirmations. Manual refresh also reused a one-minute cache, and slow quota or cost reads could delay announcement display.

**Fixes**

- Accept explicit live confirmations while excluding unconfirmed records, previews, banked grants and unsafe source links.
- Revalidate website data on manual refresh and ask HTTP caches to revalidate automatic requests. Coalesce in-flight reads and apply a five-second manual request guard.
- Publish reset announcements and 24/48-hour odds as soon as their read completes. Quota and local statistics no longer delay them, and older full snapshots cannot overwrite newer checkpoint observations.
- Retain announcement history, settings and recorded statistics through source failures. Retired local reset inference stays excluded.

Sources are checked periodically, with up to roughly one minute between automatic checks plus source and network delay. This is not website push delivery or per-second polling.

## 1.3.1 紧急补丁 / Emergency patch — 2026-10-10

### 中文

**建议 1.3.0 用户升级。** 此补丁修复任务漏报和实时看板停住的问题，保留现有统计、背景和设置。

**错误来源**

1. 任务读取器直接把旧 `/goal` 的非活动状态用于当前回合。目标因暂停、阻塞或达到限额而停止后，新手动回合及仍在运行的子智能体也可能被排除，导致任务列表和运行计数显示为 0。
2. 看板把运行中和已完成回合混在一起按开始时间选取；渲染器又拒绝更早开始的回合。因此，一个较晚开始、已经完成的子任务会挡住仍在运行的主任务，使 Token 和速率看起来没有更新。
3. 日志缓存复用时只推进任务耗时，没有更新平均速率，导致等待期间平均值停留在旧读数。

**修复情况**

- 修复旧 `/goal` 的暂停、阻塞或限额状态隐藏新回合及运行中的子智能体的问题。目标状态与最新任务证据按时间比较。
- 最近任务看板优先显示运行中的回合；已完成的子任务不再挡住较早开始的主任务，新增 Token 计数在结束前更新。
- 右上角新增并发数，统计本机所有运行中的主任务和子智能体；提示中单列子智能体数量。不完整读取标为下限，读取失败显示不可用。
- 修复复用日志缓存时平均速率停住的问题。平均速率包含运行期间的等待时间；不会估算尚未写入日志的生成中 Tokens。

### English

**Recommended for 1.3.0 users.** This emergency patch restores live task detection and dashboard updates while retaining existing records, backgrounds and settings.

**Causes**

1. The reader applied a persisted inactive goal state to the current turn. After a goal was paused, blocked or limited, a new manual turn or a running subagent could be excluded, leaving the task list and running count at zero.
2. The dashboard selected from running and completed turns by start time, and the renderer rejected earlier-started turns. A later-started completed child could hide its still-running parent and leave the displayed counters unchanged.
3. Cached log windows advanced elapsed time without updating the whole-turn average rate, leaving that value unchanged during waits.

**Fixes**

- Fixed older paused, blocked or limited goals hiding new turns and running subagents. Goal transitions are compared with the latest task evidence.
- Prioritized running turns on the task dashboard. Completed children no longer hide an earlier-started live parent, and appended token counters update before completion.
- Added an upper-right count of all locally observed running tasks, with a separate subagent count in the tooltip. Partial counts are lower bounds; failed reads remain unavailable.
- Kept whole-turn average rates advancing when log counters are cached, including wait time. Unlogged in-flight tokens are not estimated.

## 1.3.0 — 2026-10-10

首个 1.3 正式版本，整合今天的界面、任务、用量和更新功能改动。

### 中文

**界面与交互**

- 三种额度融合为统一面板，与最近任务看板左右排列；额度面板占更大比例。
- 重置次数、可用重置卡及公开重置记录合并到重置管理入口，24 / 48 小时概率单独显示。
- 最近任务增加首字响应、总 Tokens、峰值 / 最低 / 平均输出速率和缓存命中率，任务执行期间同步更新。
- 任务详情采用数据管理布局，支持筛选、时间 / 时长 / 金额排序和一键确认已完成任务。
- 重新检查中英文文案，移除装饰性中点分隔，长项目名、模型名和累计时长支持换行或有明确滚动区域。
- 为卡片及按钮补充悬停、按下和键盘焦点反馈；金额、目标状态和异常状态使用不同颜色与字重。
- 调整重置列表容量，保证六条当前重置记录完整显示。
- 修复新增指标和英文换行撑高看板后，重置卡片遮挡 GPT Reserve 额度条的问题。

**额度、重置与计价**

- 接入 Codex Reset 和 Codex Reset Tracker 的公开检查站。恢复联网后可以补充公告记录，移除本机推断的非自然重置历史。
- 概率显示来源、更新时间及样本范围；优先采用检查站估计，历史估计作为注明限制的回退。过期或样本不足时显示数据不足。
- 修复 GPT Reserve 在普通额度接口未返回时无法读取的问题，支持独立官方 usage 桶及 SSE 返回格式；不从 Codex 主额度推算 Reserve。
- 增加 GPT-6.1 Sol 标准 API 等价计价，包含缓存输入和长上下文规则。未知或缺失历史定价仍明确标注。
- 修复新增定价后旧模型账本被丢弃的问题，恢复兼容历史记录，避免大会话被整文件大小限制跳过。
- 归档会话继续计入已记录总量。已扫描旧会话保留记录，新会话支持增量读取；用户可在 API 消费详情手动启动全量扫描。
- 全量重算保留旧值直到替代记录完成，进度持续显示；旧备份不能覆盖已经完成的重新核对。

**任务与实时同步**

- 识别 `/goal` 大目标、子智能体及多个模型参与的回合，分别显示目标累计 Tokens / 耗时和本轮各模型输入、缓存输入、输出及消费。
- 修复正常完成误报异常结束，支持现代完成事件及最终回答；短暂漏读需要后续证据确认。
- 目标内小任务及子智能体的受控停止不会判为异常终止，手动中断和真实异常仍单独显示。
- 移除固定一秒刷新，以本地文件事件和服务状态变化触发同步，合并密集事件并保留低频恢复检查。
- 历史处理移至后台工作线程，采用分批读取、缓存、资源上限和自适应间隔，减少对设备的持续负担。
- 避免只读 SQLite 共享内存变化触发自身重复刷新，修复 Windows 日志修改时间滞后带来的错误任务状态。

**更新与发布**

- 自动从固定 GitHub 仓库检查并下载监测台更新；正式版本排除测试版本，禁止降级。
- 安装版接入 Electron 更新器；便携版校验 GitHub SHA-256、下载大小及安装前摘要，再以隐藏助手替换并重启，保留旧程序用于回退。
- 下载就绪后等待已观测任务空闲，也可手动重启更新。监测台重启不会停止 Codex 或它的任务。
- 发布 Windows x64 便携版、安装版、安装增量文件、自动更新元数据及 SHA-256 校验清单。
- README 与更新日志改为中英双语，说明指标来源、适用范围和升级行为。

**升级说明**

从旧版本手动安装 1.3.0，即可启用后续自动更新。已有本地数据会保留。历史记录缺少定价信息时会显示待重算，可按需使用“全量扫描全部会话”。模型明细仍是本地覆盖范围内的估计，官方累计 Tokens 使用账户统计。

### English

**Interface and interaction**

- Combined the three quota bars in one panel beside the latest-task dashboard, with more space for quota.
- Unified reset credits and public reset history under reset management. The 24 / 48-hour estimate has its own card.
- Added live first-token latency, total tokens, peak/minimum/average output rates and cache hit rate to the latest task.
- Reorganized task details with filtering, time/duration/cost sorting and one action to confirm completed tasks.
- Revised Chinese and English copy, removed decorative middle-dot separators and added wrapping or bounded scrolling for long names and durations.
- Added hover, pressed and keyboard-focus feedback. Costs, goal status and interruptions use distinct emphasis.
- Corrected the reset-list capacity so all six current credit rows remain visible.
- Fixed the reset row covering the GPT Reserve bar when added metrics or English wrapping expanded the dashboard.

**Quota, resets and pricing**

- Added public Codex Reset and Codex Reset Tracker checkpoints, including announcement recovery after reconnecting. Removed locally inferred non-natural reset history from this display.
- Added source, freshness and sample information to probabilities. Checkpoint estimates are preferred; historical estimates are a labeled fallback. Stale or insufficient data has no displayed probability.
- Fixed GPT Reserve reads when the ordinary quota response omits it, including independent official usage buckets and SSE. Reserve is never inferred from the main quota.
- Added standard GPT-6.1 Sol API-equivalent pricing, cached-input rates and long-context rules. Missing historical prices remain explicit.
- Fixed compatible model ledgers being discarded during a pricing update and large sessions being skipped by whole-file size limits.
- Retained recorded totals from archived sessions. Indexed historical records are reused; new records support incremental reads. Added a manual full-history scan in cost details.
- Kept previous values visible during a full rebuild, exposed progress and prevented old archives from restoring superseded totals.

**Tasks and live synchronization**

- Recognized goals, subagents and multi-model turns. Goal-wide tokens/time are shown separately from current-turn model input, cached input, output and cost.
- Fixed normal completions reported as abnormal, including modern completion/final-answer events and confirmation of temporary missing reads.
- Classified managed goal-step and subagent stops separately from abnormal interruptions; manual and real abnormal outcomes remain visible.
- Replaced fixed one-second refreshes with coalesced local/service events and low-frequency recovery checks.
- Moved historical work into bounded background passes with caching, resource limits and adaptive rest time.
- Prevented read-only SQLite shared-memory changes from triggering a refresh loop and corrected stale Windows file-time task decisions.

**Updates and release**

- Added automatic checks and downloads from the fixed GitHub repository. Stable builds exclude prereleases and never downgrade.
- Integrated Electron updates for installers. Portable updates verify GitHub SHA-256, size and the staged file before a hidden replacement/restart helper runs, preserving the previous executable for rollback.
- Deferred automatic installation until observed tasks are idle, with a manual restart/update action. Codex and its tasks keep running.
- Published Windows x64 portable/setup builds, setup blockmap, update metadata and a SHA-256 manifest.
- Reworked the README and changelog in both languages with metric scope and upgrade guidance.

**Upgrade notes**

Install 1.3.0 manually to enable future automatic updates. Existing local records are retained. Missing historical pricing may require the optional full-history scan. Model details remain estimates from local coverage; lifetime tokens still use official account statistics.

## Earlier releases / 历史版本

See [GitHub Releases](https://github.com/Nahida728/codex-quota-monitor/releases) for earlier version notes, including the 1.3.0 beta. / 早期版本及 1.3.0 测试版说明请查看 GitHub Releases。
