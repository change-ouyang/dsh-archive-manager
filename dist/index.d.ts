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
export declare const name = "dsh-archive-manager";
/**
 * `tools` 是 DSH 宿主提供的服务；三个工具必须等它就绪才能注册。
 * 设置分区不依赖它，缺席时只是少一个页面。
 */
export declare const inject: string[];
export interface Config {
    /** 列表最多返回多少条归档会话，默认 500。 */
    maxItems?: number;
}
/**
 * 宿主侧可用的 cordis Context 子集。
 *
 * 刻意不 `import type { Context }`：那会把 @deepseek-ai/cordis 写进类型依赖，
 * 而它同样是 DSH 内部包，克隆后 `tsc` 会因为找不到声明而失败。
 * 这里只声明本插件真正用到的两个成员，运行时由宿主注入。
 */
interface HostContext {
    inject: (deps: string[], callback: (ready: Record<string, unknown>) => void) => void;
    tools: {
        register: (definition: unknown) => unknown;
    };
}
/** 注册三个归档维护工具，并挂载设置分区所需的同源 API。 */
export declare function apply(ctx: HostContext, config?: Config): void;
export {};
