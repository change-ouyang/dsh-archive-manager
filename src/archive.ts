/**
 * 归档会话的查询与维护操作。
 *
 * DSH 的真实归档机制（核对自 @deepseek-ai/dsh-workspace 编译产物）：
 *   - 归档集合是 workspace 域全局状态里的 `archivedSessionIds: SessionId[]`，
 *     持久化在 ~/.dsh/storages/workspace.json 的 `global` 段。
 *   - 归档**不移动、不删除**任何会话文件；会话磁盘目录保持原样，
 *     仅靠该集合把会话从各列表与分组界面过滤掉。
 *   - 归档后 `sessionIds` 槽位保留，因此恢复时位置自动回到原处。
 *
 * 两条写入路径（见 setWorkspaceRegistry）：
 *   - **官方路径**（registry 可用时）：workspaceRegistry.unarchiveSession(id)
 *     与实体 detachSession(id) 幂等、写通内存 + 落盘 + GUI 投影事件，
 *     还原立即在界面上生效。
 *   - **回退路径**（直写文件）：宿主内存是权威、只在启动时读取一次该文件，
 *     也没有跨进程变更推送（storage-domain 已知限制），所以直写的改动
 *     要重启 DSH 才可见，且重启前宿主的任何工作区写入都会把它覆盖回去。
 *     仅作 registry 缺席时的兜底。
 *
 *   - 删除 = 摘除归档标记与工作区记账槽，并删除磁盘会话目录（不可逆）；
 *     DSH 没有「删除会话」的官方 API，记账槽的摘除复用 detachSession。
 */

import { readFile, writeFile, rename, rm, readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

/** 会话磁盘布局：~/.dsh/sessions/<project-slug>/<session-id>/session.jsonl.zstd */
const SESSIONS_ROOT = join(homedir(), '.dsh', 'sessions')
/** 归档集合与工作区记录的权威存储。 */
const WORKSPACE_STORE = join(homedir(), '.dsh', 'storages', 'workspace.json')
/** 会话索引缓存，标题来源。 */
const TITLE_CACHE = join(homedir(), '.dsh', 'storages', 'session_projcache', 'sessions')

interface WorkspaceRecord {
  path: string
  title: string
  sessionIds: string[]
  createdAt: string
  updatedAt: string
}

interface WorkspaceStore {
  unit: { name: string; version: number }
  global: {
    initialized: boolean
    workspaceIds: string[]
    archivedSessionIds: string[]
    pinnedSessionIds?: string[]
  }
  tables: { workspaces: Record<string, WorkspaceRecord> }
}

/** 官方 Workspace 实体的最小切面（detachSession 幂等，非属主为无害空操作）。 */
export interface WorkspaceEntityLike {
  detachSession(sessionId: string): Promise<unknown>
}

/** 官方 workspaceRegistry 服务的最小切面（@deepseek-ai/dsh-workspace）。 */
export interface WorkspaceRegistryLike {
  /** registry 全局归档集合（内存权威值，同步读取）。 */
  readonly archivedSessionIds: readonly string[]
  unarchiveSession(sessionId: string): Promise<unknown>
  list(): readonly WorkspaceEntityLike[]
}

/**
 * 宿主注入的官方注册表；index.ts 在 `workspaceRegistry` 服务就绪时接线。
 * 置位后取消归档/删除走权威路径，未置位时退回直写文件。
 */
let registry: WorkspaceRegistryLike | null = null

export function setWorkspaceRegistry(value: WorkspaceRegistryLike | null): void {
  registry = value
}

/** 一条归档会话的可读投影。 */
export interface ArchivedSession {
  id: string
  title: string
  /**
   * 归档位次（1 起，越大越新）。集合不记录时间，故以追加顺序代替归档时间；
   * 列表按该值降序呈现，因此首条就是最新归档的会话。
   */
  order: number
  workspace: string
  /** 会话目录是否仍在磁盘上。 */
  onDisk: boolean
  bytes: number
}

/** 读取 workspace 域状态；文件缺失或损坏时给出可读错误。 */
async function readStore(): Promise<WorkspaceStore> {
  if (!existsSync(WORKSPACE_STORE)) throw new Error(`找不到 workspace 存储：${WORKSPACE_STORE}`)
  const raw = await readFile(WORKSPACE_STORE, 'utf8')
  try {
    return JSON.parse(raw) as WorkspaceStore
  } catch {
    throw new Error(`workspace 存储不是合法 JSON：${WORKSPACE_STORE}`)
  }
}

/** 原子写入：先落临时文件再改名，避免 DSH 运行中读到半截文件。 */
async function writeStore(store: WorkspaceStore): Promise<void> {
  const tmp = `${WORKSPACE_STORE}.tmp-${process.pid}`
  await writeFile(tmp, `${JSON.stringify(store, null, 2)}\n`, 'utf8')
  await rename(tmp, WORKSPACE_STORE)
}

/** 反查会话所属工作区标题；无归属时返回 null 以便调用方回退。 */
function workspaceTitleOf(store: WorkspaceStore, sessionId: string): string | null {
  for (const record of Object.values(store.tables.workspaces)) {
    if (record.sessionIds.includes(sessionId)) return record.title
  }
  return null
}

/** 定位会话目录与占用；会话可能已被手工删除，故允许缺失。 */
async function locate(sessionId: string): Promise<{ dir: string | null; bytes: number }> {
  let slugs: string[]
  try {
    slugs = await readdir(SESSIONS_ROOT)
  } catch {
    return { dir: null, bytes: 0 }
  }
  for (const slug of slugs) {
    const dir = join(SESSIONS_ROOT, slug, sessionId)
    if (!existsSync(dir)) continue
    let bytes = 0
    try {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (!entry.isFile()) continue
        try {
          bytes += (await stat(join(dir, entry.name))).size
        } catch {
          /* 单文件不可读时忽略 */
        }
      }
    } catch {
      /* 目录不可读时按 0 计 */
    }
    return { dir, bytes }
  }
  return { dir: null, bytes: 0 }
}

/** 会话缓存里的标题与原始工作目录。 */
interface CacheEntry {
  title: string | null
  cwd: string | null
}

/** 从会话缓存索引读取 id → {标题, cwd} 映射。 */
async function readCache(): Promise<Map<string, CacheEntry>> {
  const map = new Map<string, CacheEntry>()
  let files: string[]
  try {
    files = await readdir(TITLE_CACHE)
  } catch {
    return map
  }
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    try {
      const data = JSON.parse(await readFile(join(TITLE_CACHE, file), 'utf8')) as {
        // `record.rows` 就是那一行本身（字段为 title/tokenUsage/...），
        // 不是行数组；此处两种形态都兼容，避免缓存版本差异导致漏读。
        record?: { rows?: unknown; identity?: { cwd?: unknown } }
      }
      const cwd = data.record?.identity?.cwd
      map.set(file.replace(/\.json$/, ''), {
        title: readRowTitle(data.record?.rows),
        cwd: typeof cwd === 'string' && cwd ? cwd : null,
      })
    } catch {
      /* 单条缓存损坏不影响其余条目 */
    }
  }
  return map
}

/**
 * 从 `record.rows` 中取出标题值。
 *
 * 磁盘上 `rows` 是**单行对象**（形如 `{ title: {val}, tokenUsage: {...} }`），
 * 但也容忍行数组或按序号键控的对象，以免缓存格式演进后静默失效。
 */
function readRowTitle(rows: unknown): string | null {
  if (rows === null || typeof rows !== 'object') return null
  const candidates: unknown[] = Array.isArray(rows)
    ? [rows[0]]
    : [(rows as Record<string, unknown>)['0'] ?? rows]
  for (const candidate of candidates) {
    if (candidate === null || typeof candidate !== 'object') continue
    const title = (candidate as { title?: { val?: unknown } }).title
    if (typeof title?.val === 'string' && title.val) return title.val
  }
  return null
}

/**
 * 列出归档会话，**最新归档的排在最前**。
 *
 * 归档集合按归档先后追加（新的进尾部），所以这里取尾部若干条再反转：
 * 既让最新归档的会话占据列表首位，也让 `maxItems` 截断掉的是最旧的记录。
 */
export async function listArchived(maxItems: number): Promise<ArchivedSession[]> {
  const store = await readStore()
  const archived = store.global.archivedSessionIds
  const ids = archived.slice(Math.max(0, archived.length - maxItems)).reverse()
  const cache = await readCache()
  // 会话被归档并从 sessionIds 摘除后无法反查工作区，此时用 cwd 目录名兜底。
  const pathToTitle = new Map(
    Object.values(store.tables.workspaces).map(record => [record.path.toLowerCase(), record.title]),
  )

  const out: ArchivedSession[] = []
  for (const [index, id] of ids.entries()) {
    const entry = cache.get(id)
    const { dir, bytes } = await locate(id)
    const byOwnership = workspaceTitleOf(store, id)
    const workspace = byOwnership !== null
      ? byOwnership
      : entry?.cwd
        ? pathToTitle.get(entry.cwd.toLowerCase()) ?? entry.cwd
        : '未知工作区'
    out.push({
      id,
      title: entry?.title ?? '未命名会话',
      // 倒序遍历,位次从集合尾部往回数,故首条即最新归档的会话。
      order: archived.length - index,
      workspace,
      onDisk: dir !== null,
      bytes,
    })
  }
  return out
}

/** 取消归档：仅从归档集合移除，磁盘与会话内容完全不动。 */
export async function unarchive(sessionId: string): Promise<{ ok: boolean; message: string }> {
  if (registry !== null) {
    if (!registry.archivedSessionIds.includes(sessionId)) {
      return { ok: false, message: `会话 ${sessionId} 不在归档集合中` }
    }
    await registry.unarchiveSession(sessionId)
    return { ok: true, message: `已取消归档 ${sessionId}；侧栏会话列表即时生效` }
  }
  // 回退：直写存储文件。宿主内存权威且不重读该文件，改动要重启 DSH 才可见。
  const store = await readStore()
  if (!store.global.archivedSessionIds.includes(sessionId)) {
    return { ok: false, message: `会话 ${sessionId} 不在归档集合中` }
  }
  store.global.archivedSessionIds = store.global.archivedSessionIds.filter(id => id !== sessionId)
  await writeStore(store)
  return { ok: true, message: `已取消归档 ${sessionId}（直写存储，重启 DSH 后生效）；会话文件未被改动` }
}

/** 彻底删除：摘除归档标记与工作区记账槽，再删磁盘目录。 */
export async function remove(sessionId: string): Promise<{ ok: boolean; message: string }> {
  const { dir } = await locate(sessionId)
  if (registry !== null) {
    if (!registry.archivedSessionIds.includes(sessionId) && dir === null) {
      return { ok: false, message: `会话 ${sessionId} 既不在归档集合中，磁盘上也没有它的目录` }
    }
    await registry.unarchiveSession(sessionId)
    // detachSession 幂等：非属主工作区是无害空操作，逐个调用即完成全局摘除。
    for (const entity of registry.list()) await entity.detachSession(sessionId)
    if (dir !== null) await rm(dir, { recursive: true, force: true })
    return {
      ok: true,
      message: `已彻底删除 ${sessionId}（归档标记、工作区引用${dir === null ? '' : '、磁盘目录'}）`,
    }
  }
  // 回退：直写存储文件 + 删目录（同 unarchive 回退路径的重启才可见问题）。
  const store = await readStore()
  const archived = store.global.archivedSessionIds.includes(sessionId)
  if (!archived && dir === null) {
    return { ok: false, message: `会话 ${sessionId} 既不在归档集合中，磁盘上也没有它的目录` }
  }
  store.global.archivedSessionIds = store.global.archivedSessionIds.filter(id => id !== sessionId)
  for (const record of Object.values(store.tables.workspaces)) {
    record.sessionIds = record.sessionIds.filter(id => id !== sessionId)
  }
  await writeStore(store)
  if (dir !== null) await rm(dir, { recursive: true, force: true })
  return {
    ok: true,
    message: `已彻底删除 ${sessionId}（归档标记、工作区引用${dir === null ? '' : '、磁盘目录'}；直写存储，重启 DSH 后生效）`,
  }
}

/** 把字节数渲染成人读形式。 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
