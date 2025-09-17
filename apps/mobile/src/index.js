import { initializeI18n } from '@autiverse-monorepo/ts-core';
import { initReactI18next } from 'react-i18next';
import * as SplashScreen from 'expo-splash-screen';
import { NetworkHelper } from '@autiverse-monorepo/ts-core';
import * as Localization from 'expo-localization';
import { isAndroidEmulator } from './core/device';
import { UserLocale } from '@autiverse-monorepo/ts-core';
import { SocketManager } from './features/journaling/utils/socket';

console.log("Starting mobile app in debug mode:", __DEV__);

SplashScreen.preventAutoHideAsync();

const protocol = process.env.EXPO_PUBLIC_USE_HTTPS === '1' && (!__DEV__ || process.env.EXPO_PUBLIC_USE_HTTPS_IN_DEV === '1') ? 'https' : 'http';
const backendUrl = __DEV__ ? (isAndroidEmulator() ? `${protocol}://10.0.2.2:3000` : `${protocol}://${process.env.EXPO_PUBLIC_BACKEND_HOSTNAME_DEV || 'localhost'}:3000`) : `${protocol}://${process.env.EXPO_PUBLIC_BACKEND_HOSTNAME}:${process.env.EXPO_PUBLIC_BACKEND_PORT}`;
// const backendUrl = __DEV__ ? `${protocol}://10.66.106.30:3000` : `${protocol}://${process.env.EXPO_PUBLIC_BACKEND_HOSTNAME}:${process.env.EXPO_PUBLIC_BACKEND_PORT}`;

NetworkHelper.init(
    backendUrl,
    () => Localization.getCalendars()[0]?.timeZone || undefined
)

SocketManager.init(
    protocol == 'https' ? "wss" : "ws",
    __DEV__ ? (isAndroidEmulator() ? '10.0.2.2' : (process.env.EXPO_PUBLIC_BACKEND_HOSTNAME_DEV || 'localhost')) : process.env.EXPO_PUBLIC_BACKEND_HOSTNAME,
    // __DEV__ ? '10.66.106.30' : process.env.EXPO_PUBLIC_BACKEND_HOSTNAME,
    __DEV__ ? 3000 : process.env.EXPO_PUBLIC_BACKEND_PORT,
  "dyad",
  false
)

initializeI18n(UserLocale.English, UserLocale.English, {
    middlewares: [initReactI18next]
});


import 'expo-router/entry';
