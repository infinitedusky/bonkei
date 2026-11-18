import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import type { ProxyOptions, UserConfig } from 'vite'
import config from './vite.config.ts'

const NAMES = ['SITE_PORT', 'VIEWER_PORT'] as const
const saved = Object.fromEntries(NAMES.map((n) => [n, process.env[n]]))
afterEach(() => {
  for (const n of NAMES) {
    if (saved[n] === undefined) delete process.env[n]
    else process.env[n] = saved[n]
  }
})

const withEnv = (env: Partial<Record<(typeof NAMES)[number], string>>) => {
  for (const n of NAMES) delete process.env[n]
  Object.assign(process.env, env)
  return (config as (env: { command: 'serve'; mode: string }) => UserConfig)({ command: 'serve', mode: 'development' })
}
const app = (c: UserConfig) => c.server?.proxy?.['/app'] as ProxyOptions

test('with nothing set, the site keeps Vite’s port and proxies /app to 5174', () => {
  const c = withEnv({})
  assert.equal(c.server?.port, undefined)
  assert.ok(!c.server?.strictPort)
  assert.equal(app(c).target, 'http://localhost:5174')
  assert.equal(app(c).ws, true)
})

test('SITE_PORT and VIEWER_PORT set the site’s port, strictly, and the /app target', () => {
  const c = withEnv({ SITE_PORT: '6100', VIEWER_PORT: '6101' })
  assert.equal(c.server?.port, 6100)
  assert.equal(c.server?.strictPort, true)
  assert.equal(app(c).target, 'http://localhost:6101')
  assert.equal(app(c).ws, true)
})

test('VIEWER_PORT alone moves the /app target and leaves the site’s port alone', () => {
  const c = withEnv({ VIEWER_PORT: '6201' })
  assert.equal(app(c).target, 'http://localhost:6201')
  assert.equal(c.server?.port, undefined)
  assert.ok(!c.server?.strictPort)
})

test('a SITE_PORT that is not a port number throws, naming the variable', () => {
  assert.throws(() => withEnv({ SITE_PORT: 'x' }), /SITE_PORT/)
})
