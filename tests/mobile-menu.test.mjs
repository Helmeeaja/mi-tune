import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'

test('mobile menu renders for guests and users with every primary route', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true, hmr: false } })
  try {
    const { default: AppDialogs } = await server.ssrLoadModule('/src/components/AppDialogs.jsx')
    const { LanguageProvider } = await server.ssrLoadModule('/src/lib/i18n.jsx')
    const noop = () => {}
    const props = { modal: { type: 'mobile-menu' }, view: 'downloads', installed: false, downloadsCount: 0, incomingCount: 0, onClose: noop, onNavigate: noop, onInstall: noop, onNewPlaylist: noop, onFavorites: noop, onDetail: noop }
    const routes = ['/', '/search', '/trending', '/podcasts', '/library', '/downloads', '/friends', '/settings', '/profile']
    for (const language of ['id', 'en']) {
      for (const user of [null, { id: 'menu-fixture', username: 'menu', displayName: 'Menu fixture' }]) {
        const html = renderToString(React.createElement(LanguageProvider, { language }, React.createElement(AppDialogs, { ...props, user })))
        for (const route of routes) assert.ok(html.includes(`href="${route}"`), `${language}: ${route} is missing`)
        assert.match(html, /href="\/downloads" aria-current="page"/)
      }
    }
  } finally {
    await server.close()
  }
})
