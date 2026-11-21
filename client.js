/**
 * 知识驾驶舱 · 浏览器半边。
 *
 * 在侧边栏加一行「知识驾驶舱」，点开就是一页实时仪表盘：
 * 知识资产 / 分布 / 趋势 / 最近更新 / 专题覆盖 / 结构体检 / 待办。
 *
 * 数据来自宿主半边（./index.js）的 /api/knowledge-cockpit/data，
 * 这里只负责取数、排版与配色：容器和文字统一走 --dsw-alias-* 主题令牌
 * （跟随 DSH 明暗主题），只有图表的数据色是固定色板。
 */
window.__ModuleLoader__.load({
  id: 'dsh-knowledge-cockpit',
  factory(require) {
    const React = require('react');
    const { useCallback, useEffect, useMemo, useRef, useState } = React;
    const h = React.createElement;

    /** locale 命名空间与面板 id。 */
    const NS = 'dsh-knowledge-cockpit';
    const PANEL_ID = 'knowledge-cockpit';
    /** 宿主数据路由（挂在本机 GUI 同源下）。 */
    const API = '/api/knowledge-cockpit/data';

    /**
     * 数据色板：11 个色相分散、明度接近、饱和度克制的颜色，
     * 在浅色与深色主题下都能读出来，且整体偏暖——与金色主色同族。
     */
    const SERIES = [
      '#7048e8', '#3b5bdb', '#c2255c', '#0ca678', '#9c36b5', '#1c7ed6',
      '#e8590c', '#5f3dc4', '#d6336c', '#f59f00', '#12b886',
    ];
    /** 根层散落文件的颜色（不属于任何专题）。 */
    const LOOSE_COLOR = '#868e96';

    //#region 文案
    const zh = {
      nav: '知识驾驶舱',
      title: '我的知识驾驶舱',
      sub: '让每一份存下来的东西，都能被找回来、被用上',
      badge: '本地实时',
      refresh: '重新扫描',
      'refresh.doing': '扫描中',
      'refresh.hint': '强制重扫本地磁盘',
      'stamp.scanned': '数据时间 {time}',
      'stamp.root': '根目录 {path}',
      'stamp.cost': '本轮扫描 {ms} ms',
      'kpi.assets': '知识资产', 'kpi.assets.note': '篇 Markdown',
      'kpi.files': '资料文件', 'kpi.files.note': '磁盘实测',
      'kpi.topics': '专题', 'kpi.topics.note': '个顶层目录',
      'kpi.monthNew': '本月新增', 'kpi.monthNew.note': '篇（按 mtime）',
      'kpi.monthActive': '本月活跃', 'kpi.monthActive.note': '个专题有更新',
      'kpi.gaps': '待补结构', 'kpi.gaps.note': '项缺口',
      'dist.title': '知识分布', 'dist.note': '按专题 · 篇数占比',
      'donut.unit': '篇 md',
      'trend.title': '知识增长趋势', 'trend.note': '近 {n} 个月 · 按文件修改时间',
      'trend.unit': '篇',
      'trend.peak': '峰值月',
      'trend.sum': '六个月合计', 'trend.sum.note': '近 {n} 个月',
      'trend.now': '当月至今日', 'trend.now.note': '还没走完',
      'chart.aria': '近几个月每月新增的 Markdown 篇数',
      'recent.title': '最近更新', 'recent.note': '最新 {n} 篇',
      'recent.col.file': '文件', 'recent.col.topic': '专题', 'recent.col.time': '时间',
      'topics.title': '专题概况', 'topics.note': '按知识量排序',
      'topics.noteAll': '共 {n} 个 · 按知识量排序',
      'topics.unit': '篇', 'topics.more': '另有 {n} 个专题',
      'tag.index': '索引', 'tag.memory': '记忆',
      'insight.title': '知识智能洞察',
      'insight.monthFocus': '本月新增集中在',
      'insight.monthFocus.item': '{name} {n} 篇',
      'insight.monthFocus.meta': '共 {n} 篇',
      'insight.empty': '本月暂无新增',
      'insight.attach': '资料与知识的比例',
      'insight.attach.value': '附件占 {pct}%',
      'insight.attach.meta': 'md 仅 {md} MB，全部资料 {gb} GB',
      'insight.stale': '久未更新的知识',
      'insight.stale.value': '{n} 篇超 {days} 天未动',
      'insight.stale.meta': '占全部 {pct}%，可考虑归档分层',
      'insight.gaps': '结构缺口',
      'insight.gaps.value': '{i} 个专题缺 index.md',
      'insight.gaps.meta': '{m} 个专题缺 项目记忆.md',
      'health.title': '结构体检', 'health.note': '口径：覆盖率，非内容质量',
      'health.score': '结构覆盖',
      'health.index': '索引覆盖', 'health.memory': '记忆覆盖', 'health.active': '本月活跃',
      'health.tip': '由「索引 / 记忆 / 本月活跃」三项覆盖率平均得出。分数低不代表内容差，代表入口还没铺齐——先补 index.md 收益最大。',
      'todo.title': '待办', 'todo.note': '按价值排序',
      'todo.index': '{n} 个专题缺 index.md：{list}',
      'todo.memory': '{n} 个专题缺 项目记忆.md：{list}',
      'todo.more': '等 {n} 个',
      'todo.stale': '{n} 篇超 {days} 天未更新，按项目做一次归档确认',
      'todo.size': '附件 {gb} GB，核对可迁出的大文件',
      'todo.expand': '展开', 'todo.collapse': '收起',
      'todo.fixAll': '全部生成', 'todo.working': '生成中…',
      'todo.dismiss': '忽略', 'todo.restore': '恢复',
      'todo.ignored': '已忽略 {n} 项',
      'todo.generated': '已生成 {n} 个 {file} 骨架',
      'todo.undo': '撤销',
      'todo.nothing': '这些专题已经有这个文件了',
      'todo.allDone': '没有待办了',
      'file.index': 'index.md', 'file.memory': '项目记忆.md',
      'tag.structure': '结构', 'tag.maintain': '维护',
      'foot.line1': '数据来源：{path} 本地扫描（{time}）· 文件数与体积按磁盘实测；趋势与新增按文件修改时间；结构覆盖按目录下 index.md / 项目记忆.md 是否存在。',
      'foot.line2': '只读本地磁盘，不联网、不调用模型 · 结果缓存 {ttl} 秒，随时可重新扫描。',
      'empty.title': '这个目录下还没有 Markdown',
      'empty.body': '确认根目录是不是你的知识库；不在 {path} 的话，改插件配置里的 root。',
      'error.title': '读取数据失败',
      'error.retry': '重试',
      'loading.title': '正在扫描知识库',
      'loading.body': '首次打开会走一遍本地磁盘，几千个文件通常在 1 秒内。',
    };

    const en = {
      nav: 'Knowledge cockpit',
      title: 'My knowledge cockpit',
      sub: 'Everything you saved, findable and reusable',
      badge: 'Local live',
      refresh: 'Rescan',
      'refresh.doing': 'Scanning',
      'refresh.hint': 'Force a fresh local disk scan',
      'stamp.scanned': 'Scanned {time}',
      'stamp.root': 'Root {path}',
      'stamp.cost': 'Scan took {ms} ms',
      'kpi.assets': 'Knowledge', 'kpi.assets.note': 'markdown notes',
      'kpi.files': 'Files', 'kpi.files.note': 'measured on disk',
      'kpi.topics': 'Topics', 'kpi.topics.note': 'top-level folders',
      'kpi.monthNew': 'New this month', 'kpi.monthNew.note': 'notes, by mtime',
      'kpi.monthActive': 'Active', 'kpi.monthActive.note': 'topics updated',
      'kpi.gaps': 'Structure gaps', 'kpi.gaps.note': 'missing entries',
      'dist.title': 'Distribution', 'dist.note': 'by topic · share of notes',
      'donut.unit': 'notes',
      'trend.title': 'Growth', 'trend.note': 'last {n} months · by file mtime',
      'trend.unit': 'notes',
      'trend.peak': 'Peak month',
      'trend.sum': 'Six-month total', 'trend.sum.note': 'last {n} months',
      'trend.now': 'This month', 'trend.now.note': 'to date',
      'chart.aria': 'Notes added per month over the last months',
      'recent.title': 'Recently updated', 'recent.note': 'latest {n} notes',
      'recent.col.file': 'File', 'recent.col.topic': 'Topic', 'recent.col.time': 'Time',
      'topics.title': 'Topics', 'topics.note': 'sorted by volume',
      'topics.noteAll': '{n} topics · sorted by volume',
      'topics.unit': 'notes', 'topics.more': '{n} more topics',
      'tag.index': 'index', 'tag.memory': 'memory',
      'insight.title': 'Insights',
      'insight.monthFocus': 'This month concentrated in',
      'insight.monthFocus.item': '{name} {n}',
      'insight.monthFocus.meta': '{n} notes in total',
      'insight.empty': 'Nothing new this month',
      'insight.attach': 'Files vs knowledge',
      'insight.attach.value': 'Attachments {pct}%',
      'insight.attach.meta': 'markdown {md} MB of {gb} GB',
      'insight.stale': 'Stale knowledge',
      'insight.stale.value': '{n} notes untouched for {days}+ days',
      'insight.stale.meta': '{pct}% of all notes, consider archiving',
      'insight.gaps': 'Structure gaps',
      'insight.gaps.value': '{i} topics lack index.md',
      'insight.gaps.meta': '{m} topics lack 项目记忆.md',
      'health.title': 'Structure health', 'health.note': 'coverage, not quality',
      'health.score': 'coverage',
      'health.index': 'Index coverage', 'health.memory': 'Memory coverage', 'health.active': 'Active this month',
      'health.tip': 'Average of index / memory / monthly activity coverage. A low score means entries are missing, not that the content is weak — add index.md first.',
      'todo.title': 'To do', 'todo.note': 'highest value first',
      'todo.index': '{n} topics need index.md: {list}',
      'todo.memory': '{n} topics need 项目记忆.md: {list}',
      'todo.more': 'and {n} more',
      'todo.stale': '{n} notes untouched for {days}+ days, confirm archiving per project',
      'todo.size': '{gb} GB of attachments, check what can move out',
      'todo.expand': 'Show', 'todo.collapse': 'Hide',
      'todo.fixAll': 'Generate all', 'todo.working': 'Generating…',
      'todo.dismiss': 'Dismiss', 'todo.restore': 'Restore',
      'todo.ignored': '{n} dismissed',
      'todo.generated': 'Created {n} × {file}',
      'todo.undo': 'Undo',
      'todo.nothing': 'Those topics already have this file',
      'todo.allDone': 'Nothing to do',
      'file.index': 'index.md', 'file.memory': '项目记忆.md',
      'tag.structure': 'structure', 'tag.maintain': 'maintain',
      'foot.line1': 'Source: local scan of {path} at {time}. Counts and sizes are measured on disk; trend and monthly additions use file mtime; structure coverage checks index.md / 项目记忆.md in each topic folder.',
      'foot.line2': 'Reads local disk only. No network, no model calls. Cached for {ttl} seconds; rescan any time.',
      'empty.title': 'No markdown under this folder yet',
      'empty.body': 'Check that the root is your knowledge base; if it is not {path}, change root in the plugin config.',
      'error.title': 'Could not load data',
      'error.retry': 'Retry',
      'loading.title': 'Scanning the knowledge base',
      'loading.body': 'The first open walks the local disk; a few thousand files usually take under a second.',
    };

    /** 把 {name} 这类占位符替换成值。 */
    function fill(text, vars) {
      if (!vars) return String(text);
      return String(text).replace(/\{(\w+)\}/g, (match, key) =>
        vars[key] === undefined || vars[key] === null ? match : String(vars[key]),
      );
    }

    let translate = (key, vars) => fill(zh[key] ?? en[key] ?? key, vars);
    const t = (key, vars) => translate(key, vars);

    //#endregion

    //#region 格式化
    const nf = (n) => (typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('en-US') : '—');
    const pad2 = (n) => String(n).padStart(2, '0');
    const shortTime = (ms) => {
      const d = new Date(ms);
      if (Number.isNaN(d.getTime())) return '—';
      return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    };
    const fullTime = (value) => {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return '—';
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    };
    const sizeText = (bytes) => {
      if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
      if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
      if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`;
      return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    };
    const colorAt = (index) => SERIES[((index % SERIES.length) + SERIES.length) % SERIES.length];
    /** 把一长串专题名压成「最多 4 个 + 等 N 个」。 */
    const nameList = (names) => {
      const shown = names.slice(0, 4).join('、');
      return names.length > 4 ? `${shown} ${t('todo.more', { n: names.length - 4 })}` : shown;
    };
    //#endregion

    //#region 样式
    const CSS = `
.kc-root{
  container-type:inline-size;
  height:100%;overflow:auto;overscroll-behavior:contain;
  background:var(--kc-page);
  font:14px/1.55 "PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,-apple-system,sans-serif;
  -webkit-font-smoothing:antialiased;
  --kc-ink:var(--dsw-alias-label-primary, #26211b);
  --kc-dim:var(--dsw-alias-label-secondary, #6d645a);
  --kc-faint:var(--dsw-alias-label-tertiary, #9a9187);
  --kc-accent:#6d3fc2;
  --kc-accent-strong:#7c3aed;
  --kc-accent-text:color-mix(in srgb, #6d3fc2 58%, var(--kc-ink));
  --kc-gold:#b8862f;
  --kc-gold-strong:#d19a24;
  --kc-gold-text:color-mix(in srgb, #a3761f 60%, var(--kc-ink));
  --kc-goldsoft:color-mix(in srgb, var(--kc-gold) 16%, transparent);
  --kc-page:color-mix(in srgb, var(--kc-accent) 9%, var(--dsw-alias-bg-base, #ffffff));
  --kc-card:color-mix(in srgb, var(--kc-accent) 2.5%, var(--dsw-alias-bg-layer-1, #ffffff));
  --kc-card2:color-mix(in srgb, var(--kc-accent) 9%, var(--dsw-alias-bg-layer-2, #ffffff));
  --kc-line:color-mix(in srgb, var(--kc-accent) 30%, transparent);
  --kc-linesoft:color-mix(in srgb, var(--kc-accent) 18%, transparent);
  --kc-brand:var(--kc-accent-strong);
  --kc-brandsoft:color-mix(in srgb, var(--kc-accent-strong) 15%, transparent);
  --kc-track:color-mix(in srgb, var(--kc-ink) 9%, transparent);
  --kc-ok:var(--dsw-alias-state-success-primary, #5c8a5c);
  color:var(--kc-ink);
}
.kc-wrap{position:relative;max-width:1240px;margin:0 auto;padding:26px 32px 56px}
.kc-wrap::before{
  content:"";position:absolute;left:0;right:0;top:-60px;height:280px;pointer-events:none;
  background:radial-gradient(120% 100% at 50% 0%, color-mix(in srgb,var(--kc-brand) 13%, transparent), transparent 66%);
}
.kc-wrap>*{position:relative}
.kc-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:18px}
.kc-title{display:flex;align-items:center;gap:10px;font-size:25px;font-weight:700;letter-spacing:.2px;line-height:1.2}
.kc-title svg{color:var(--kc-gold-strong);flex:0 0 auto}
.kc-sub{margin-top:7px;font-size:12.5px;color:var(--kc-dim)}
.kc-headmeta{display:flex;flex-direction:column;align-items:flex-end;gap:9px;flex:0 0 auto}
.kc-stamp{font-size:10.5px;color:var(--kc-faint);text-align:right;line-height:1.75;font-variant-numeric:tabular-nums;max-width:290px}
.kc-stamp b{font-weight:600;color:var(--kc-dim)}
.kc-chip{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;background:var(--kc-goldsoft);color:var(--kc-gold-text);font-size:10px;font-weight:700;letter-spacing:.5px}
.kc-chip i{width:5px;height:5px;border-radius:50%;background:currentColor;box-shadow:0 0 0 3px color-mix(in srgb, currentColor 22%, transparent)}
.kc-btn{
  display:inline-flex;align-items:center;gap:6px;font:500 12px/1 inherit;
  padding:7px 11px;border-radius:9px;cursor:pointer;
  border:1px solid var(--kc-line);background:var(--kc-card);color:var(--kc-ink);
  transition:background .16s,border-color .16s,transform .12s;
}
.kc-btn:hover:not(:disabled){background:var(--kc-card2);border-color:color-mix(in srgb,var(--kc-gold) 60%, var(--kc-line))}
.kc-btn:active:not(:disabled){transform:translateY(.5px)}
.kc-btn:disabled{opacity:.62;cursor:default}
.kc-spin{animation:kc-rot .85s linear infinite}
@keyframes kc-rot{to{transform:rotate(360deg)}}
.kc-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin-bottom:14px}
.kc-kpi{
  position:relative;overflow:hidden;padding:13px 15px 12px;
  background:var(--kc-card);border:1px solid var(--kc-linesoft);border-radius:14px;
  transition:border-color .18s,transform .18s,box-shadow .18s;
}
.kc-kpi::before{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:linear-gradient(90deg,var(--kc-gold-strong),color-mix(in srgb,var(--kc-gold) 40%, transparent) 54%, transparent 92%);opacity:1}
.kc-kpi:hover{transform:translateY(-1px);border-color:color-mix(in srgb,var(--kac, var(--kc-brand)) 42%, var(--kc-linesoft));box-shadow:0 10px 22px -18px color-mix(in srgb,var(--kc-ink) 70%, transparent)}
.kc-k-label{font-size:11px;color:var(--kc-dim);letter-spacing:.2px;display:flex;align-items:center;gap:6px}
.kc-k-label i{width:5px;height:5px;border-radius:50%;background:var(--kac, var(--kc-brand));flex:0 0 auto}
.kc-k-value{margin-top:5px;font-size:25px;font-weight:700;letter-spacing:-.4px;line-height:1.1;font-variant-numeric:tabular-nums}
.kc-k-note{margin-top:3px;font-size:10.5px;color:var(--kc-faint)}
.kc-duo{display:grid;grid-template-columns:1.06fr 1fr;gap:14px;margin-bottom:14px}
.kc-card{background:var(--kc-card);border:1px solid var(--kc-linesoft);border-radius:15px;padding:15px 17px 17px;min-width:0}
.kc-card-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:13px}
.kc-card-title{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:650;letter-spacing:.2px}
.kc-card-title::before{content:"";width:3px;height:13px;border-radius:2px;background:linear-gradient(180deg,var(--kc-gold-strong),color-mix(in srgb,var(--kc-gold) 25%, transparent))}
.kc-card-note{font-size:10.5px;color:var(--kc-faint);text-align:right;line-height:1.5}
.kc-dist{display:flex;align-items:center;gap:20px}
.kc-donut-box{position:relative;flex:0 0 auto}
.kc-donut-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none}
.kc-donut-center b{font-size:23px;font-weight:700;letter-spacing:-.5px;font-variant-numeric:tabular-nums}
.kc-donut-center span{font-size:10.5px;color:var(--kc-faint);margin-top:1px}
.kc-legend{list-style:none;margin:0;padding:0;flex:1 1 240px;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:0 16px;min-width:0}
.kc-legend li{display:flex;align-items:center;gap:7px;padding:2px 5px;border-radius:7px;font-size:11.5px;min-width:0;transition:background .15s}
.kc-legend li[data-hot="1"]{background:color-mix(in srgb,var(--kc-ink) 6%, transparent)}
.kc-swatch{width:8px;height:8px;border-radius:3px;flex:0 0 auto;background:var(--c)}
.kc-legend .name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--kc-dim)}
.kc-legend .num{font-variant-numeric:tabular-nums;font-weight:600;color:var(--kc-ink);font-size:11.5px}
.kc-legend .pct{flex:0 0 auto;width:36px;text-align:right;font-size:10px;color:var(--kc-faint);font-variant-numeric:tabular-nums}
.kc-chart{display:block;width:100%;height:auto;flex:0 0 auto}
.kc-card-fill{display:flex;flex-direction:column}
.kc-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:auto;padding-top:14px;border-top:1px solid var(--kc-linesoft)}
.kc-stat{min-width:0}
.kc-stat .k{font-size:10.5px;color:var(--kc-faint);letter-spacing:.2px}
.kc-stat .v{margin-top:3px;font-size:15px;font-weight:650;letter-spacing:-.2px;font-variant-numeric:tabular-nums;color:var(--kc-ink);white-space:nowrap}
.kc-stat .v small{font-size:10.5px;font-weight:400;color:var(--kc-dim);margin-left:3px;letter-spacing:0}
.kc-stat .m{margin-top:2px;font-size:10.5px;color:var(--kc-dim);font-variant-numeric:tabular-nums}
.kc-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:11.5px}
.kc-table th{text-align:left;font-weight:500;font-size:10px;letter-spacing:.4px;color:var(--kc-faint);padding:0 0 8px;border-bottom:1px solid var(--kc-linesoft);white-space:nowrap}
.kc-table th:last-child,.kc-table td:last-child{text-align:right;width:78px}
.kc-table th:nth-child(2),.kc-table td:nth-child(2){width:104px}
.kc-table td{padding:7px 0;border-bottom:1px dashed color-mix(in srgb,var(--kc-line) 55%, transparent);vertical-align:middle}
.kc-table tbody tr:last-child td{border-bottom:0}
.kc-table tbody tr{transition:background .14s}
.kc-table tbody tr:hover{background:color-mix(in srgb,var(--kc-ink) 4%, transparent)}
.kc-path{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--kc-ink)}
.kc-topic-chip{display:inline-flex;align-items:center;gap:5px;max-width:100%;font-size:10.5px;color:var(--kc-dim);overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.kc-topic-chip i{width:6px;height:6px;border-radius:50%;flex:0 0 auto;background:var(--c)}
.kc-when{font-size:10.5px;color:var(--kc-faint);font-variant-numeric:tabular-nums;white-space:nowrap}
.kc-topics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.kc-topic{
  position:relative;overflow:hidden;padding:10px 12px 11px;border-radius:12px;
  border:1px solid var(--kc-linesoft);
  background:linear-gradient(180deg, color-mix(in srgb,var(--c) 10%, transparent), transparent 72%);
  transition:border-color .16s,transform .16s;
}
.kc-topic:hover{transform:translateY(-1px);border-color:color-mix(in srgb,var(--c) 45%, var(--kc-linesoft))}
.kc-topic::after{content:"";position:absolute;right:-18px;top:-30px;width:70px;height:70px;border-radius:50%;background:color-mix(in srgb,var(--c) 15%, transparent)}
.kc-topic .t-name{position:relative;display:flex;align-items:center;gap:6px;font-size:11px;color:var(--kc-dim)}
.kc-topic .t-name .d{width:6px;height:6px;border-radius:50%;background:var(--c);flex:0 0 auto}
.kc-topic .t-num{position:relative;margin-top:5px;font-size:21px;font-weight:700;letter-spacing:-.4px;line-height:1.1;font-variant-numeric:tabular-nums}
.kc-topic .t-num small{margin-left:2px;font-size:10px;font-weight:400;color:var(--kc-faint);letter-spacing:0}
.kc-topic .t-meta{position:relative;margin-top:3px;font-size:10px;color:var(--kc-faint);font-variant-numeric:tabular-nums}
.kc-topic .t-tags{position:relative;margin-top:6px;display:flex;flex-wrap:wrap;gap:4px}
.kc-tag{font-size:9px;line-height:1.6;padding:0 6px;border-radius:999px;border:1px solid transparent;letter-spacing:.2px}
.kc-tag[data-on="1"]{color:var(--kc-ok);background:color-mix(in srgb,var(--kc-ok) 13%, transparent);border-color:color-mix(in srgb,var(--kc-ok) 26%, transparent)}
.kc-tag[data-on="0"]{color:var(--kc-faint);background:color-mix(in srgb,var(--kc-ink) 6%, transparent);border-color:var(--kc-linesoft)}
.kc-more{margin-top:9px;font-size:10px;color:var(--kc-faint)}
.kc-ins-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.kc-ins{position:relative;padding:9px 11px 10px 13px;border-radius:10px;background:color-mix(in srgb,var(--kc-ink) 3.5%, transparent)}
.kc-ins::before{content:"";position:absolute;left:0;top:9px;bottom:9px;width:2.5px;border-radius:2px;background:linear-gradient(180deg,var(--kc-accent-strong),color-mix(in srgb,var(--kc-accent) 30%, transparent))}
.kc-ins .k{font-size:10px;color:var(--kc-faint);letter-spacing:.2px}
.kc-ins .v{margin-top:3px;font-size:13px;font-weight:600;line-height:1.5;color:var(--kc-ink)}
.kc-ins .m{margin-top:2px;font-size:10px;color:var(--kc-dim)}
.kc-score{display:flex;align-items:center;gap:16px;margin-bottom:15px}
.kc-ring{position:relative;flex:0 0 auto}
.kc-ring-txt{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.kc-ring-txt b{font-size:25px;font-weight:700;letter-spacing:-.6px;font-variant-numeric:tabular-nums;line-height:1}
.kc-ring-txt span{margin-top:3px;font-size:9.5px;color:var(--kc-faint)}
.kc-score-txt{flex:1;font-size:11px;color:var(--kc-dim);line-height:1.8}
.kc-hb{margin-bottom:10px}
.kc-hb:last-child{margin-bottom:0}
.kc-hb .hb-row{display:flex;align-items:baseline;gap:8px;font-size:11.5px}
.kc-hb .hb-row .n{color:var(--kc-dim)}
.kc-hb .hb-row b{margin-left:auto;font-weight:600;font-variant-numeric:tabular-nums}
.kc-hb .hb-row i{width:44px;text-align:right;font-style:normal;font-size:10px;color:var(--kc-faint);font-variant-numeric:tabular-nums}
.kc-track{height:6px;margin-top:6px;border-radius:4px;overflow:hidden;background:var(--kc-track)}
.kc-fill{height:100%;border-radius:4px;transform-origin:left center;animation:kc-grow .5s cubic-bezier(.2,.7,.2,1) both;
  background:linear-gradient(90deg,#a78bfa,var(--kc-accent-strong))}
@keyframes kc-grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.kc-todo{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:0 26px}
.kc-todo li{display:flex;align-items:center;gap:9px;padding:7px 2px;font-size:11.5px;border-bottom:1px dashed color-mix(in srgb,var(--kc-line) 50%, transparent)}
.kc-todo .mk{width:9px;height:2px;border-radius:1px;flex:0 0 auto;background:color-mix(in srgb,var(--kc-accent-strong) 80%, transparent)}
.kc-todo li[data-tag="maintain"] .mk{background:color-mix(in srgb,var(--kc-ink) 30%, transparent)}
.kc-todo .tl{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--kc-dim)}
.kc-todo li:hover .tl{color:var(--kc-ink)}
.kc-todo .tg{flex:0 0 auto;font-size:9px;letter-spacing:.3px;padding:1px 6px;border-radius:999px;color:var(--kc-faint);background:color-mix(in srgb,var(--kc-ink) 5%, transparent)}
.kc-linkbtn{
  flex:0 0 auto;display:inline-flex;align-items:center;gap:4px;cursor:pointer;
  font:500 11px/1 inherit;padding:4px 8px;border-radius:7px;
  border:1px solid var(--kc-line);background:transparent;color:var(--kc-dim);
  transition:background .15s,color .15s,border-color .15s;
}
.kc-linkbtn:hover:not(:disabled){color:var(--kc-accent-text);border-color:color-mix(in srgb,var(--kc-accent-strong) 55%, transparent);background:color-mix(in srgb,var(--kc-accent-strong) 9%, transparent)}
.kc-linkbtn:disabled{opacity:.55;cursor:default}
.kc-linkbtn:focus-visible{outline:2px solid color-mix(in srgb,var(--kc-accent-strong) 50%, transparent);outline-offset:2px}
.kc-linkbtn-primary{color:var(--kc-gold-text);border-color:color-mix(in srgb,var(--kc-gold) 58%, transparent);background:color-mix(in srgb,var(--kc-gold) 15%, transparent)}
.kc-linkbtn-primary:hover:not(:disabled){background:color-mix(in srgb,var(--kc-gold) 24%, transparent)}
.kc-todo-chips{grid-column:1/-1;flex-wrap:wrap!important;gap:6px!important;padding:8px 2px 10px 22px!important}
.kc-chipbtn{
  display:inline-flex;align-items:center;gap:6px;cursor:pointer;
  font:500 10.5px/1.5 inherit;padding:3px 9px;border-radius:999px;
  border:1px dashed color-mix(in srgb,var(--kc-accent-strong) 40%, transparent);
  background:transparent;color:var(--kc-dim);transition:background .15s,color .15s,border-color .15s;
}
.kc-chipbtn:hover:not(:disabled){color:var(--kc-accent-text);border-style:solid;background:color-mix(in srgb,var(--kc-accent-strong) 11%, transparent)}
.kc-chipbtn:disabled{opacity:.55;cursor:default}
.kc-chipbtn-topic{color:var(--kc-ink);font-weight:600}
.kc-chipbtn-file{font-size:10px;opacity:.8}
.kc-undo{display:flex;align-items:center;gap:10px;margin-top:10px;padding:7px 10px;border-radius:9px;font-size:11px;color:var(--kc-ink);background:var(--kc-goldsoft);border:1px solid color-mix(in srgb,var(--kc-gold) 34%, transparent)}
.kc-undo span{flex:1;min-width:0}
.kc-todo-empty{font-size:11.5px;color:var(--kc-dim);padding:6px 2px}
.kc-todo-err{margin-top:8px;font-size:11px;color:var(--dsw-alias-state-error-primary, #b4544a)}
.kc-foot{margin-top:22px;font-size:10px;color:var(--kc-faint);line-height:1.9}
.kc-state{max-width:560px;margin:64px auto;padding:26px 28px;text-align:center;border-radius:16px;border:1px solid var(--kc-linesoft);background:var(--kc-card)}
.kc-state h3{margin:0 0 8px;font-size:15px;font-weight:650}
.kc-state p{margin:0;font-size:12px;color:var(--kc-dim);line-height:1.8}
.kc-state .kc-btn{margin-top:16px}
.kc-skel{border-radius:8px;background:linear-gradient(100deg, color-mix(in srgb,var(--kc-ink) 6%, transparent) 22%, color-mix(in srgb,var(--kc-ink) 12%, transparent) 40%, color-mix(in srgb,var(--kc-ink) 6%, transparent) 58%);background-size:220% 100%;animation:kc-shimmer 1.35s linear infinite}
@keyframes kc-shimmer{from{background-position:160% 0}to{background-position:-60% 0}}
@media (max-width:1180px){.kc-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:1000px){.kc-duo{grid-template-columns:1fr}}
@media (max-width:760px){.kc-wrap{padding:20px 18px 44px}.kc-todo{grid-template-columns:1fr}.kc-ins-grid{grid-template-columns:1fr}.kc-head{flex-direction:column}.kc-headmeta{align-items:flex-start}.kc-stamp{text-align:left}}
@media (max-width:640px){.kc-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.kc-topics{grid-template-columns:repeat(2,minmax(0,1fr))}.kc-dist{flex-direction:column;align-items:flex-start}.kc-legend{width:100%}}
@media (prefers-reduced-motion: reduce){.kc-fill,.kc-skel,.kc-spin{animation:none}}
`;

    const StyleTag = () => h('style', { 'data-kc': '1', dangerouslySetInnerHTML: { __html: CSS } });
    //#endregion

    //#region 图形
    const Gauge = ({ size = 16 }) => {
      const edge = typeof size === 'number' ? size : 16;
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: edge,
          height: edge,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.35,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
        },
        h('path', { d: 'M2.7 11.6a5.9 5.9 0 1 1 10.6 0' }),
        h('path', { d: 'M8 11.6 10.7 7.2' }),
        h('circle', { cx: 8, cy: 11.6, r: 1, fill: 'currentColor', stroke: 'none' }),
        h('path', { d: 'M4.7 14.1h6.6' }),
      );
    };

    const RefreshIcon = ({ busy }) => h(
      'svg',
      {
        viewBox: '0 0 16 16',
        width: 13,
        height: 13,
        className: busy ? 'kc-spin' : undefined,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.5,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        style: { display: 'block' },
      },
      h('path', { d: 'M13.2 8a5.2 5.2 0 1 1-1.63-3.72' }),
      h('path', { d: 'M13.35 2.6v3.3h-3.3' }),
    );

    /** 环形占比图 + 图例；hover 任一项高亮对应弧段。 */
    const Distribution = ({ topics, total }) => {
      const [hot, setHot] = useState(-1);
      const size = 170;
      const stroke = 16;
      const radius = (size - stroke) / 2;
      const circumference = 2 * Math.PI * radius;
      const gap = circumference * 0.007;
      const arcs = [];
      let acc = 0;
      topics.forEach((topic, index) => {
        const length = total > 0 ? (topic.md / total) * circumference : 0;
        arcs.push({
          index,
          color: colorAt(index),
          dash: Math.max(length - gap, 0.8),
          offset: -acc,
          share: total > 0 ? (topic.md / total) * 100 : 0,
        });
        acc += length;
      });
      const focus = hot >= 0 ? arcs[hot] : null;
      return h(
        'div',
        { className: 'kc-dist' },
        h(
          'div',
          { className: 'kc-donut-box' },
          h(
            'svg',
            {
              viewBox: `0 0 ${size} ${size}`,
              width: size,
              height: size,
              role: 'img',
              'aria-label': `${t('dist.title')}: ${nf(total)}`,
            },
            h('circle', {
              cx: size / 2,
              cy: size / 2,
              r: radius,
              style: { fill: 'none', stroke: 'var(--kc-track)', strokeWidth: stroke },
            }),
            ...arcs.map((arc) => h(
              'circle',
              {
                key: arc.index,
                cx: size / 2,
                cy: size / 2,
                r: radius,
                onMouseEnter: () => setHot(arc.index),
                onMouseLeave: () => setHot(-1),
                style: {
                  fill: 'none',
                  stroke: arc.color,
                  strokeWidth: focus === null || focus.index === arc.index ? stroke : stroke * 0.62,
                  strokeDasharray: `${arc.dash} ${circumference - arc.dash}`,
                  strokeDashoffset: arc.offset,
                  transform: `rotate(-90deg)`,
                  transformOrigin: 'center',
                  opacity: focus === null || focus.index === arc.index ? 1 : 0.28,
                  transition: 'opacity .18s, stroke-width .18s',
                },
              },
              h('title', null, `${topics[arc.index].name} · ${nf(topics[arc.index].md)} · ${arc.share.toFixed(1)}%`),
            )),
          ),
          h(
            'div',
            { className: 'kc-donut-center' },
            h('b', null, focus === null ? nf(total) : nf(topics[focus.index].md)),
            h('span', null, focus === null ? t('donut.unit') : `${focus.share.toFixed(1)}%`),
          ),
        ),
        h(
          'ul',
          { className: 'kc-legend' },
          ...topics.map((topic, index) => h(
            'li',
            {
              key: topic.name,
              'data-hot': hot === index ? '1' : '0',
              onMouseEnter: () => setHot(index),
              onMouseLeave: () => setHot(-1),
                style: { '--c': colorAt(index) },
            },
            h('span', { className: 'kc-swatch' }),
            h('span', { className: 'name', title: topic.name }, topic.name),
            h('span', { className: 'num' }, nf(topic.md)),
            h('span', { className: 'pct' }, `${total > 0 ? ((topic.md / total) * 100).toFixed(1) : '0.0'}%`),
          )),
        ),
      );
    };

    /** Catmull-Rom → 三次贝塞尔，画一条平滑折线。 */
    function smoothPath(points) {
      if (points.length === 0) return '';
      if (points.length === 1) return `M${points[0].x},${points[0].y}`;
      let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
      for (let i = 0; i < points.length - 1; i += 1) {
        const p0 = points[i - 1] ?? points[i];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2] ?? p2;
        const k = 0.16;
        const c1x = p1.x + (p2.x - p0.x) * k;
        const c1y = p1.y + (p2.y - p0.y) * k;
        const c2x = p2.x - (p3.x - p1.x) * k;
        const c2y = p2.y - (p3.y - p1.y) * k;
        d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
      }
      return d;
    }

    const Trend = ({ months }) => {
      const width = 660;
      const height = 262;
      const pad = { l: 44, r: 22, t: 28, b: 36 };
      const series = months.length > 0 ? months : [{ key: '', count: 0 }];
      const max = Math.max(...series.map((item) => item.count), 1);
      const span = Math.max(series.length - 1, 1);
      const points = series.map((item, index) => ({
        key: item.key,
        count: item.count,
        x: pad.l + (index * (width - pad.l - pad.r)) / span,
        y: height - pad.b - (item.count / max) * (height - pad.t - pad.b),
      }));
      const line = smoothPath(points);
      const baseY = height - pad.b;
      const area = `${line} L${points[points.length - 1].x.toFixed(1)},${baseY} L${points[0].x.toFixed(1)},${baseY} Z`;
      const ticks = [0, 0.5, 1].map((ratio) => ({
        ratio,
        y: baseY - ratio * (height - pad.t - pad.b),
        value: Math.round(max * ratio),
      }));
      return h(
        'svg',
        {
          className: 'kc-chart',
          viewBox: `0 0 ${width} ${height}`,
          role: 'img',
          'aria-label': t('chart.aria'),
          preserveAspectRatio: 'xMidYMid meet',
        },
        h(
          'defs',
          null,
          h(
            'linearGradient',
            { id: 'kc-trend-fill', x1: '0', y1: '0', x2: '0', y2: '1' },
            h('stop', { offset: '0', style: { stopColor: 'var(--kc-brand)', stopOpacity: 0.3 } }),
            h('stop', { offset: '1', style: { stopColor: 'var(--kc-brand)', stopOpacity: 0 } }),
          ),
        ),
        ...ticks.map((tick) => h(
          'g',
          { key: `tick-${tick.ratio}` },
          h('line', {
            x1: pad.l,
            y1: tick.y,
            x2: width - pad.r,
            y2: tick.y,
            style: {
              stroke: 'var(--kc-linesoft)',
              strokeWidth: 1,
              strokeDasharray: tick.ratio === 0 ? '0' : '3 6',
            },
          }),
          h(
            'text',
            { x: pad.l - 10, y: tick.y + 3.5, textAnchor: 'end', style: { fill: 'var(--kc-faint)', fontSize: 9.5 } },
            nf(tick.value),
          ),
        )),
        h('path', { d: area, style: { fill: 'url(#kc-trend-fill)' } }),
        h('path', {
          d: line,
          style: {
            fill: 'none',
            stroke: 'var(--kc-brand)',
            strokeWidth: 2.2,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          },
        }),
        ...points.map((point) => h(
          'g',
          { key: point.key },
          h('circle', {
            cx: point.x,
            cy: point.y,
            r: 3.6,
            style: { fill: 'var(--kc-card)', stroke: 'var(--kc-brand)', strokeWidth: 2 },
          }),
          h(
            'text',
            {
              x: point.x,
              y: point.y - 11,
              textAnchor: 'middle',
              style: { fill: 'var(--kc-dim)', fontSize: 10, fontWeight: 600 },
            },
            nf(point.count),
          ),
          h(
            'text',
            {
              x: point.x,
              y: height - 13,
              textAnchor: 'middle',
              style: { fill: 'var(--kc-faint)', fontSize: 9.5 },
            },
            point.key,
          ),
        )),
      );
    };

    /** 结构覆盖分数环。 */
    const ScoreRing = ({ value, size = 104, stroke = 9 }) => {
      const radius = (size - stroke) / 2;
      const circumference = 2 * Math.PI * radius;
      const ratio = Math.max(0, Math.min(100, value));
      return h(
        'div',
        { className: 'kc-ring', style: { width: size, height: size } },
        h(
          'svg',
          { viewBox: `0 0 ${size} ${size}`, width: size, height: size, role: 'img', 'aria-label': `${Math.round(ratio)}%` },
          h(
            'defs',
            null,
            h(
              'linearGradient',
              { id: 'kc-ring-grad', x1: '0', y1: '0', x2: '1', y2: '1' },
              h('stop', { offset: '0', style: { stopColor: 'color-mix(in srgb, var(--kc-accent-strong) 65%, #ffffff)' } }),
              h('stop', { offset: '1', style: { stopColor: 'var(--kc-accent-strong)' } }),
            ),
          ),
          h('circle', {
            cx: size / 2,
            cy: size / 2,
            r: radius,
            style: { fill: 'none', stroke: 'var(--kc-track)', strokeWidth: stroke },
          }),
          h('circle', {
            cx: size / 2,
            cy: size / 2,
            r: radius,
            style: {
              fill: 'none',
              stroke: 'url(#kc-ring-grad)',
              strokeWidth: stroke,
              strokeLinecap: 'round',
              strokeDasharray: `${(circumference * ratio) / 100} ${circumference}`,
              transform: 'rotate(-90deg)',
              transformOrigin: 'center',
            },
          }),
        ),
        h(
          'div',
          { className: 'kc-ring-txt' },
          h('b', null, String(Math.round(ratio))),
          h('span', null, t('health.score')),
        ),
      );
    };
    //#endregion

    //#region 页面
    const Kpi = ({ label, value, note, color }) => h(
      'div',
      { className: 'kc-kpi', style: { '--kac': color } },
      h('div', { className: 'kc-k-label' }, h('i', null), label),
      h('div', { className: 'kc-k-value' }, value),
      h('div', { className: 'kc-k-note' }, note),
    );

    const CardHead = ({ title, note }) => h(
      'div',
      { className: 'kc-card-head' },
      h('div', { className: 'kc-card-title' }, title),
      note ? h('div', { className: 'kc-card-note' }, note) : null,
    );

    const Skeleton = () => h(
      'div',
      null,
      h(
        'div',
        { className: 'kc-head' },
        h('div', null,
          h('div', { className: 'kc-skel', style: { width: 220, height: 30 } }),
          h('div', { className: 'kc-skel', style: { width: 300, height: 13, marginTop: 10 } })),
        h('div', { className: 'kc-skel', style: { width: 120, height: 30 } }),
      ),
      h(
        'div',
        { className: 'kc-kpis' },
        ...[0, 1, 2, 3, 4, 5].map((index) => h(
          'div',
          { key: index, className: 'kc-kpi' },
          h('div', { className: 'kc-skel', style: { width: '55%', height: 10 } }),
          h('div', { className: 'kc-skel', style: { width: '70%', height: 22, marginTop: 9 } }),
          h('div', { className: 'kc-skel', style: { width: '45%', height: 9, marginTop: 7 } }),
        )),
      ),
      h(
        'div',
        { className: 'kc-duo' },
        ...[0, 1].map((index) => h(
          'div',
          { key: index, className: 'kc-card' },
          h('div', { className: 'kc-skel', style: { width: 110, height: 13 } }),
          h('div', { className: 'kc-skel', style: { width: '100%', height: 176, marginTop: 14, borderRadius: 12 } }),
        )),
      ),
      h(
        'div',
        { className: 'kc-card', style: { marginBottom: 14 } },
        h('div', { className: 'kc-skel', style: { width: 90, height: 13 } }),
        h('div', { className: 'kc-skel', style: { width: '100%', height: 120, marginTop: 14, borderRadius: 12 } }),
      ),
    );

    const StateCard = ({ title, body, action }) => h(
      'div',
      { className: 'kc-state' },
      h('h3', null, title),
      body ? h('p', null, body) : null,
      action ?? null,
    );

    const FIX_API = '/api/knowledge-cockpit/fix';
    const UNDO_API = '/api/knowledge-cockpit/undo';
    const DISMISS_KEY = 'kc:dismissed-v1';

    /**
     * 待办卡：结构缺口可一键补骨架（真文件、可撤销），维护项可本地忽略。
     */
    const TodoCard = ({ topics, insights, caps, onRefresh }) => {
      const [expanded, setExpanded] = useState('');
      const [busy, setBusy] = useState('');
      const [created, setCreated] = useState({});
      const [dismissed, setDismissed] = useState({});
      const [error, setError] = useState('');
      const alive = useRef(true);

      useEffect(() => () => {
        alive.current = false;
      }, []);

      useEffect(() => {
        try {
          const raw = localStorage.getItem(DISMISS_KEY);
          if (raw) setDismissed(JSON.parse(raw) || {});
        } catch {
          /* 读不到就当没忽略过 */
        }
      }, []);

      const persist = (next) => {
        setDismissed(next);
        try {
          localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
        } catch {
          /* 存不了就只在本次生效 */
        }
      };

      const missing = {
        index: topics.filter((topic) => !topic.index).map((topic) => topic.name),
        memory: topics.filter((topic) => !topic.memory).map((topic) => topic.name),
      };

      const post = async (url, body) => {
        const response = await fetch(url, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(body),
        });
        let payload = null;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }
        if (!response.ok) throw new Error((payload && payload.error) || `HTTP ${response.status}`);
        return payload;
      };

      const generate = async (kind, topic) => {
        setBusy(`${kind}:${topic || '*'}`);
        setError('');
        try {
          const result = await post(FIX_API, topic ? { kind, topic } : { kind });
          if (!alive.current) return;
          const rels = Array.isArray(result && result.created) ? result.created.map((item) => item.rel) : [];
          if (rels.length === 0) {
            setError(t('todo.nothing'));
          } else {
            setCreated((prev) => ({ ...prev, [kind]: (prev[kind] || []).concat(rels) }));
            setExpanded('');
            onRefresh();
          }
        } catch (err) {
          if (alive.current) setError(String((err && err.message) || err));
        } finally {
          if (alive.current) setBusy('');
        }
      };

      const undo = async (kind) => {
        const paths = created[kind] || [];
        if (paths.length === 0) return;
        setBusy(`undo:${kind}`);
        setError('');
        try {
          await post(UNDO_API, { paths });
          if (!alive.current) return;
          setCreated((prev) => ({ ...prev, [kind]: [] }));
          onRefresh();
        } catch (err) {
          if (alive.current) setError(String((err && err.message) || err));
        } finally {
          if (alive.current) setBusy('');
        }
      };

      const staleSig = String(insights.stale);
      const sizeSig = Number(insights.totalGB || 0).toFixed(2);
      const isDismissed = (kind, sig) => String(dismissed[kind] || '') === String(sig);
      const ignoredCount = (isDismissed('stale', staleSig) ? 1 : 0) + (isDismissed('size', sizeSig) ? 1 : 0);
      const fileName = (kind) => t(kind === 'index' ? 'file.index' : 'file.memory');

      const rows = [];
      const structureRow = (kind, key) => {
        const names = missing[kind];
        if (names.length === 0) return;
        const open = expanded === kind;
        const working = busy === `${kind}:*`;
        rows.push(h(
          'li',
          { key },
          h('span', { className: 'mk', 'aria-hidden': 'true' }),
          h('span', { className: 'tl', title: names.join('、') }, t(key, { n: names.length, list: nameList(names) })),
          h('span', { className: 'tg' }, t('tag.structure')),
          h(
            'button',
            { className: 'kc-linkbtn', onClick: () => setExpanded(open ? '' : kind), disabled: busy !== '' },
            open ? t('todo.collapse') : t('todo.expand'),
          ),
          h(
            'button',
            { className: 'kc-linkbtn kc-linkbtn-primary', onClick: () => generate(kind), disabled: busy !== '' },
            working ? t('todo.working') : t('todo.fixAll'),
          ),
        ));
        if (open) {
          rows.push(h(
            'li',
            { key: `${kind}-chips`, className: 'kc-todo-chips' },
            ...names.map((name) => h(
              'button',
              {
                key: name,
                className: 'kc-chipbtn',
                disabled: busy !== '',
                title: `${t('todo.fixAll')} · ${name}/${fileName(kind)}`,
                onClick: () => generate(kind, name),
              },
              h('span', { className: 'kc-chipbtn-topic' }, name),
              h('span', { className: 'kc-chipbtn-file' }, fileName(kind)),
            )),
          ));
        }
      };

      const maintainRow = (kind, sig, text) => {
        if (isDismissed(kind, sig)) return;
        rows.push(h(
          'li',
          { key: kind, 'data-tag': 'maintain' },
          h('span', { className: 'mk', 'aria-hidden': 'true' }),
          h('span', { className: 'tl', title: text }, text),
          h('span', { className: 'tg' }, t('tag.maintain')),
          h(
            'button',
            { className: 'kc-linkbtn', onClick: () => persist({ ...dismissed, [kind]: String(sig) }) },
            t('todo.dismiss'),
          ),
        ));
      };

      structureRow('index', 'todo.index');
      structureRow('memory', 'todo.memory');
      if (insights.stale > 0) {
        maintainRow('stale', staleSig, t('todo.stale', { n: nf(insights.stale), days: caps.staleDays }));
      }
      if (insights.totalGB > 0) {
        maintainRow('size', sizeSig, t('todo.size', { gb: insights.totalGB.toFixed(2) }));
      }

      const undoRows = ['index', 'memory']
        .filter((kind) => (created[kind] || []).length > 0)
        .map((kind) => h(
          'div',
          { key: `undo-${kind}`, className: 'kc-undo' },
          h('span', null, t('todo.generated', { n: created[kind].length, file: fileName(kind) })),
          h('button', { className: 'kc-linkbtn', onClick: () => undo(kind), disabled: busy !== '' }, t('todo.undo')),
        ));

      return h(
        'div',
        { className: 'kc-card' },
        h(CardHead, { title: t('todo.title'), note: t('todo.note') }),
        rows.length > 0
          ? h('ul', { className: 'kc-todo' }, ...rows)
          : h('div', { className: 'kc-todo-empty' }, t('todo.allDone')),
        ...undoRows,
        ignoredCount > 0
          ? h(
            'div',
            { className: 'kc-undo' },
            h('span', null, t('todo.ignored', { n: ignoredCount })),
            h('button', { className: 'kc-linkbtn', onClick: () => persist({}) }, t('todo.restore')),
          )
          : null,
        error ? h('div', { className: 'kc-todo-err' }, error) : null,
      );
    };

    const PanelPage = () => {
      const [state, setState] = useState({ status: 'loading', data: null, error: null });
      const alive = useRef(true);
      useEffect(() => () => {
        alive.current = false;
      }, []);

      const load = useCallback((force) => {
        setState((prev) => ({ status: prev.data ? 'refreshing' : 'loading', data: prev.data, error: null }));
        const url = force ? `${API}?refresh=1` : API;
        fetch(url, { credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' } })
          .then(async (response) => {
            let body = null;
            try {
              body = await response.json();
            } catch {
              body = null;
            }
            if (!response.ok) throw new Error((body && body.error) || `HTTP ${response.status}`);
            return body;
          })
          .then((data) => {
            if (alive.current) setState({ status: 'ready', data, error: null });
          })
          .catch((error) => {
            if (!alive.current) return;
            setState((prev) => ({
              status: prev.data ? 'ready' : 'error',
              data: prev.data,
              error: String((error && error.message) || error),
            }));
          });
      }, []);

      useEffect(() => {
        load(false);
      }, [load]);

      const data = state.data;
      const busy = state.status === 'loading' || state.status === 'refreshing';

      const topicColors = useMemo(() => {
        const map = new Map();
        const topics = data && Array.isArray(data.topics) ? data.topics : [];
        topics.forEach((topic, index) => map.set(topic.name, colorAt(index)));
        return map;
      }, [data]);

      let body;
      if (!data) {
        body = state.status === 'error'
          ? h(StateCard, {
            title: t('error.title'),
            body: state.error,
            action: h('button', { className: 'kc-btn', onClick: () => load(true) }, t('error.retry')),
          })
          : h(Skeleton);
      } else if (data.totals.md === 0) {
        body = h(StateCard, {
          title: t('empty.title'),
          body: t('empty.body', { path: data.root }),
          action: h('button', { className: 'kc-btn', onClick: () => load(true) }, t('refresh')),
        });
      } else {
        const totals = data.totals;
        const insights = data.insights;
        const caps = data.caps || { staleDays: 60, monthWindow: 6 };
        const months = Array.isArray(data.months) ? data.months : [];
        const peakMonth = months.reduce((best, item) => (item.count > best.count ? item : best), { key: '', count: 0 });
        const monthSum = months.reduce((sum, item) => sum + item.count, 0);
        const currentMonth = months.length > 0 ? months[months.length - 1].count : 0;
        const topics = Array.isArray(data.topics) ? data.topics : [];
        const recent = Array.isArray(data.recent) ? data.recent : [];
        const health = Array.isArray(data.health) ? data.health : [];
        const todos = Array.isArray(data.todos) ? data.todos : [];
        const shownTopics = topics;
        const monthFocus = Array.isArray(insights.monthFocus) ? insights.monthFocus : [];
        const focusText = monthFocus.length > 0
          ? monthFocus.map((item) => t('insight.monthFocus.item', { name: item.name, n: item.count })).join('、')
          : t('insight.empty');
        const insightCards = [
          {
            k: t('insight.monthFocus'),
            v: focusText,
            m: t('insight.monthFocus.meta', { n: insights.monthTotal }),
          },
          {
            k: t('insight.attach'),
            v: t('insight.attach.value', { pct: insights.attachPct.toFixed(1) }),
            m: t('insight.attach.meta', { md: insights.mdMB.toFixed(1), gb: insights.totalGB.toFixed(2) }),
          },
          {
            k: t('insight.stale'),
            v: t('insight.stale.value', { n: nf(insights.stale), days: caps.staleDays }),
            m: t('insight.stale.meta', { pct: insights.stalePct.toFixed(0) }),
          },
          {
            k: t('insight.gaps'),
            v: t('insight.gaps.value', { i: insights.missingIndex }),
            m: t('insight.gaps.meta', { m: insights.missingMemory }),
          },
        ];

        body = h(
          'div',
          null,
          h(
            'div',
            { className: 'kc-head' },
            h(
              'div',
              null,
              h('div', { className: 'kc-title' }, h(Gauge, { size: 24 }), t('title')),
              h('div', { className: 'kc-sub' }, t('sub')),
            ),
            h(
              'div',
              { className: 'kc-headmeta' },
              h('div', { className: 'kc-stamp' },
                h('div', null, t('stamp.scanned', { time: fullTime(data.generatedAt) })),
                h('div', null, t('stamp.root', { path: data.root })),
                h('div', null, t('stamp.cost', { ms: nf(data.scanMs) }))),
              h(
                'div',
                { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                h('span', { className: 'kc-chip' }, h('i', null), t('badge')),
                h(
                  'button',
                  {
                    className: 'kc-btn',
                    onClick: () => load(true),
                    disabled: busy,
                    title: t('refresh.hint'),
                  },
                  h(RefreshIcon, { busy }),
                  h('span', null, busy ? t('refresh.doing') : t('refresh')),
                ),
              ),
            ),
          ),
          h(
            'div',
            { className: 'kc-kpis' },
            h(Kpi, { label: t('kpi.assets'), value: nf(totals.md), note: t('kpi.assets.note'), color: SERIES[0] }),
            h(Kpi, { label: t('kpi.files'), value: nf(totals.files), note: sizeText(totals.bytes), color: SERIES[3] }),
            h(Kpi, { label: t('kpi.topics'), value: nf(totals.topics), note: t('kpi.topics.note'), color: SERIES[1] }),
            h(Kpi, { label: t('kpi.monthNew'), value: nf(totals.monthNew), note: t('kpi.monthNew.note'), color: SERIES[2] }),
            h(Kpi, { label: t('kpi.monthActive'), value: nf(totals.monthActive), note: t('kpi.monthActive.note'), color: SERIES[4] }),
            h(Kpi, { label: t('kpi.gaps'), value: nf(totals.gaps), note: t('kpi.gaps.note'), color: SERIES[5] }),
          ),
          h(
            'div',
            { className: 'kc-duo' },
            h(
              'div',
              { className: 'kc-card' },
              h(CardHead, { title: t('dist.title'), note: t('dist.note') }),
              h(Distribution, { topics, total: totals.md }),
            ),
            h(
              'div',
              { className: 'kc-card kc-card-fill' },
              h(CardHead, { title: t('trend.title'), note: t('trend.note', { n: caps.monthWindow }) }),
              h(Trend, { months }),
              h(
                'div',
                { className: 'kc-stats' },
                h('div', { className: 'kc-stat' },
                  h('div', { className: 'k' }, t('trend.peak')),
                  h('div', { className: 'v' }, nf(peakMonth.count), h('small', null, t('trend.unit'))),
                  h('div', { className: 'm' }, peakMonth.key || '—')),
                h('div', { className: 'kc-stat' },
                  h('div', { className: 'k' }, t('trend.sum')),
                  h('div', { className: 'v' }, nf(monthSum), h('small', null, t('trend.unit'))),
                  h('div', { className: 'm' }, t('trend.sum.note', { n: caps.monthWindow }))),
                h('div', { className: 'kc-stat' },
                  h('div', { className: 'k' }, t('trend.now')),
                  h('div', { className: 'v' }, nf(currentMonth), h('small', null, t('trend.unit'))),
                  h('div', { className: 'm' }, t('trend.now.note'))),
              ),
            ),
          ),
          h(
            'div',
            { className: 'kc-duo' },
            h(
              'div',
              { className: 'kc-card' },
              h(CardHead, { title: t('recent.title'), note: t('recent.note', { n: recent.length }) }),
              h(
                'table',
                { className: 'kc-table' },
                h('thead', null, h(
                  'tr',
                  null,
                  h('th', null, t('recent.col.file')),
                  h('th', null, t('recent.col.topic')),
                  h('th', null, t('recent.col.time')),
                )),
                h('tbody', null, ...recent.map((item) => h(
                  'tr',
                  { key: item.rel + item.mtime },
                  h('td', null, h('span', { className: 'kc-path', title: item.rel }, item.rel)),
                  h('td', null, h(
                    'span',
                    { className: 'kc-topic-chip', style: { '--c': topicColors.get(item.topic) || LOOSE_COLOR } },
                    h('i', null),
                    h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis' } }, item.topic),
                  )),
                  h('td', null, h('span', { className: 'kc-when' }, shortTime(item.mtime))),
                ))),
              ),
            ),
            h(
              'div',
              { className: 'kc-card' },
              h(CardHead, { title: t('topics.title'), note: t('topics.noteAll', { n: topics.length }) }),
              h(
                'div',
                { className: 'kc-topics' },
                ...shownTopics.map((topic, index) => h(
                  'div',
                  { key: topic.name, className: 'kc-topic', style: { '--c': colorAt(index) } },
                  h('div', { className: 't-name' }, h('span', { className: 'd' }), topic.name),
                  h('div', { className: 't-num' }, nf(topic.md), h('small', null, t('topics.unit'))),
                  h('div', { className: 't-meta' },
                    `${sizeText(topic.bytes)} · ${topic.latest ? shortTime(topic.latest) : '—'}`),
                  h(
                    'div',
                    { className: 't-tags' },
                    h('span', { className: 'kc-tag', 'data-on': topic.index ? '1' : '0' }, `${t('tag.index')} ${topic.index ? '✓' : '✗'}`),
                    h('span', { className: 'kc-tag', 'data-on': topic.memory ? '1' : '0' }, `${t('tag.memory')} ${topic.memory ? '✓' : '✗'}`),
                  ),
                )),
              ),
              topics.length > shownTopics.length
                ? h('div', { className: 'kc-more' }, t('topics.more', { n: topics.length - shownTopics.length }))
                : null,
            ),
          ),
          h(
            'div',
            { className: 'kc-duo' },
            h(
              'div',
              { className: 'kc-card' },
              h(CardHead, { title: t('insight.title') }),
              h(
                'div',
                { className: 'kc-ins-grid' },
                ...insightCards.map((card) => h(
                  'div',
                  { key: card.k, className: 'kc-ins' },
                  h('div', { className: 'k' }, card.k),
                  h('div', { className: 'v' }, card.v),
                  h('div', { className: 'm' }, card.m),
                )),
              ),
            ),
            h(
              'div',
              { className: 'kc-card' },
              h(CardHead, { title: t('health.title'), note: t('health.note') }),
              h(
                'div',
                { className: 'kc-score' },
                h(ScoreRing, { value: totals.score }),
                h('div', { className: 'kc-score-txt' }, t('health.tip')),
              ),
              ...health.map((entry) => h(
                'div',
                { key: entry.key, className: 'kc-hb' },
                h(
                  'div',
                  { className: 'hb-row' },
                  h('span', { className: 'n' }, t(`health.${entry.key}`)),
                  h('b', null, `${entry.pct.toFixed(0)}%`),
                  h('i', null, `${entry.hit}/${entry.total}`),
                ),
                h('div', { className: 'kc-track' }, h('div', { className: 'kc-fill', style: { width: `${Math.max(entry.pct, 1)}%` } })),
              )),
            ),
          ),
          h(
            'div',
            { className: 'kc-card' },
            h(TodoCard, { topics, insights, caps, onRefresh: () => load(true) }),
          ),
          h(
            'div',
            { className: 'kc-foot' },
            h('div', null, t('foot.line1', {
              path: data.root,
              time: fullTime(data.generatedAt),
            })),
            h('div', null, t('foot.line2', { ttl: Math.round((data.cacheTtlMs || 60) / 1000) })),
          ),
        );
      }

      return h(
        'div',
        { className: 'kc-root' },
        h(StyleTag),
        h('div', { className: 'kc-wrap' }, body),
      );
    };
    /**
     * 渲染兜底：页面组件抛错时给出可读信息，而不是一片白。
     * （面板插槽自己会把崩溃吞掉，没兜底就只有白屏。）
     */
    class PageBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { error: null };
      }

      static getDerivedStateFromError(error) {
        return { error };
      }

      componentDidCatch(error) {
        console.warn('[knowledge-cockpit] render failed:', error);
      }

      render() {
        if (this.state.error) {
          return h(
            'div',
            { className: 'kc-root' },
            h(StyleTag),
            h('div', { className: 'kc-wrap' },
              h(StateCard, {
                title: t('error.title'),
                body: String((this.state.error && this.state.error.message) || this.state.error),
              })),
          );
        }
        return this.props.children;
      }
    }

    /** 插槽入口：用兜底包住整页。 */
    const PanelShell = () => h(PageBoundary, null, h(PanelPage));
    //#endregion

    const inject = ['slots', 'locale'];

    /**
     * 挂载侧边栏入口与主区页面。
     * @param ctx - 客户端根上下文（slots / locale 服务）。
     */
    function apply(ctx) {
      ctx.effect(() => {
        try {
          return ctx.locale.register(NS, { zh, en });
        } catch {
          return () => {};
        }
      }, 'knowledge-cockpit: dictionaries');

      try {
        const bound = ctx.locale.bind(NS);
        if (typeof bound === 'function') {
          translate = (key, vars) => {
            let raw;
            try {
              raw = bound(key);
            } catch {
              raw = undefined;
            }
            return fill(typeof raw === 'string' && raw !== '' ? raw : (zh[key] ?? key), vars);
          };
        }
      } catch {
        /* 语言服务不可用时退回内置文案 */
      }

      ctx.effect(() => {
        const disposers = [];
        try {
          disposers.push(ctx.slots.inject('main', () => ctx.slots.register({
            name: 'main',
            key: PANEL_ID,
            locale: NS,
          }, PanelShell)));
          disposers.push(ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 60,
            label: () => t('nav'),
            locale: NS,
          }, Gauge)));
        } catch (error) {
          console.warn('[knowledge-cockpit] panel registration failed:', error);
        }
        return () => {
          for (const dispose of disposers.splice(0)) {
            try {
              dispose();
            } catch {
              /* 已释放 */
            }
          }
        };
      }, 'knowledge-cockpit: panel');
    }

    return { inject, apply };
  },
});
