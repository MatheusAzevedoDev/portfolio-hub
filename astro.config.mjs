import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// Update site and base to match your GitHub username and repo name
// site: 'https://YOUR_USERNAME.github.io'
// base: '/portfolio-hub'
export default defineConfig({
  site: 'https://MatheusAzevedoDev.github.io',
  base: '/portfolio-hub',
  output: 'static',
  integrations: [tailwind()],
});
