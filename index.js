/**
 * 知识驾驶舱 · 宿主半边。
 *
 * 扫描本地 Markdown 知识库，把驾驶舱需要的全部数字算好，
 * 通过 /api/knowledge-cockpit/data 交给浏览器半边渲染。
 *
 * 口径（与桌面版 gen-dashboard.py 一致）：
 * - 文件数 / 体积：磁盘实测（跳过 .obsidian、.git、node_modules 等）；
 * - 新增 / 趋势：按文件 mtime；
 * - 结构覆盖：顶层专题目录下 index.md / 项目记忆.md 是否存在。
 *
 * 只读本地磁盘，不联网、不调用模型。结果缓存 cacheTtlMs，
 * 浏览器每次刷新可带 ?refresh=1 强制重扫。
 */
import { existsSync } from 'node:fs';
import { readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve, sep } from 'node:path';
import { homedir } from 'node:os';

/** 扫描时整目录跳过的名字。 */
const SKIP = new Set([
  '.obsidian',
  '.git',
  '.trash',
  '.DS_Store',
  '.idea',
  '.venv',
  '__pycache__',
  'node_modules',
]);

const DAY = 86400000;

const DEFAULTS = {
  root: process.env.KB_COCKPIT_ROOT ?? join(homedir(), '知识库'),
  cacheTtlMs: 60000,
  staleDays: 60,
  recentCount: 10,
  monthWindow: 6,
  maxFiles: 400000,
};

/** 'YYYY-MM'。 */
function monthKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 近 n 个月（含本月）的 'YYYY-MM'，从旧到新。 */
function monthKeys(n) {
  const now = new Date();
  const out = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

/** 一轮磁盘扫描，返回未聚合的原始事实。 */
async function scanTree(root, maxFiles) {
  let files = 0;
  let bytes = 0;
  let mdBytes = 0;
  const mdList = [];
  const bytesByTop = new Map();

  const walk = async (abs, rel) => {
    let entries;
    try {
      entries = await readdir(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (files >= maxFiles) return;
      const name = entry.name;
      if (SKIP.has(name)) continue;
      const childAbs = join(abs, name);
      const childRel = rel === '' ? name : `${rel}/${name}`;
      if (entry.isDirectory()) {
        await walk(childAbs, childRel);
        continue;
      }
      if (!entry.isFile()) continue;
      let st;
      try {
        st = await stat(childAbs);
      } catch {
        continue;
      }
      files += 1;
      bytes += st.size;
      const top = rel === '' ? '根层' : rel.split('/')[0];
      bytesByTop.set(top, (bytesByTop.get(top) ?? 0) + st.size);
      if (name.endsWith('.md') && st.size > 0) {
        mdBytes += st.size;
        mdList.push({ rel: childRel, mtime: st.mtimeMs });
      }
    }
  };

  await walk(root, '');
  return { files, bytes, mdBytes, mdList, bytesByTop };
}

/** 汇总成驾驶舱数据。 */
async function buildPayload(root, opts) {
  const started = Date.now();
  const { files, bytes, mdBytes, mdList, bytesByTop } = await scanTree(root, opts.maxFiles);

  let dirNames = [];
  try {
    dirNames = (await readdir(root, { withFileTypes: true }))
      .filter((d) => d.isDirectory() && !SKIP.has(d.name) && !d.name.startsWith('.'))
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  } catch (error) {
    throw new Error(`无法读取知识库根目录 ${root}（${error.message}）。请在插件配置里设置 root 指向你的知识库。`);
  }

  const curMonth = monthKey(Date.now());
  const window = monthKeys(opts.monthWindow);
  const monthCounts = new Map(window.map((k) => [k, 0]));

  const topicMap = new Map(
    dirNames.map((name) => [
      name,
      {
        name,
        md: 0,
        bytes: bytesByTop.get(name) ?? 0,
        latest: 0,
        month: 0,
        index: false,
        memory: false,
      },
    ]),
  );

  let loose = 0;
  for (const item of mdList) {
    const top = item.rel.includes('/') ? item.rel.split('/')[0] : '根层';
    const topic = topicMap.get(top);
    if (top === '根层') loose += 1;
    if (topic) {
      topic.md += 1;
      if (item.mtime > topic.latest) topic.latest = item.mtime;
      if (monthKey(item.mtime) === curMonth) topic.month += 1;
    }
    const key = monthKey(item.mtime);
    if (monthCounts.has(key)) monthCounts.set(key, monthCounts.get(key) + 1);
  }

  for (const name of dirNames) {
    const topic = topicMap.get(name);
    topic.index = existsSync(join(root, name, 'index.md'));
    topic.memory = existsSync(join(root, name, '项目记忆.md'));
  }

  const topics = [...topicMap.values()].sort((a, b) => b.md - a.md || a.name.localeCompare(b.name));
  const indexCov = topics.filter((t) => t.index).length;
  const memoryCov = topics.filter((t) => t.memory).length;
  const activeCount = topics.filter((t) => t.month > 0).length;
  const topicCount = topics.length || 1;

  const now = Date.now();
  const staleCount = mdList.filter((item) => now - item.mtime > opts.staleDays * DAY).length;
  const recent = [...mdList]
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, opts.recentCount)
    .map((item) => ({
      rel: item.rel,
      topic: item.rel.includes('/') ? item.rel.split('/')[0] : '根层',
      mtime: item.mtime,
    }));

  const health = [
    { key: 'index', pct: (indexCov / topicCount) * 100, hit: indexCov, total: topics.length },
    { key: 'memory', pct: (memoryCov / topicCount) * 100, hit: memoryCov, total: topics.length },
    { key: 'active', pct: (activeCount / topicCount) * 100, hit: activeCount, total: topics.length },
  ];
  const score = Math.round(health.reduce((sum, item) => sum + item.pct, 0) / health.length);

  const monthFocus = [...topics]
    .filter((t) => t.month > 0)
    .sort((a, b) => b.month - a.month)
    .slice(0, 3)
    .map((t) => ({ name: t.name, count: t.month }));

  const todos = [];
  for (const t of topics) if (!t.index) todos.push({ key: 'todo.index', topic: t.name, tag: 'structure' });
  for (const t of topics) if (!t.memory) todos.push({ key: 'todo.memory', topic: t.name, tag: 'structure' });
  if (staleCount > 0) todos.push({ key: 'todo.stale', count: staleCount, tag: 'maintain' });
  if (bytes > 0) todos.push({ key: 'todo.size', gb: bytes / 1073741824, tag: 'maintain' });

  return {
    generatedAt: new Date().toISOString(),
    scannedAt: Date.now(),
    root,
    scanMs: Date.now() - started,
    caps: { staleDays: opts.staleDays, monthWindow: opts.monthWindow, recentCount: opts.recentCount },
    cacheTtlMs: opts.cacheTtlMs,
    totals: {
      md: mdList.length,
      files,
      bytes,
      mdBytes,
      topics: topics.length,
      loose,
      monthNew: monthCounts.get(curMonth) ?? 0,
      monthActive: activeCount,
      gaps: topics.length * 2 - indexCov - memoryCov,
      stale: staleCount,
      score,
    },
    topics: topics.map((t) => ({
      name: t.name,
      md: t.md,
      bytes: t.bytes,
      latest: t.latest,
      month: t.month,
      index: t.index,
      memory: t.memory,
    })),
    months: window.map((key) => ({ key, count: monthCounts.get(key) ?? 0 })),
    recent,
    health,
    insights: {
      monthFocus,
      monthTotal: monthCounts.get(curMonth) ?? 0,
      attachPct: bytes > 0 ? ((bytes - mdBytes) / bytes) * 100 : 0,
      mdMB: mdBytes / 1048576,
      totalGB: bytes / 1073741824,
      stale: staleCount,
      stalePct: mdList.length > 0 ? (staleCount / mdList.length) * 100 : 0,
      missingIndex: topics.filter((t) => !t.index).length,
      missingMemory: topics.filter((t) => !t.memory).length,
    },
    todos,
  };
}

/** 生成文件的标记：撤销时只删带这行的文件。 */
const MARKER = '<!-- knowledge-cockpit:generated -->';

/** 目标路径是否在根目录内（含根自身）。 */
function isInside(child, root) {
  const from = resolve(root);
  const to = resolve(child);
  if (to === from) return true;
  return to.startsWith(from.endsWith(sep) ? from : `${from}${sep}`);
}

/** 把一个专题目录里的子目录与最近更新的 md 抓出来，用于生成入口页。 */
async function scanTopicDir(root, topic) {
  const base = join(root, topic);
  const subdirs = [];
  const files = [];
  const walk = async (abs, rel, depth) => {
    let entries;
    try {
      entries = await readdir(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (SKIP.has(entry.name) || entry.name.startsWith('.')) continue;
      const childAbs = join(abs, entry.name);
      const childRel = rel === '' ? entry.name : `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        if (depth === 0) subdirs.push(entry.name);
        if (depth < 2) await walk(childAbs, childRel, depth + 1);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      let st;
      try {
        st = await stat(childAbs);
      } catch {
        continue;
      }
      files.push({ rel: childRel, name: entry.name, mtime: st.mtimeMs, size: st.size });
    }
  };
  await walk(base, '', 0);
  files.sort((a, b) => b.mtime - a.mtime);
  subdirs.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  return { subdirs, files: files.slice(0, 10) };
}

/** 链接文字里去掉方括号，避免破坏 Markdown 结构。 */
function linkText(name) {
  return String(name).replace(/[[\]]/g, '');
}

function shortDate(ms) {
  const d = new Date(ms);
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 生成 index.md 骨架：目录 + 最近更新，都是真内容，不是空模板。 */
function buildIndexMd(topic, info) {
  const today = new Date().toISOString().slice(0, 10);
  const lines = [`# ${topic}`, '', `> 入口页骨架由知识驾驶舱生成（${today}）。标题与一句话定位请按项目习惯改写。`, ''];
  if (info.subdirs.length > 0) {
    lines.push('## 目录', '');
    for (const name of info.subdirs) lines.push(`- ${name}`);
    lines.push('');
  }
  if (info.files.length > 0) {
    lines.push('## 最近更新', '');
    for (const file of info.files) {
      lines.push(`- [${linkText(file.name)}](<${file.rel}>) — ${shortDate(file.mtime)}`);
    }
    lines.push('');
  }
  lines.push(MARKER, '');
  return lines.join('\n');
}

/** 生成 项目记忆.md 骨架：只给结构，内容留空等人填。 */
function buildMemoryMd(topic) {
  const today = new Date().toISOString().slice(0, 10);
  return [
    `# ${topic} · 项目记忆`,
    '',
    `> 骨架由知识驾驶舱生成（${today}）。先填「一句话定位」，其余按需。`,
    '',
    '## 一句话定位',
    '',
    '## 当前重点',
    '',
    '- ',
    '',
    '## 关键决策',
    '',
    '| 日期 | 决策 | 依据 |',
    '| --- | --- | --- |',
    '|  |  |  |',
    '',
    '## 待解决问题',
    '',
    '- ',
    '',
    '## 关联',
    '',
    '- ',
    '',
    '## 更新记录',
    '',
    `- ${today} 建立骨架`,
    '',
    MARKER,
    '',
  ].join('\n');
}

/** 读一个 JSON 请求体（上限 8 KB）。 */
function readJsonBody(req) {
  return new Promise((done, fail) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 8192) {
        fail(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        done(chunks.length === 0 ? {} : JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        fail(new Error(`invalid JSON body: ${error.message}`));
      }
    });
    req.on('error', fail);
  });
}

/** 回路 / 配对设备放行（同源 GUI 走回路）。 */
function isLoopbackAddress(address) {
  if (typeof address !== 'string') return false;
  const value = address.toLowerCase();
  if (value === '::1') return true;
  const v4 = value.startsWith('::ffff:') ? value.slice(7) : value;
  const parts = v4.split('.');
  return parts.length === 4 && parts[0] === '127';
}

function isLoopbackHost(host) {
  if (typeof host !== 'string') return false;
  const value = host.toLowerCase();
  if (value === 'localhost' || value.startsWith('localhost:')) return true;
  if (value.startsWith('[::1]')) return true;
  return value.startsWith('127.');
}

function isAllowed(ctx, req) {
  try {
    const connection = typeof ctx.get === 'function' ? ctx.get('connection', false) : undefined;
    if (connection && typeof connection.requestRejection === 'function' && connection.requestRejection(req) === undefined) {
      return true;
    }
  } catch {
    /* 没有 connection 服务时忽略 */
  }
  try {
    const pairing = typeof ctx.get === 'function' ? ctx.get('remoteWebUiPairing', false) : undefined;
    if (pairing && typeof pairing.isPairedDevice === 'function' && pairing.isPairedDevice(req) === true) return true;
  } catch {
    /* 没有配对服务时忽略 */
  }
  if (req.headers['x-forwarded-for'] !== undefined || req.headers['cf-connecting-ip'] !== undefined) return false;
  if (!isLoopbackAddress(req.socket?.remoteAddress)) return false;
  if (!isLoopbackHost(req.headers.host)) return false;
  return req.headers['sec-fetch-site'] !== 'cross-site';
}

function writeJson(res, status, body) {
  const text = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(text);
}

/** 组合出本插件要用的配置（行 config 优先，环境变量兜底）。 */
function resolveConfig(config) {
  const root = typeof config?.root === 'string' && config.root !== '' ? config.root : DEFAULTS.root;
  const int = (value, fallback, min) => (Number.isFinite(value) ? Math.max(min, Math.round(value)) : fallback);
  return {
    root,
    cacheTtlMs: int(config?.cacheTtlMs, DEFAULTS.cacheTtlMs, 0),
    staleDays: int(config?.staleDays, DEFAULTS.staleDays, 1),
    recentCount: int(config?.recentCount, DEFAULTS.recentCount, 1),
    monthWindow: int(config?.monthWindow, DEFAULTS.monthWindow, 2),
    maxFiles: int(config?.maxFiles, DEFAULTS.maxFiles, 1000),
  };
}

const inject = ['webServer'];

/**
 * 挂载数据路由。扫描结果按 cacheTtlMs 缓存，并发请求共用同一轮扫描。
 * @param ctx - 携带 webServer 服务的宿主上下文。
 * @param config - 行配置。
 */
function apply(ctx, config) {
  const opts = resolveConfig(config);
  let cache = { at: 0, payload: null };
  let inflight = null;

  const load = async (force) => {
    const fresh = cache.payload !== null && Date.now() - cache.at < opts.cacheTtlMs;
    if (!force && fresh) return cache.payload;
    if (inflight !== null) return inflight;
    inflight = buildPayload(opts.root, opts)
      .then((payload) => {
        cache = { at: Date.now(), payload };
        return payload;
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  };

  const invalidate = () => {
    cache = { at: 0, payload: null };
  };

  /** 扫描一侧目录：根目录下的专题名（不信任请求里的名字）。 */
  const topicDirs = async () =>
    (await readdir(opts.root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && !SKIP.has(entry.name) && !entry.name.startsWith('.'))
      .map((entry) => entry.name);

  /** 补骨架：把缺的 index.md / 项目记忆.md 写出来（已存在的不碰）。 */
  const fix = async (body) => {
    const kind = body?.kind === 'memory' ? 'memory' : 'index';
    const only = typeof body?.topic === 'string' && body.topic !== '' ? body.topic : null;
    const file = kind === 'index' ? 'index.md' : '项目记忆.md';
    const names = await topicDirs();
    const created = [];
    const skipped = [];
    for (const topic of names) {
      if (only !== null && topic !== only) continue;
      const abs = join(opts.root, topic, file);
      if (existsSync(abs)) {
        skipped.push({ topic, reason: 'exists' });
        continue;
      }
      const info = kind === 'index' ? await scanTopicDir(opts.root, topic) : null;
      const content = kind === 'index' ? buildIndexMd(topic, info) : buildMemoryMd(topic);
      try {
        await writeFile(abs, content, { flag: 'wx' });
        created.push({ topic, rel: relative(opts.root, abs) });
      } catch (error) {
        skipped.push({ topic, reason: error?.code === 'EEXIST' ? 'exists' : String(error?.message ?? error) });
      }
    }
    if (created.length > 0) invalidate();
    return { kind, created, skipped };
  };

  /** 撤销：只删带生成标记、且没被别人改过的文件。 */
  const undo = async (body) => {
    const list = Array.isArray(body?.paths) ? body.paths : [];
    const removed = [];
    const kept = [];
    for (const rel of list) {
      if (typeof rel !== 'string' || rel === '' || rel.includes('\u0000')) continue;
      const abs = resolve(opts.root, rel);
      if (!isInside(abs, opts.root)) {
        kept.push({ rel, reason: 'outside' });
        continue;
      }
      const name = basename(abs);
      if (name !== 'index.md' && name !== '项目记忆.md') {
        kept.push({ rel, reason: 'name' });
        continue;
      }
      try {
        const text = await readFile(abs, 'utf8');
        if (!text.includes(MARKER)) {
          kept.push({ rel, reason: 'edited' });
          continue;
        }
        await unlink(abs);
        removed.push(rel);
      } catch {
        kept.push({ rel, reason: 'missing' });
      }
    }
    if (removed.length > 0) invalidate();
    return { removed, kept };
  };

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'prefix',
        path: '/api/knowledge-cockpit',
        handler: async (req, res) => {
          try {
            if (!isAllowed(ctx, req)) {
              writeJson(res, 403, { error: 'forbidden: 只允许本机界面访问' });
              return;
            }
            const url = new URL(req.url ?? '/', 'http://127.0.0.1');
            const route = url.pathname.replace(/\/+$/, '');
            if (route === '/api/knowledge-cockpit/data') {
              if (req.method !== 'GET') {
                writeJson(res, 405, { error: `method not allowed: ${req.method}` });
                return;
              }
              writeJson(res, 200, await load(url.searchParams.get('refresh') === '1'));
              return;
            }
            if (route === '/api/knowledge-cockpit/fix' || route === '/api/knowledge-cockpit/undo') {
              if (req.method !== 'POST') {
                writeJson(res, 405, { error: `method not allowed: ${req.method}` });
                return;
              }
              if (!String(req.headers['content-type'] ?? '').includes('application/json')) {
                writeJson(res, 415, { error: 'expected application/json' });
                return;
              }
              const body = await readJsonBody(req);
              const result = route.endsWith('/fix') ? await fix(body) : await undo(body);
              writeJson(res, 200, result);
              return;
            }
            writeJson(res, 404, { error: `unknown route: ${url.pathname}` });
          } catch (error) {
            ctx.logger?.warn?.(`[knowledge-cockpit] ${error?.stack ?? error}`);
            writeJson(res, 500, { error: String(error?.message ?? error) });
          }
        },
      }),
    'knowledge-cockpit: routes',
  );
}

export { apply, inject };
