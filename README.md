# dsh-archive-manager

管理 DeepSeek Harness 的归档会话：列出、取消归档、彻底删除。

## 它是怎么工作的

DSH 的「归档」不是会话的一个字段，而是 workspace 域全局状态里的一个 ID 集合：

```
C:\Users\<你的用户名>\.dsh\storages\workspace.json
  └─ global.archivedSessionIds: ["session-xxx", ...]
```

归档**不移动、不删除**任何会话文件——会话目录原样留在
`~/.dsh/sessions/<项目>/<会话ID>/` 下，只是这个集合让界面把它们隐藏起来。
归档后 `sessionIds` 里的槽位会保留，所以取消归档时位置自动回到原处。

### 为什么直接操作存储

DSH 只暴露了 `workspaces.archiveSession(id)`，**没有**取消归档的 API，
也**没有**删除单个会话的 API（核对自 `packages/workspace/workspace/src`，
其中 `spec.ts` 的注释把 unarchiving 描述为尚未实现的目标）。

因此本插件：

- **取消归档** = 从 `archivedSessionIds` 中移除该 ID（会话文件不动）
- **彻底删除** = 摘除归档标记与工作区引用，再删除磁盘上的会话目录

写入采用「先写临时文件再改名」的原子方式，避免 DSH 运行期间读到半截文件。

> ⚠️ 删除会直接 `rm -rf` 会话目录，**不可恢复**，且没有回收站。

## 提供的工具

| 工具 | 作用 |
|------|------|
| `list_archived_sessions` | 按归档倒序列出全部归档会话（最新归档在最前），含标题、所属工作区、磁盘占用 |
| `unarchive_session` | 取消归档，会话回到列表原位置；幂等，重复调用会被拒绝 |
| `delete_archived_session` | 彻底删除：清归档标记 + 工作区引用 + 磁盘目录 |

会话标题取自 `~/.dsh/storages/session_projcache/`，工作区名优先按归属反查，
被归档后已从 `sessionIds` 摘除的会话则回退到其 `cwd` 解析。

## 配置

```yaml
dsh-archive-manager:
  maxItems: 500   # 列表最多返回多少条，默认 500
```

## 安装

桌面端 profile 由 Electron 应用独占管理，`dsh plugin --profile desktop` 会报
`profile "desktop" is managed exclusively by the Electron application`，
所以需要手工注册两处：

1. 把本目录链入 `~/.dsh/profiles/desktop/node_modules/dsh-archive-manager`
2. 在 `~/.dsh/profiles/desktop/package.json` 的 `dependencies` 与
   `dsh.profile.bundles` 中分别加上 `dsh-archive-manager`

改完**重启 DSH** 才会加载。

## 开发

```bash
npm install
npm run build         # 两套产物：宿主 dist/index.js + 浏览器 dist/client.js
npm run build:host    # 只构建宿主（ESM，Node 侧）
npm run build:client  # 只构建浏览器半身（IIFE，ModuleLoader 包）
npm run typecheck     # 宿主与浏览器两套 tsconfig 都检查
```

仓库里 `dist/` 是**已构建**的产物，克隆后可直接装进 DSH 使用，不装依赖也能跑。

构建要点（`vite.config.ts` 里有注释）：

- 宿主侧用 lib 模式输出 ESM，`node:*` 与 `@deepseek-ai/*` 全部外部化 ——
  它们由 DSH 进程或 Node 提供，打进产物会出问题；
- 浏览器半身必须输出 **IIFE**（无 `import`/`export`）：它是手写的
  `window.__ModuleLoader__.load({...})` 包，出现 ESM 语法会被 ModuleLoader 拒绝；
- `react` **不作为依赖声明**：由 ModuleLoader 在运行时注入，声明了反而会
  逼使用者装一份、并可能与宿主版本冲突。类型用 `src/react-like.ts` 手写。
