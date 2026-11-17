import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig, loadEnv } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { pluginTailwindcss } from '@rsbuild/plugin-tailwindcss'
import { tanstackRouter } from '@tanstack/router-plugin/rspack'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ envMode }) => {
  const env = loadEnv({ mode: envMode, prefixes: ['VITE_'] })
  const serverUrl =
    process.env.VITE_REACT_APP_SERVER_URL ||
    env.rawPublicVars.VITE_REACT_APP_SERVER_URL ||
    'http://localhost:3000'

  const isProd = envMode === 'production'
  const devProxy = Object.fromEntries(
    (['/api', '/v1', '/mj', '/pg'] as const).map((key) => [
      key,
      { target: serverUrl, changeOrigin: true },
    ])
  ) as Record<string, { target: string; changeOrigin: boolean }>

  return {
    plugins: [pluginReact(), pluginTailwindcss({ optimize: false })],
    // Rsbuild 2: replaces deprecated `performance.chunkSplit` (RSPack 2 aligned)
    splitChunks: {
      preset: 'default',
      cacheGroups: {
        // Portal isolation: admin and client domain code is grouped into its
        // own async chunk per portal, so visiting one portal never downloads
        // the other's code. `chunks: 'async'` keeps route-config modules
        // (guards, beforeLoad) in the small initial chunks instead of dragging
        // the whole portal bundle into the entry HTML.
        admin: {
          test: /src[\\/]apps[\\/]admin[\\/]/,
          name: 'admin',
          chunks: 'async',
          priority: 40,
          // A portal group with no ceiling swallows every route under it, which
          // defeats `autoCodeSplitting`: the first admin route would download
          // every admin feature. With maxSize the group keeps portal isolation
          // but breaks into route-sized chunks.
          maxSize: 400_000,
        },
        client: {
          test: /src[\\/]apps[\\/]client[\\/]/,
          name: 'client',
          chunks: 'async',
          priority: 30,
          maxSize: 300_000,
        },
        'vendor-react': {
          test: /node_modules[\\/](react|react-dom)[\\/]/,
          name: 'vendor-react',
          chunks: 'all',
          priority: 0,
          enforce: true,
        },
        'vendor-ui-primitives': {
          test: /node_modules[\\/](@base-ui|@radix-ui)[\\/]/,
          name: 'vendor-ui-primitives',
          chunks: 'all',
          priority: 0,
          enforce: true,
        },
        'vendor-tanstack': {
          test: /node_modules[\\/]@tanstack[\\/]/,
          name: 'vendor-tanstack',
          chunks: 'all',
          priority: 0,
          enforce: true,
        },
        // Heavy libraries that are now only ever reached through a dynamic
        // import. One chunk each keeps them out of every route that merely
        // mentions a chart or a spreadsheet, and lets the browser cache them
        // across releases independently of app code.
        'vendor-vchart': {
          test: /node_modules[\\/](@visactor|zrender)[\\/]/,
          name: 'vendor-vchart',
          // 'async' on purpose: `dashboard/lib/charts.ts` imports a 4 kB colour
          // scheme synchronously. With 'all' that tiny module would drag the
          // whole 2 MB VChart chunk into the dashboard route as a sync asset.
          chunks: 'async',
          priority: 20,
          enforce: true,
        },
        'vendor-xlsx': {
          test: /node_modules[\\/]xlsx[\\/]/,
          name: 'vendor-xlsx',
          chunks: 'all',
          priority: 20,
          enforce: true,
        },
      },
    },
    source: {
      entry: {
        index: './src/main.tsx',
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        // CopilotKit v2 declares maplibre-gl as a dynamic optional import for
        // generative-UI maps; the admin copilot never renders one, so resolve
        // it to a stub to keep the bundler from erroring.
        'maplibre-gl': path.resolve(__dirname, './src/shims/empty-module.ts'),
      },
    },
    html: {
      template: './index.html',
      favicon: './public/favicon.ico',
    },
    server: {
      host: '0.0.0.0',
      strictPort: false,
      proxy: devProxy,
    },
    output: {
      // Production optimizations
      minify: isProd,
      target: 'web',
      distPath: {
        root: 'dist',
      },
      // Rely on Rsbuild default legalComments ("linked" → per-chunk *.LICENSE.txt) in all modes.
      // Do not set "none" in production: that strips minifier-preserved third-party notices and
      // extracted license files, which some distributions require for open-source compliance.
    },
    performance: {
      // Remove console in production
      removeConsole: isProd ? ['log'] : false,
      buildCache: false,
    },
    tools: {
      rspack: {
        plugins: [
          tanstackRouter({
            target: 'react',
            // Every route is lazily loaded with `lazyRouteComponent`, and the
            // build keeps route-based code splitting in all modes so the two
            // portal branches stay in separate chunks during development too.
            autoCodeSplitting: true,
          }),
        ],
      },
    },
  }
})
