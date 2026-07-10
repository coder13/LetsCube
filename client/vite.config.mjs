import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const normalizeBase = (publicUrl) => {
  if (!publicUrl) {
    return '/';
  }

  return publicUrl.endsWith('/') ? publicUrl : `${publicUrl}/`;
};

export default defineConfig(({ mode }) => {
  const fileEnvironment = loadEnv(mode, process.cwd(), 'REACT_APP_');
  const shellEnvironment = Object.keys(process.env)
    .filter((key) => key.startsWith('REACT_APP_'))
    .reduce((environment, key) => ({
      ...environment,
      [key]: process.env[key],
    }), {});
  const clientEnvironment = {
    REACT_APP_API_ORIGIN: '',
    REACT_APP_SOCKETIO_ORIGIN: '',
    REACT_APP_SOCKETIO_PORT: '',
    REACT_APP_WCA_CLIENT_ID: '',
    REACT_APP_WCA_ORIGIN: 'https://www.worldcubeassociation.org',
    ...fileEnvironment,
    ...shellEnvironment,
  };
  const base = normalizeBase(process.env.PUBLIC_URL);
  const publicUrl = base === '/' ? '' : base.replace(/\/$/, '');
  const define = Object.entries({
    NODE_ENV: mode,
    PUBLIC_URL: publicUrl,
    ...clientEnvironment,
  }).reduce((definitions, [key, value]) => ({
    ...definitions,
    [`process.env.${key}`]: JSON.stringify(value),
  }), {});

  return {
    base,
    define,
    plugins: [
      react({ jsxRuntime: 'automatic' }),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'custom-service-worker.js',
        injectRegister: null,
        manifest: false,
        injectManifest: {
          globPatterns: ['**/*.{css,html,ico,js,json,mp3,ogg,png,svg}'],
        },
      }),
    ],
    server: {
      host: process.env.HOST || '0.0.0.0',
      port: Number(process.env.PORT) || 3000,
      open: process.env.BROWSER !== 'none',
      proxy: {
        '/api': 'http://localhost:8080',
        '/auth': 'http://localhost:8080',
      },
    },
    build: {
      outDir: 'build',
      sourcemap: process.env.GENERATE_SOURCEMAP !== 'false',
      target: 'es2015',
    },
  };
});
