/**
 * 归档会话的查询与维护操作。
 *
 * DSH 的真实归档机制（核对自 packages/workspace/workspace/src/spec.ts）：
 *   - 归档集合是 workspace 域全局状态里的 `archivedSessionIds: SessionId[]`，
 *     持久化在 ~/.dsh/storages/workspace.json 的 `global` 段。
 *   - 归档**不移动、不删除**任何会话文件；会话磁盘目录保持原样，
 *     仅靠该集合把会话从各列表与分组界面过滤掉。
 *   - 归档后 `sessionIds` 槽位保留，因此恢复时位置自动回到原处。
 *
 * 关键限制（已核对源码）：DSH 只暴露 `workspaces.archiveSession(id)`，
 * 既没有 unarchive API，也没有删除单个会话的 API。因此本模块：
 *   - 恢复 = 从 archivedSessionIds 移除（等价于框架注释中的 "unarchiving"）。
 *   - 删除 = 摘除归档标记与工作区引用，并删除磁盘会话目录（不可逆）。
 */
/** 一条归档会话的可读投影。 */
export interface ArchivedSession {
    id: string;
    title: string;
    /**
     * 归档位次（1 起，越大越新）。集合不记录时间，故以追加顺序代替归档时间；
     * 列表按该值降序呈现，因此首条就是最新归档的会话。
     */
    order: number;
    workspace: string;
    /** 会话目录是否仍在磁盘上。 */
    onDisk: boolean;
    bytes: number;
}
/**
 * 列出归档会话，**最新归档的排在最前**。
 *
 * 归档集合按归档先后追加（新的进尾部），所以这里取尾部若干条再反转：
 * 既让最新归档的会话占据列表首位，也让 `maxItems` 截断掉的是最旧的记录。
 */
export declare function listArchived(maxItems: number): Promise<ArchivedSession[]>;
/** 取消归档：仅从集合移除，磁盘与会话内容完全不动。 */
export declare function unarchive(sessionId: string): Promise<{
    ok: boolean;
    message: string;
}>;
/** 彻底删除：摘除归档标记与工作区引用，再删磁盘目录。 */
export declare function remove(sessionId: string): Promise<{
    ok: boolean;
    message: string;
}>;
/** 把字节数渲染成人读形式。 */
export declare function formatBytes(bytes: number): string;
