import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

function swPrecachePlugin(): Plugin {
  return {
    name: 'vite-plugin-sw-precache',
    apply: 'build',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      const swPath = path.join(distDir, 'sw.js');
      if (!fs.existsSync(swPath)) return;

      const assetsDir = path.join(distDir, 'assets');
      const assetFiles: string[] = [];
      if (fs.existsSync(assetsDir)) {
        const files = fs.readdirSync(assetsDir);
        files.forEach((file) => {
          if (!file.endsWith('.map')) {
            assetFiles.push(`/assets/${file}`);
          }
        });
      }

      let swContent = fs.readFileSync(swPath, 'utf8');
      swContent = swContent.replace(
        '__VITE_PRECACHE_ASSETS__',
        JSON.stringify(assetFiles)
      );
      fs.writeFileSync(swPath, swContent, 'utf8');
      console.log(`Precached ${assetFiles.length} Vite production assets into dist/sw.js`);
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), swPrecachePlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
