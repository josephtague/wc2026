import type { CapacitorConfig } from '@capacitor/cli';

// Capacitor wraps the existing Vite build (webDir: 'dist') in native iOS+Android
// shells. The web app (Vercel) is unaffected — this only adds native targets.
// Data is fetched from the deployed /api proxy via VITE_API_BASE at build time.
const config: CapacitorConfig = {
  appId: 'app.wc2026.ceefax',
  appName: 'WC26 Ceefax',
  webDir: 'dist',
  backgroundColor: '#000000',
  plugins: {
    SplashScreen: { backgroundColor: '#000000', showSpinner: false, launchAutoHide: true },
    StatusBar: { style: 'DARK', backgroundColor: '#000000' },
  },
};

export default config;
