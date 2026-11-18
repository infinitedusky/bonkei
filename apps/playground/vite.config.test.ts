import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import type { UserConfig } from 'vite'
import config from './vite.config.ts'

const saved = process.env.VIEWER_PORT
afterEach(() => {
  if (saved === undefined) delete process.env.VIEWER_PORT
  else process.env.VIEWER_PORT = saved
})

const serve = () => (config as (env: { command: 'serve'; mode: string }) => UserConfig)({ command: 'serve', mode: 'development' })

test('the viewer listens on 5174, strictly, when VIEWER_PORT is unset', () => {
  delete process.env.VIEWER_PORT
  const { server } = serve()
  assert.equal(server?.port, 5174)
  assert.equal(server?.strictPort, true)
})

test('the viewer listens on VIEWER_PORT when it is set', () => {
  process.env.VIEWER_PORT = '6101'
  const { server } = serve()
  assert.equal(server?.port, 6101)
  assert.equal(server?.strictPort, true)
})

test('a VIEWER_PORT that is not a port number throws, naming the variable', () => {
  process.env.VIEWER_PORT = 'abc'
  assert.throws(serve, /VIEWER_PORT/)
})
