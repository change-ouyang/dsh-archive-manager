import { Context } from '@deepseek-ai/cordis';

export declare const name = "dsh-archive-manager";
/**
 * `tools` 是本插件自带依赖提供的服务（宿主 asar 里没有 dsh-tools），
 * 三个工具必须等它就绪才能注册；设置分区不依赖它，缺席时只是少一个页面。
 */
export declare const inject: string[];
export interface Config {
    /** 列表最多返回多少条归档会话，默认 500。 */
    maxItems?: number;
}
/** 注册三个归档维护工具，并挂载设置分区所需的同源 API。 */
export declare function apply(ctx: Context, config?: Config): void;
