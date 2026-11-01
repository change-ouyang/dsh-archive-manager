# dsh-archive-manager

管理 DeepSeek Harness（DSH）归档会话的插件 + 设置页：列出、取消归档、彻底删除。

DSH 的「归档」是 `~/.dsh/storages/workspace.json` 中 `global.archivedSessionIds` 的一个 ID 集合，
不移动、不删除任何会话文件——只是让界面把它们隐藏起来。因此本插件直接操作该存储：

- **取消归档** = 从 `archivedSessionIds` 移除该 ID，会话回到列表原位置（文件不动）
- **彻底删除** = 摘除归档标记与工作区引用，再删除磁盘上的会话目录

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
