/**
 * dsh-archive-manager：列出、恢复与彻底删除 DSH 归档会话。
 *
 * 之所以直接操作存储而非调用框架 API，是因为 DSH 只暴露了 archiveSession，
 * 没有 unarchive 与删除会话的 API（核对自 packages/workspace/workspace/src）。
 * 详见 archive.ts 顶部说明。
 *
 * 对外提供两套入口：三个工具（由模型调用）与一个右下角面板（由用户点击），
 * 二者共用 archive.ts 的同一套实现。
 *
 * @module dsh-archive-manager
 */

import { formatBytes, listArchived, remove, unarchive } from './archive'
import { registerPanel } from './panel'
// 自实现的 defineTool —— 不依赖 @deepseek-ai/dsh-tools，理由见 tool-kit.ts 顶部。
import { TEXT_OUTPUT, defineTool } from './tool-kit'

export const name = 'dsh-archive-manager'

/**
 * `tools` 是 DSH 宿主提供的服务；三个工具必须等它就绪才能注册。
 * 设置分区不依赖它，缺席时只是少一个页面。
 */
export const inject = ['tools']

export interface Config {
  /** 列表最多返回多少条归档会话，默认 500。 */
  maxItems?: number
}

const DEFAULT_MAX_ITEMS = 500

/**
 * 宿主侧可用的 cordis Context 子集。
 *
 * 刻意不 `import type { Context }`：那会把 @deepseek-ai/cordis 写进类型依赖，
 * 而它同样是 DSH 内部包，克隆后 `tsc` 会因为找不到声明而失败。
 * 这里只声明本插件真正用到的两个成员，运行时由宿主注入。
 */
interface HostContext {
  inject: (deps: string[], callback: (ready: Record<string, unknown>) => void) => void
  tools: { register: (definition: unknown) => unknown }
}

/** 注册三个归档维护工具，并挂载设置分区所需的同源 API。 */
export function apply(ctx: HostContext, config: Config = {}): void {
  const maxItems = config.maxItems ?? DEFAULT_MAX_ITEMS

  // 设置分区的数据接口等 webServer 就绪；失败不影响工具本身。
  ctx.inject(['webServer'], (ready) => {
    try {
      registerPanel(ready, { maxItems })
    } catch (err) {
      console.warn('[dsh-archive-manager] 设置分区接口注册失败，归档工具仍可用：' + String((err as Error)?.message ?? err))
    }
  })

  ctx.tools.register(defineTool({
    name: 'list_archived_sessions',
    description:
      'List every archived DSH session, newest archived first, with its title, owning workspace, and disk usage.',
    parameters: {},
    output: TEXT_OUTPUT,
    isConcurrencySafe: () => true,
    execute: async () => {
      const sessions = await listArchived(maxItems)
      if (sessions.length === 0) return '当前没有已归档的会话。'
      const lines = sessions.map(s =>
        `${String(s.order).padStart(3, ' ')}. ${s.title}\n`
        + `     id: ${s.id}\n`
        + `     工作区: ${s.workspace}｜磁盘: ${s.onDisk ? formatBytes(s.bytes) : '目录已不存在'}`,
      )
      return `共 ${sessions.length} 条归档会话：\n\n${lines.join('\n')}`
    },
  }))

  ctx.tools.register(defineTool({
    name: 'unarchive_session',
    description:
      'Unarchive one session so it returns to its original position in the session list. Session files are never modified.',
    parameters: {
      session_id: { type: 'string', required: true, description: 'The archived session id to restore.' },
    },
    output: TEXT_OUTPUT,
    execute: async (args: { session_id: string }) => {
      const result = await unarchive(args.session_id)
      return result.message
    },
  }))

  ctx.tools.register(defineTool({
    name: 'delete_archived_session',
    description:
      'Permanently delete one session: drop its archive mark and workspace reference, then remove its session directory from disk. This cannot be undone.',
    parameters: {
      session_id: { type: 'string', required: true, description: 'The session id to delete permanently.' },
    },
    output: TEXT_OUTPUT,
    execute: async (args: { session_id: string }) => {
      const result = await remove(args.session_id)
      return result.message
    },
  }))
}
