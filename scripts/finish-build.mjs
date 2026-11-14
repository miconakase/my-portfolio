// Runs after `vite build` on Vercel. Renames the built page so "/" isn't served as a static
// file and reaches api/page.js instead, which adds the content for crawlers (see that file).
import { renameSync } from 'node:fs'

renameSync('dist/index.html', 'dist/app.html')
console.log('dist/index.html → dist/app.html')
