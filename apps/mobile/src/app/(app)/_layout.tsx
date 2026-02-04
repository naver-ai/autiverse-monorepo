import { useEffect } from 'react';
import { Stack } from "expo-router";
import i18n from 'i18next';
import { useAuthStore } from '../../features/auth/store';
import { useKeepAwake } from "expo-keep-awake";
import { useDyad } from '../../api/dyad';

/** dyad 테이블의 locale(English/Korean)에 따라 i18n 언어 동기화 */
function DyadLocaleSync() {
  const { dyad } = useDyad();
  useEffect(() => {
    if (dyad?.locale && i18n.language !== dyad.locale) {
      i18n.changeLanguage(dyad.locale);
    }
  }, [dyad?.locale]);
  return null;
}

export default function AppLayout() {
  const { jwt } = useAuthStore();

  if (!jwt) {
    return null;
  }

  useKeepAwake();


  return (
    <>
      <DyadLocaleSync />
      <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="home" options={{ headerShown: false }} />
      <Stack.Screen name="agent-intro" options={{ headerShown: false }} />
      <Stack.Screen name="preset-selection" options={{ headerShown: false }} />
      <Stack.Screen name="create-comic" options={{ headerShown: false }} />
      <Stack.Screen name="gallery" options={{ headerShown: false }} />
      <Stack.Screen name="comic-detail" options={{ headerShown: false }} />
      <Stack.Screen name="ending" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}