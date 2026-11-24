import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Published under 302 Comedy LLC. This id is permanent once a build is uploaded.
  appId: 'com.comedy302.captainblastroid',
  appName: 'Captain Blastroid',
  webDir: 'dist',
  backgroundColor: '#000000',
  ios: {
    // The game handles safe areas itself through env(safe-area-inset-*).
    contentInset: 'never',
  },
  plugins: {
    SystemBars: {
      hidden: true,
      style: 'DARK',
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
  },
};

export default config;
