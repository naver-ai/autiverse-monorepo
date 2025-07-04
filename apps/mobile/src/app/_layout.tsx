import React from 'react';
import '../global.css';
import { SplashScreen, Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NetworkHelper } from '@autiverse-monorepo/ts-core';

const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });

export default function RootLayout() {
  return <QueryClientProvider client={queryClient}>
    <SplashScreenController />
    <RootNavigator />
  </QueryClientProvider>
}

function SplashScreenController() {
    // Hide splash screen immediately
      SplashScreen.hideAsync();
    return null;
  }

function RootNavigator() {
  // Initialize NetworkHelper
  // 나중에는 Env에서 base_url 가져오기
  React.useEffect(() => {
    const getTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
    NetworkHelper.init(
      __DEV__ ? 'http://localhost:3000' : 'https://your-production-url.com',
      getTimezone
    );
  }, []);

  return <Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name="signin" options={{ headerShown: false }}/>
    <Stack.Screen name="(app)" options={{ headerShown: false }}/>
  </Stack>
}