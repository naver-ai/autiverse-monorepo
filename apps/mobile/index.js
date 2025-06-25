import { initializeI18n } from '@autiverse-monorepo/ts-core';
import { initReactI18next } from 'react-i18next';
import * as SplashScreen from 'expo-splash-screen';
import { NetworkHelper } from '@autiverse-monorepo/ts-core';
import * as Localization from 'expo-localization';

console.log("Starting mobile app in debug mode:", __DEV__);

SplashScreen.preventAutoHideAsync();

NetworkHelper.init(
    __DEV__ ? 'http://localhost:3000' : `http://${process.env.EXPO_PUBLIC_BACKEND_HOSTNAME}:${process.env.EXPO_PUBLIC_BACKEND_PORT}`,
    () => Localization.getCalendars()[0]?.timeZone || undefined
)

initializeI18n("kr", "kr", {
    middlewares: [initReactI18next]
});


import 'expo-router/entry';