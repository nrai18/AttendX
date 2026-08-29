import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.attendx.app',
  appName: 'AttendX',
  webDir: 'dist',
  server: {
    // For dev: point to local Vite server for hot reload on device
    // Comment out for production APK build
    // url: 'http://YOUR_LOCAL_IP:5173',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#050508',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#050508',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    CapacitorCookies: {
      enabled: true,
    },
    CapacitorHttp: { enabled: false },
  },
};

export default config;

