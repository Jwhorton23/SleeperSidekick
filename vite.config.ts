import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves a project site at username.github.io/<repo-name>/,
  // not the domain root — every asset URL needs this prefix. If this repo
  // is ever renamed, or deployed as a user/org page (a repo literally
  // named <username>.github.io) or behind a custom domain, change this to '/'.
  base: '/SleeperSidekick/',
  plugins: [react()],
})
