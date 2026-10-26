import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Placeholder bundle id; pick the real one before any store submission (it can't change after).
  appId: 'com.captainblastroid.game',
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
