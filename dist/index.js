import { rm, readFile, readdir, stat, writeFile, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
const SESSIONS_ROOT = join(homedir(), ".dsh", "sessions");
const WORKSPACE_STORE = join(homedir(), ".dsh", "storages", "workspace.json");
const TITLE_CACHE = join(homedir(), ".dsh", "storages", "session_projcache", "sessions");
async function readStore() {
  if (!existsSync(WORKSPACE_STORE)) throw new Error(`找不到 workspace 存储：${WORKSPACE_STORE}`);
  const raw = await readFile(WORKSPACE_STORE, "utf8");
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`workspace 存储不是合法 JSON：${WORKSPACE_STORE}`);
  }
}
async function writeStore(store) {
  const tmp = `${WORKSPACE_STORE}.tmp-${process.pid}`;
  await writeFile(tmp, `${JSON.stringify(store, null, 2)}
`, "utf8");
  await rename(tmp, WORKSPACE_STORE);
}
function workspaceTitleOf(store, sessionId) {
  for (const record of Object.values(store.tables.workspaces)) {
    if (record.sessionIds.includes(sessionId)) return record.title;
  }
  return null;
}
async function locate(sessionId) {
  let slugs;
  try {
    slugs = await readdir(SESSIONS_ROOT);
  } catch {
    return { dir: null, bytes: 0 };
  }
  for (const slug of slugs) {
    const dir = join(SESSIONS_ROOT, slug, sessionId);
    if (!existsSync(dir)) continue;
    let bytes = 0;
    try {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (!entry.isFile()) continue;
        try {
          bytes += (await stat(join(dir, entry.name))).size;
        } catch {
        }
      }
    } catch {
    }
    return { dir, bytes };
  }
  return { dir: null, bytes: 0 };
}
async function readCache() {
  var _a, _b, _c;
  const map = /* @__PURE__ */ new Map();
  let files;
  try {
    files = await readdir(TITLE_CACHE);
  } catch {
    return map;
  }
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const data = JSON.parse(await readFile(join(TITLE_CACHE, file), "utf8"));
      const cwd = (_b = (_a = data.record) == null ? void 0 : _a.identity) == null ? void 0 : _b.cwd;
      map.set(file.replace(/\.json$/, ""), {
        title: readRowTitle((_c = data.record) == null ? void 0 : _c.rows),
        cwd: typeof cwd === "string" && cwd ? cwd : null
      });
    } catch {
    }
  }
  return map;
}
function readRowTitle(rows) {
  if (rows === null || typeof rows !== "object") return null;
  const candidates = Array.isArray(rows) ? [rows[0]] : [rows["0"] ?? rows];
  for (const candidate of candidates) {
    if (candidate === null || typeof candidate !== "object") continue;
    const title = candidate.title;
    if (typeof (title == null ? void 0 : title.val) === "string" && title.val) return title.val;
  }
  return null;
}
async function listArchived(maxItems) {
  const store = await readStore();
  const archived = store.global.archivedSessionIds;
  const ids = archived.slice(Math.max(0, archived.length - maxItems)).reverse();
  const cache = await readCache();
  const pathToTitle = new Map(
    Object.values(store.tables.workspaces).map((record) => [record.path.toLowerCase(), record.title])
  );
  const out = [];
  for (const [index, id] of ids.entries()) {
    const entry = cache.get(id);
    const { dir, bytes } = await locate(id);
    const byOwnership = workspaceTitleOf(store, id);
    const workspace = byOwnership !== null ? byOwnership : (entry == null ? void 0 : entry.cwd) ? pathToTitle.get(entry.cwd.toLowerCase()) ?? entry.cwd : "未知工作区";
    out.push({
      id,
      title: (entry == null ? void 0 : entry.title) ?? "未命名会话",
      // 倒序遍历,位次从集合尾部往回数,故首条即最新归档的会话。
      order: archived.length - index,
      workspace,
      onDisk: dir !== null,
      bytes
    });
  }
  return out;
}
async function unarchive(sessionId) {
  const store = await readStore();
  if (!store.global.archivedSessionIds.includes(sessionId)) {
    return { ok: false, message: `会话 ${sessionId} 不在归档集合中` };
  }
  store.global.archivedSessionIds = store.global.archivedSessionIds.filter((id) => id !== sessionId);
  await writeStore(store);
  return { ok: true, message: `已取消归档 ${sessionId}；会话文件未被改动` };
}
async function remove(sessionId) {
  const store = await readStore();
  const { dir } = await locate(sessionId);
  const archived = store.global.archivedSessionIds.includes(sessionId);
  if (!archived && dir === null) {
    return { ok: false, message: `会话 ${sessionId} 既不在归档集合中，磁盘上也没有它的目录` };
  }
  store.global.archivedSessionIds = store.global.archivedSessionIds.filter((id) => id !== sessionId);
  for (const record of Object.values(store.tables.workspaces)) {
    record.sessionIds = record.sessionIds.filter((id) => id !== sessionId);
  }
  await writeStore(store);
  if (dir !== null) await rm(dir, { recursive: true, force: true });
  return {
    ok: true,
    message: `已彻底删除 ${sessionId}（归档标记、工作区引用${dir === null ? "" : "、磁盘目录"}）`
  };
}
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
const PREFIX = "/api/dsh-archive";
const DEFAULT_MAX_ITEMS$1 = 500;
function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 64 * 1024) {
        reject(new Error("请求体过大"));
        if (typeof req.destroy === "function") req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (raw.trim() === "") return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("请求体不是合法 JSON"));
      }
    });
    req.on("error", reject);
  });
}
function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": String(Buffer.byteLength(body))
  });
  res.end(body);
}
function project(maxItems) {
  return async () => {
    const sessions = await listArchived(maxItems);
    return {
      ok: true,
      total: sessions.length,
      onDisk: sessions.filter((s) => s.onDisk).length,
      bytes: sessions.reduce((sum, s) => sum + s.bytes, 0),
      sessions: sessions.map((s) => ({
        id: s.id,
        title: s.title,
        order: s.order,
        workspace: s.workspace,
        onDisk: s.onDisk,
        bytes: s.bytes
      }))
    };
  };
}
function registerPanel(ctx, config = {}) {
  const maxItems = config.maxItems ?? DEFAULT_MAX_ITEMS$1;
  async function handler(req, res) {
    const url = new URL(req.url ?? "/", "http://localhost");
    const method = String(req.method ?? "GET").toUpperCase();
    const sub = url.pathname.slice(PREFIX.length).replace(/\/+$/, "") || "/";
    try {
      if (method === "GET" && (sub === "/" || sub === "/sessions")) {
        return send(res, 200, await project(maxItems)());
      }
      if (method === "POST" && (sub === "/unarchive" || sub === "/remove")) {
        const body = await readJson(req);
        const id = typeof body.id === "string" ? body.id.trim() : "";
        if (id === "") return send(res, 400, { ok: false, error: "缺少会话 id" });
        const result = sub === "/remove" ? await remove(id) : await unarchive(id);
        return send(res, result.ok ? 200 : 404, result);
      }
      return send(res, 404, { ok: false, error: `未知接口：${sub}` });
    } catch (err) {
      send(res, 500, { ok: false, error: String((err == null ? void 0 : err.message) ?? err) });
    }
  }
  ctx.effect(
    () => ctx.webServer.register({ kind: "prefix", path: PREFIX, handler }),
    "dsh-archive-manager: api routes"
  );
}
const TEXT_OUTPUT = {
  schema: { type: "string" },
  render: (_args, value) => [{ type: "text", text: value }]
};
function paramsToJsonSchema(spec) {
  const properties = {};
  const required = [];
  for (const [key, def] of Object.entries(spec)) {
    properties[key] = {
      type: def.type,
      ...def.description === void 0 ? {} : { description: def.description }
    };
    if (def.required === true) required.push(key);
  }
  return {
    type: "object",
    properties,
    ...required.length === 0 ? {} : { required }
  };
}
function validateArgs(spec, args) {
  const value = args ?? {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("invalid arguments: 参数必须是对象");
  }
  const violations = [];
  for (const [key, def] of Object.entries(spec)) {
    const actual = value[key];
    if (actual === void 0 || actual === null) {
      if (def.required === true) violations.push(`${key}: 必填参数缺失`);
      continue;
    }
    if (def.type === "string" && typeof actual !== "string") {
      violations.push(`${key}: 期望 string，实际 ${typeof actual}`);
    }
  }
  if (violations.length > 0) throw new Error(`invalid arguments: ${violations.join("; ")}`);
}
function defineTool(options) {
  const parameters = paramsToJsonSchema(options.parameters);
  return {
    name: options.name,
    description: options.description,
    parameters,
    output: {
      schema: options.output.schema,
      render: options.output.render
    },
    ...options.isConcurrencySafe === void 0 ? {} : { isConcurrencySafe: options.isConcurrencySafe },
    async execute(args) {
      validateArgs(options.parameters, args);
      return options.execute(args);
    }
  };
}
const name = "dsh-archive-manager";
const inject = ["tools"];
const DEFAULT_MAX_ITEMS = 500;
function apply(ctx, config = {}) {
  const maxItems = config.maxItems ?? DEFAULT_MAX_ITEMS;
  ctx.inject(["webServer"], (ready) => {
    try {
      registerPanel(ready, { maxItems });
    } catch (err) {
      console.warn("[dsh-archive-manager] 设置分区接口注册失败，归档工具仍可用：" + String((err == null ? void 0 : err.message) ?? err));
    }
  });
  ctx.tools.register(defineTool({
    name: "list_archived_sessions",
    description: "List every archived DSH session, newest archived first, with its title, owning workspace, and disk usage.",
    parameters: {},
    output: TEXT_OUTPUT,
    isConcurrencySafe: () => true,
    execute: async () => {
      const sessions = await listArchived(maxItems);
      if (sessions.length === 0) return "当前没有已归档的会话。";
      const lines = sessions.map(
        (s) => `${String(s.order).padStart(3, " ")}. ${s.title}
     id: ${s.id}
     工作区: ${s.workspace}｜磁盘: ${s.onDisk ? formatBytes(s.bytes) : "目录已不存在"}`
      );
      return `共 ${sessions.length} 条归档会话：

${lines.join("\n")}`;
    }
  }));
  ctx.tools.register(defineTool({
    name: "unarchive_session",
    description: "Unarchive one session so it returns to its original position in the session list. Session files are never modified.",
    parameters: {
      session_id: { type: "string", required: true, description: "The archived session id to restore." }
    },
    output: TEXT_OUTPUT,
    execute: async (args) => {
      const result = await unarchive(args.session_id);
      return result.message;
    }
  }));
  ctx.tools.register(defineTool({
    name: "delete_archived_session",
    description: "Permanently delete one session: drop its archive mark and workspace reference, then remove its session directory from disk. This cannot be undone.",
    parameters: {
      session_id: { type: "string", required: true, description: "The session id to delete permanently." }
    },
    output: TEXT_OUTPUT,
    execute: async (args) => {
      const result = await remove(args.session_id);
      return result.message;
    }
  }));
}
export {
  apply,
  inject,
  name
};
//# sourceMappingURL=index.js.map
