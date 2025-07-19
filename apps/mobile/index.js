import { initializeI18n } from '@autiverse-monorepo/ts-core';
import { initReactI18next } from 'react-i18next';
import * as SplashScreen from 'expo-splash-screen';
import { NetworkHelper } from '@autiverse-monorepo/ts-core';
import * as Localization from 'expo-localization';
import { isAndroidEmulator } from './src/core/device';

console.log("Starting mobile app in debug mode:", __DEV__);

SplashScreen.preventAutoHideAsync();

const protocol = process.env.EXPO_PUBLIC_USE_HTTPS === '1' && (!__DEV__ || process.env.EXPO_PUBLIC_USE_HTTPS_IN_DEV === '1') ? 'https' : 'http';
const backendUrl = __DEV__ ? (isAndroidEmulator() ? `${protocol}://10.0.2.2:3000` : `${protocol}://localhost:3000`) : `${protocol}://${process.env.EXPO_PUBLIC_BACKEND_HOSTNAME}:${process.env.EXPO_PUBLIC_BACKEND_PORT}`;

NetworkHelper.init(
    backendUrl,
    () => Localization.getCalendars()[0]?.timeZone || undefined
)

initializeI18n("kr", "kr", {
    middlewares: [initReactI18next]
});


import 'expo-router/entry';