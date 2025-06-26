import '../global.css';
import { SplashScreen, Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuth } from '../features/auth/hooks';

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
    const { isLoading, verifyToken } = useAuth();
  
    useEffect(() => {
      verifyToken();
    }, []);
  
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  
    return null;
  }

function RootNavigator() {

    const { isSignedIn, verifyToken } = useAuth();

    useEffect(() => {
        verifyToken();
    }, []);

     return <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!isSignedIn}>
            <Stack.Screen name="signin" options={{ headerShown: false }}/>
        </Stack.Protected>
        <Stack.Protected guard={isSignedIn}>
            <Stack.Screen name="(app)" options={{ headerShown: false }}/>
        </Stack.Protected>
     </Stack>
}