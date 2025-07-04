import '../global.css';
import { SplashScreen, Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '../features/auth/hooks';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';

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
    <GestureHandlerRootView>
      <RootNavigator />
    </GestureHandlerRootView>
  </QueryClientProvider>
}

function RootNavigator() {

  const { isSignedIn, isLoading, verifyToken } = useAuth()

  const [fontsLoaded] = useFonts({
    'NanumSquareNeo-aLt': require('../../assets/fonts/NanumSquareNeo-aLt.otf'),
    'NanumSquareNeo-bRg': require('../../assets/fonts/NanumSquareNeo-bRg.otf'),
    'NanumSquareNeo-cBd': require('../../assets/fonts/NanumSquareNeo-cBd.otf'),
    'NanumSquareNeo-dEb': require('../../assets/fonts/NanumSquareNeo-dEb.otf'),
    'NanumSquareNeo-eHv': require('../../assets/fonts/NanumSquareNeo-eHv.otf'),
  });
  
  useEffect(()=>{
    verifyToken()
  }, [])

  if (!fontsLoaded || isLoading) {
    return null
  }else{
    SplashScreen.hide()
    return <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="(app)" options={{ headerShown: false }}/>
      </Stack.Protected>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="signin" options={{ headerShown: false }}/>
      </Stack.Protected>
    </Stack>
  }

}