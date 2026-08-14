import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Served at the custom domain root (sleepersidekick.com/), not the
  // username.github.io/SleeperSidekick/ project-page subpath — so base is
  // '/', not the repo name. If the custom domain is ever removed (delete
  // public/CNAME too), revert this to '/SleeperSidekick/'.
  base: '/',
  plugins: [react()],
})
