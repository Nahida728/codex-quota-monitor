# Changelog / 更新日志

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
