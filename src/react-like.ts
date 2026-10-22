/**
 * 浏览器半身只需要 React 的极小子集 —— 这就是那个子集的类型形状。
 *
 * 为什么不直接 `import type React from 'react'`：
 *   DSH 客户端把 `react` 通过 ModuleLoader 的 `require` 注入，本包**不声明**
 *   react 依赖(声明了会逼使用者装一份，还可能装成和宿主不同的版本)。
 *   所以这里手写所需 API 的最小类型，`require('react') as ReactLike`。
 *
 * 这些声明在编译后被完全擦除，不影响产物。
 */

/** React 元素（`h(...)` 的返回值）。渲染由宿主负责。 */
export interface ReactLikeNode {
  readonly type: unknown
  readonly props: unknown
  readonly key: string | null
}

/** 状态更新：可直接给新值，也可给 `(prev) => next` 函数。 */
export type SetState<T> = (value: T | ((prev: T) => T)) => void

export interface ReactLike {
  createElement: (
    type: unknown,
    props?: Record<string, unknown> | null,
    ...children: unknown[]
  ) => ReactLikeNode
  Fragment: unknown
  useState: <S>(initial: S | (() => S)) => [S, SetState<S>]
  useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => void
  useCallback: <F extends (...args: never[]) => unknown>(fn: F, deps?: readonly unknown[]) => F
  useMemo: <T>(factory: () => T, deps?: readonly unknown[]) => T
  useRef: <T>(initial: T) => { current: T }
}
