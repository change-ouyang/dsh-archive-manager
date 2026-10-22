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
export declare const PREFIX = "/api/dsh-archive";
export interface PanelConfig {
    maxItems?: number;
}
/**
 * 注册同源 API。`webServer` 是可选设施，拿不到时只是没有界面，
 * 工具本身仍可用（工具走的是完全不同的通道）。
 */
export declare function registerPanel(ctx: any, config?: PanelConfig): void;
