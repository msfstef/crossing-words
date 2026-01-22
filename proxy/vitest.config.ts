import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          durableObjects: {
            SIGNALING_ROOM: 'SignalingRoom',
          },
        },
      },
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
