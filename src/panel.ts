/**
 * 归档管理面板的宿主半身：同源 API 路由。
 *
 * 浏览器半身是 `client.ts`，通过 package.json 的 `exports["./client"]` +
 * `dsh.client` 声明挂载为一个**设置分区**（`settings.section` 槽），
 * 不是悬浮按钮。
 *
 * 数据同源走 `/api/dsh-archive/*`，因此浏览器里不接触任何本地路径，
 * 也不需要 CORS。HTTP 状态码承载语义：2xx 成功，404 会话不在归档集合中，
 * 500 读取或写入失败。
 */

import { listArchived, remove, unarchive } from './archive'

export const PREFIX = '/api/dsh-archive'

/** 列表最多返回多少条归档会话。 */
const DEFAULT_MAX_ITEMS = 500

export interface PanelConfig {
  maxItems?: number
}

/** 读取请求体，带上限。 */
function readJson(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > 64 * 1024) {
        reject(new Error('请求体过大'))
        if (typeof req.destroy === 'function') req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (raw.trim() === '') return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new Error('请求体不是合法 JSON'))
      }
    })
    req.on('error', reject)
  })
}

function send(res: any, status: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': String(Buffer.byteLength(body)),
  })
  res.end(body)
}

/** 把 React 组件要用的字段裁剪成最小投影。 */
function project(maxItems: number) {
  return async () => {
    const sessions = await listArchived(maxItems)
    return {
      ok: true,
      total: sessions.length,
      onDisk: sessions.filter(s => s.onDisk).length,
      bytes: sessions.reduce((sum, s) => sum + s.bytes, 0),
      sessions: sessions.map(s => ({
        id: s.id,
        title: s.title,
        order: s.order,
        workspace: s.workspace,
        onDisk: s.onDisk,
        bytes: s.bytes,
      })),
    }
  }
}

/**
 * 注册同源 API。`webServer` 是可选设施，拿不到时只是没有界面，
 * 工具本身仍可用（工具走的是完全不同的通道）。
 */
export function registerPanel(ctx: any, config: PanelConfig = {}): void {
  const maxItems = config.maxItems ?? DEFAULT_MAX_ITEMS

  async function handler(req: any, res: any): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const method = String(req.method ?? 'GET').toUpperCase()
    const sub = url.pathname.slice(PREFIX.length).replace(/\/+$/, '') || '/'

    try {
      // 列表
      if (method === 'GET' && (sub === '/' || sub === '/sessions')) {
        return send(res, 200, await project(maxItems)())
      }

      // 取消归档 / 彻底删除
      if (method === 'POST' && (sub === '/unarchive' || sub === '/remove')) {
        const body = await readJson(req)
        const id = typeof body.id === 'string' ? body.id.trim() : ''
        if (id === '') return send(res, 400, { ok: false, error: '缺少会话 id' })
        const result = sub === '/remove' ? await remove(id) : await unarchive(id)
        return send(res, result.ok ? 200 : 404, result)
      }

      return send(res, 404, { ok: false, error: `未知接口：${sub}` })
    } catch (err) {
      send(res, 500, { ok: false, error: String((err as Error)?.message ?? err) })
    }
  }

  // `scoped.effect` 让注销跟随作用域，避免重复 apply 时泄漏路由。
  ctx.effect(
    () => ctx.webServer.register({ kind: 'prefix', path: PREFIX, handler }),
    'dsh-archive-manager: api routes',
  )
}
