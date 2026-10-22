/**
 * 两套产物，两个模式：
 *
 *   vite build                  → 宿主半身 dist/index.js（ESM，Node 侧运行）
 *   vite build --mode client    → 浏览器半身 dist/client.js（IIFE，无 import/export）
 *
 * 为什么两边都要 lib 模式而不是常规 HTML 打包：
 *   - 宿主那半是 DSH 进程里 `import()` 的模块，必须保留 ESM 的 import/export，
 *     且 `node:*` 与 `@deepseek-ai/*` 一律外部化（由宿主提供，不能打进产物）；
 *   - 浏览器那半是手写的 ModuleLoader 包（看清 src/client.ts 顶部），产物是
 *     一段**直接执行**的脚本，出现任何 ESM 语法都会让 ModuleLoader 拒绝加载。
 *     所以 client 侧用 iife 格式、不产出任何 export；
 *   - `@deepseek-ai/cordis` 只作类型引入（`import type`），编译后被擦除，
 *     因此不必在 rollupOptions.external 里为它做运行时处理，但保持外部化更稳。
 */
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { resolve } from 'node:path'

/** 宿主侧不打进产物、运行时由宿主或 Node 提供的模块。 */
const HOST_EXTERNAL = [
  /^node:/,
  /^@deepseek-ai\//,
]

export default defineConfig(({ mode }) => {
  if (mode === 'client') {
    return {
      build: {
        outDir: 'dist',
        // 产物名固定为 client.js：package.json 的 exports["./client"] 指向它，
        // DSH 客户端按这个路径取浏览器半身，不能带 hash。
        emptyOutDir: false,
        // 不产出 .d.ts（浏览器半身没有对外类型），也不生成 HTML。
        lib: {
          entry: resolve(__dirname, 'src/client.ts'),
          formats: ['iife'],
          name: 'DshArchiveManagerClient',
          fileName: () => 'client.js',
        },
        rollupOptions: {
          // client.ts 里没有 import，理论上无需 external；
          // 留空对象即可（react 由 ModuleLoader 的 require 注入，不进打包）。
          external: [],
        },
        // 保留 sourcemap：本仓库的源码恢复依赖它，且方便在 DSH 里排查。
        sourcemap: true,
        minify: false,
      },
    }
  }

  return {
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        formats: ['es'],
        fileName: () => 'index.js',
      },
      rollupOptions: {
        external: HOST_EXTERNAL,
      },
      sourcemap: true,
      minify: false,
    },
    plugins: [
      dts({
        // 宿主半身的类型声明：dist/index.d.ts / archive.d.ts / panel.d.ts
        include: ['src/**/*.ts'],
        exclude: ['src/client.ts'],
        rollupTypes: false,
      }),
    ],
  }
})
