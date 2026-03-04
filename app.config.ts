import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'TuneSwippe',
  slug: 'tuneswippe',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#121212',
  },
  scheme: 'tuneswippe',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.tuneswippe.app',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundColor: '#121212',
    },
    package: 'com.tuneswippe.app',
  },
  web: {
    favicon: './assets/favicon.png',
  },
  extra: {
    spotifyClientId: process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
  plugins: [
    'expo-router',
    'expo-audio',
    [
      'expo-web-browser',
      {},
    ],
  ],
});
