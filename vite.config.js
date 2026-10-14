import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import net from 'node:net'
import { fillFigures } from './src/lib/pageFigures.js'

const root = fileURLToPath(new URL('.', import.meta.url))

// `npm run dev` also starts Candid Assist's account-opening agent
// (scripts/assist-agent/agent.js), so the Assist panel can reach it without a
// second terminal. Skipped if one is already running on its port, or with
// CANDID_AGENT=0. One agent lasts across Vite's restarts (held on globalThis,
// since this file is reloaded) and stops when the dev server process exits.
const AGENT_PORT = 5287
const portInUse = port => new Promise(resolve => {
  const s = net.connect(port, '127.0.0.1')
  s.once('connect', () => { s.destroy(); resolve(true) })
  s.once('error', () => resolve(false))
})
const assistAgent = {
  name: 'candid-assist-agent',
  apply: 'serve',
  async configureServer() {
    const held = globalThis.__candidAgent
    if (process.env.CANDID_AGENT === '0' || (held && held.exitCode === null) || await portInUse(AGENT_PORT)) return
    const child = spawn(process.execPath, [root + 'scripts/assist-agent/agent.js'], { cwd: root, stdio: 'inherit' })
    globalThis.__candidAgent = child
    process.once('exit', () => { if (child.exitCode === null) child.kill() })
  },
}

// The public calculator pages are built by Vite alongside the app (not just
// copied), so their scripts can import the app's own figures from src/lib and
// their text can carry {{FIGURE}} tokens filled in from src/lib/pageFigures.js.
// The build script still copies the remaining static pages (privacy, terms)
// into dist, skipping anything Vite has already built.
const CALCULATOR_PAGES = [
  '100k-tax-trap-calculator',
  'mortgage-vs-savings-calculator',
  'student-loan-calculator',
]

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'candid-page-figures',
      transformIndexHtml: { order: 'pre', handler: html => fillFigures(html) },
    },
    assistAgent,
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: Object.fromEntries([
        ['main', root + 'index.html'],
        ...CALCULATOR_PAGES.map(name => [name, root + name + '.html']),
      ]),
    },
  },
})
