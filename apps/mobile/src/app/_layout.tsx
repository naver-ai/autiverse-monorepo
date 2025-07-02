import '../global.css';
import { SplashScreen, Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
  return <Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name="signin" options={{ headerShown: false }}/>
    <Stack.Screen name="(app)" options={{ headerShown: false }}/>
  </Stack>
}