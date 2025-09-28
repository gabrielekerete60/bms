import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gabrielekerete.bms',
  appName: 'BMS',
  webDir: '.next',
  server: {
    // This should be your Vercel deployment URL
    url: 'https://management-app-bakery.vercel.app', 
    cleartext: true,
  },
};

export default config;
