# dsh-archive-manager

管理 DeepSeek Harness（DSH）归档会话的插件 + 设置页：列出、取消归档、彻底删除；支持勾选 + 全选批量恢复 / 批量删除（带逐条进度，单条失败不阻断批次）。

DSH 的「归档」是 `~/.dsh/storages/workspace.json` 中 `global.archivedSessionIds` 的一个 ID 集合，不移动、不删除任何会话文件——只是让界面把它们隐藏起来。

## 两条写入路径

运行中的 DSH 宿主把 workspace 状态**整个读进内存**（启动时读一次，之后内存权威、不再重读文件，也没有跨进程变更推送），直接改 `workspace.json` 只有重启后才被看见，且宿主下一次工作区写入会把内存状态整份写回，覆盖掉外部改动。因此本插件按可用性分两条路：

- **官方路径（默认）**：宿主的 `workspaceRegistry` 服务就绪后接入——取消归档调 `workspaceRegistry.unarchiveSession(id)`（幂等），删除复用 `unarchiveSession` + 各工作区实体的 `detachSession(id)`（幂等）摘掉记账槽；这条路写通内存、落盘和 GUI 投影事件，**还原立即在侧栏生效**，无需重启。
- **直写回退**：`workspaceRegistry` 不可用（老版宿主）时退回直写 `workspace.json`，写入采用「先写临时文件再改名」的原子方式；此时取消归档 / 删除**要重启 DSH 才生效**，且重启前避免任何归档 / 置顶 / 重命名 / 排序操作，否则改动会被宿主写回覆盖。

> 早期版本认为 DSH 只暴露 `archiveSession`、没有 unarchive API，是对编译产物的过时结论；`@deepseek-ai/dsh-api-workspace-controller` 明确提供 `unarchiveSession`（Remote `workspace/unarchiveSession`），内置侧栏的「取消归档」按钮走的就是它。

## 功能

| 工具 | 作用 |
|------|------|
| `list_archived_sessions` | 按归档倒序列出全部归档会话（最新归档在最前），含标题、所属工作区、磁盘占用 |
| `unarchive_session` | 取消归档；幂等，重复调用会被拒绝 |
| `delete_archived_session` | 彻底删除：清归档标记 + 工作区引用 + 磁盘目录 |

- 列表最多返回 500 条，配置项 `maxItems` 可调。
- 会话标题取自 `~/.dsh/storages/session_projcache/`；工作区名优先按归属反查，已被归档摘除的会话回退按其 `cwd` 解析。
- 设置页挂载为 DSH 设置分区（`settings.section`），数据经同源 API `/api/dsh-archive/*` 读写。

## 安装

桌面端 profile 由 Electron 应用独占管理，`dsh plugin --profile desktop` 会报 `profile "desktop" is managed exclusively by the Electron application`，需手工注册两处：

1. 把本目录链入 `~/.dsh/profiles/desktop/node_modules/dsh-archive-manager`
2. 在 `~/.dsh/profiles/desktop/package.json` 的 `dependencies` 与 `dsh.profile.bundles` 中分别加上 `dsh-archive-manager`

改完**重启 DSH** 才会加载。仓库自带已构建的 `dist/`，克隆后可直接装进 DSH，不装依赖也能跑。

## 注意事项

- ⚠️ 彻底删除会直接 `rm -rf` 会话目录，**不可恢复**，且没有回收站。
- 写入存储采用「先写临时文件再改名」的原子方式，避免 DSH 运行期间读到半截文件。
