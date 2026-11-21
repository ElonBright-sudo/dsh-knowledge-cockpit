# Knowledge cockpit for DeepSeek Harness

A live dashboard for a local Markdown knowledge base, inside the DSH Web GUI: one sidebar row opens one page that answers — how much do I have, where does it live, what grew recently, and what is structurally missing.

It reads your disk, never the network. No model calls, no telemetry.

## What it shows

- **Six counters** — notes, files on disk, topics, added this month, active topics, structural gaps.
- **Distribution** — a ring of every topic by note count, with a full-name legend beside it.
- **Growth** — the last 6 months of new notes as an area line, with peak / six-month total / month-to-date underneath.
- **Recently updated** — the 10 most recent notes, each with its topic colour.
- **Topics** — every top-level folder with note count, size, last update, and whether it has `index.md` / `项目记忆.md`.
- **Insights** — where this month's notes landed, attachments vs markdown, stale notes, structure gaps.
- **Structure health** — index / memory / monthly-activity coverage plus an overall score.
- **To-dos you can act on**:
  - *Structure gaps* → **Generate all** writes the missing `index.md` / `项目记忆.md` scaffolds (or expand and pick one topic). Undo is offered right after.
  - *Maintenance* (stale notes, attachment size) → **Dismiss** until the number changes.

## Install

Through the app: **Plugins → Discover**, search `dsh-knowledge-cockpit`, install, then refresh the page.

Or from a terminal:

```sh
dsh plugin --profile <your-profile> add dsh-knowledge-cockpit
```

After installing, one row named **Knowledge cockpit** appears in the sidebar panel list (gauge icon).

## Configure

Defaults work if your vault is at `~/知识库`. Otherwise set `root` in your own profile patch (it survives upgrades):

```yaml
- id: ui-knowledge-cockpit
  name: 'dsh-knowledge-cockpit'
  config:
    root: /absolute/path/to/your/vault   # 要扫描的知识库根目录
    cacheTtlMs: 60000                    # result cache; 0 = rescan on every request
    staleDays: 60                        # "stale" threshold in days
    recentCount: 10                      # rows in Recently updated
    monthWindow: 6                       # months in the growth chart
```

## What it writes (and what it does not)

The only writes are the ones you trigger from the to-do card, and they are deliberately narrow:

- only two file names — `index.md` and `项目记忆.md`;
- only inside topic folders that do not already have them (`wx` create, existing files are never touched);
- the generated files carry an invisible `<!-- knowledge-cockpit:generated -->` marker, and **Undo** deletes only files that still carry it and that you have not edited;
- nothing else on disk is created, modified or deleted.

Everything else is read-only.

## How the numbers are counted

- Counts and sizes: measured on disk, skipping `.obsidian`, `.git`, `.trash`, `node_modules`, `__pycache__` and other dot-folders; symlinks are not followed.
- Additions and the growth trend: bucketed by file mtime.
- Structure coverage: whether `index.md` / `项目记忆.md` exists at the top of each topic folder. The score is the average of three coverage ratios — coverage, not content quality.
- The page footer repeats this, so a reader never has to trust a number blindly.

## Data routes

Loopback (or a paired device) only.

- `GET /api/knowledge-cockpit/data` — everything the page needs. Add `?refresh=1` to bypass the cache.
- `POST /api/knowledge-cockpit/fix` — `{ "kind": "index" | "memory", "topic"?: "name" }`; creates missing scaffolds, returns `created[].rel`.
- `POST /api/knowledge-cockpit/undo` — `{ "paths": ["Topic/index.md"] }`; deletes scaffolds created by this plugin that still carry the marker.

A cold scan of a few thousand notes takes a few tens of milliseconds; the result is cached for `cacheTtlMs`.

## Colours

The page uses host theme tokens for surfaces and text, so light/dark and third-party skins carry over. Two fixed accents sit on top: violet for data (`#6d3fc2` / `#7c3aed`) and gold for structure (`#b8862f` / `#d19a24`). Change four lines at the top of `client.js` to re-skin it.

## Limits

- One vault per install; point `root` at it.
- Markdown only for the note counts; other files count toward size.
- Redraws on open; there is no background watcher, so an open page shows the numbers from when it loaded until you rescan.

## License

MIT.

---

# 知识驾驶舱（中文）

给本地 Markdown 知识库做的一页实时仪表盘，装在 DSH Web 界面里：侧边栏多一行，点开就是「存了多少、长在哪、最近在长什么、结构缺什么」。

只读本地磁盘，不联网、不调用模型。

## 它显示什么

- **六张指标卡**：知识资产 / 资料文件 / 专题 / 本月新增 / 本月活跃 / 待补结构。
- **知识分布**：全部专题按篇数的环图 + 单列图例（名字完整可读）。
- **知识增长趋势**：近 6 个月新增的面积折线，下方钉着峰值月 / 六个月合计 / 当月至今日。
- **最近更新**：最新 10 篇，前面一个圆点标出所属专题的颜色。
- **专题概况**：全部顶层专题的篇数、体积、最近更新，以及 `index.md` / `项目记忆.md` 是否齐备。
- **知识智能洞察**：本月新增落在哪、附件与 md 的比例、久未更新、结构缺口。
- **结构体检**：索引 / 记忆 / 本月活跃三项覆盖率与综合分。
- **可动手的待办**：结构缺口可「全部生成」骨架（或展开按单个专题生成），生成后可撤销；维护项可「忽略」，数字变了会自己回来。

## 安装

应用里：**插件 → 发现**，搜索 `dsh-knowledge-cockpit` 安装，然后刷新页面。或者命令行：

```sh
dsh plugin --profile <你的 profile> add dsh-knowledge-cockpit
```

装好后侧边栏面板里多一行 **知识驾驶舱**（仪表盘图标）。

## 配置

默认扫 `~/知识库`；不在那里就在自己的 profile patch 里改（升级不会丢）：

```yaml
- id: ui-knowledge-cockpit
  name: 'dsh-knowledge-cockpit'
  config:
    root: /你的/知识库路径
```

其余参数见上面的英文段。

## 会写什么

只在你点「生成」时写，且范围很窄：只写 `index.md` / `项目记忆.md` 两个文件名，只写进缺它们的专题目录（已存在的一律不碰），生成的文件带不可见标记，撤销只删还带标记、且没被你改过的文件。除此之外全是只读。

## 统计口径

文件数与体积按磁盘实测（跳过 `.obsidian`、`.git`、`node_modules` 等）；新增与趋势按 mtime 分月；结构覆盖只看顶层专题目录下有没有那两个文件。分数是覆盖率平均，不是内容质量。页脚也写了一遍。

## 许可

MIT。
