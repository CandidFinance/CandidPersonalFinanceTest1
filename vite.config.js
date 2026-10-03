import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { fillFigures } from './src/lib/pageFigures.js'

const root = fileURLToPath(new URL('.', import.meta.url))

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
