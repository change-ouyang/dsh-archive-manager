/**
 * 工具定义的**最小自实现**，用来替掉 `@deepseek-ai/dsh-tools` 的 `defineTool`。
 *
 * 为什么不用那个包：它是 DSH 的内部包（`0.2.1-rc.2`），既不在公共 npm 上
 * 与 DSH 版本对齐，也不会随 `npm install` 被装进来 —— `peerDependencies`
 * 不会自动安装。结果是别人克隆本仓库后，宿主侧第一行 `import` 就抛
 * `ERR_MODULE_NOT_FOUND`，三个工具全部注册不上。
 *
 * `defineTool` 实际只做三件事（核对自 dsh-tools 的 `lib/index.js`）：
 *   1. 把简写的参数规格编译成 JSON Schema；
 *   2. 用 `validateJsonSchemaValue` 在 execute 前校验模型给的参数；
 *   3. 把 output.render 原样挂到工具定义上。
 *
 * 第 1、3 步是纯数据搬运，第 2 步这里用一个够用的校验器实现 —— 参数只有
 * 「一个必填 string」和「空对象」两种形态，不需要通用 JSON Schema 引擎。
 *
 * `ctx.tools.register` 要求的形状（同源核对）：
 *   { name, description, parameters: <object schema>, output: { schema, render }, execute }
 */

/** 工具参数：简写规格。目前只用到 string，且可标必填。 */
export interface ParamSpec {
  type: 'string'
  required?: boolean
  description?: string
}

export type ParamSpecMap = Record<string, ParamSpec>

/** 工具的返回类型：统一是字符串文本。 */
export const TEXT_OUTPUT = {
  schema: { type: 'string' as const },
  render: (_args: unknown, value: string) => [{ type: 'text' as const, text: value }],
}

/** 简写参数规格 → JSON Schema object。 */
export function paramsToJsonSchema(spec: ParamSpecMap): {
  type: 'object'
  properties: Record<string, { type: string; description?: string }>
  required?: string[]
} {
  const properties: Record<string, { type: string; description?: string }> = {}
  const required: string[] = []
  for (const [key, def] of Object.entries(spec)) {
    properties[key] = {
      type: def.type,
      ...(def.description === undefined ? {} : { description: def.description }),
    }
    if (def.required === true) required.push(key)
  }
  return {
    type: 'object',
    properties,
    ...(required.length === 0 ? {} : { required }),
  }
}

/**
 * 按参数规格校验一次调用。
 *
 * 规则与 dsh-tools 的 `validateJsonSchemaValue` 对这两种形态的行为一致：
 * 必填缺失 → 报错；类型不符 → 报错。报错信息带字段名，便于模型自我修正。
 *
 * 抛错而不返回错误码：调用方（工具注册表）把异常转成 `INVALID_ARGS`。
 */
export function validateArgs(spec: ParamSpecMap, args: unknown): void {
  const value = (args ?? {}) as Record<string, unknown>
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('invalid arguments: 参数必须是对象')
  }
  const violations: string[] = []
  for (const [key, def] of Object.entries(spec)) {
    const actual = value[key]
    if (actual === undefined || actual === null) {
      if (def.required === true) violations.push(`${key}: 必填参数缺失`)
      continue
    }
    if (def.type === 'string' && typeof actual !== 'string') {
      violations.push(`${key}: 期望 string，实际 ${typeof actual}`)
    }
  }
  if (violations.length > 0) throw new Error(`invalid arguments: ${violations.join('; ')}`)
}

/** `defineTool` 的零依赖替代：编译参数、包装 execute 做校验、透传 output。 */
export function defineTool<A>(options: {
  name: string
  description: string
  parameters: ParamSpecMap
  output: typeof TEXT_OUTPUT
  isConcurrencySafe?: () => boolean
  execute: (args: A) => Promise<string> | string
}) {
  const parameters = paramsToJsonSchema(options.parameters)
  return {
    name: options.name,
    description: options.description,
    parameters,
    output: {
      schema: options.output.schema,
      render: options.output.render,
    },
    ...(options.isConcurrencySafe === undefined
      ? {}
      : { isConcurrencySafe: options.isConcurrencySafe }),
    async execute(args: A) {
      validateArgs(options.parameters, args)
      return options.execute(args)
    },
  }
}
