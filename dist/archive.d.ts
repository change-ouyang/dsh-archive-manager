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
/** 官方 Workspace 实体的最小切面（detachSession 幂等，非属主为无害空操作）。 */
export interface WorkspaceEntityLike {
    detachSession(sessionId: string): Promise<unknown>;
}
/** 官方 workspaceRegistry 服务的最小切面（@deepseek-ai/dsh-workspace）。 */
export interface WorkspaceRegistryLike {
    /** registry 全局归档集合（内存权威值，同步读取）。 */
    readonly archivedSessionIds: readonly string[];
    unarchiveSession(sessionId: string): Promise<unknown>;
    list(): readonly WorkspaceEntityLike[];
}
export declare function setWorkspaceRegistry(value: WorkspaceRegistryLike | null): void;
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
/** 取消归档：仅从归档集合移除，磁盘与会话内容完全不动。 */
export declare function unarchive(sessionId: string): Promise<{
    ok: boolean;
    message: string;
}>;
/** 彻底删除：摘除归档标记与工作区记账槽，再删磁盘目录。 */
export declare function remove(sessionId: string): Promise<{
    ok: boolean;
    message: string;
}>;
/** 把字节数渲染成人读形式。 */
export declare function formatBytes(bytes: number): string;
