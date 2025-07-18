import { Stack } from "expo-router";
import { useAuthStore } from '../../features/auth/store';

export default function AppLayout() {
  const { jwt } = useAuthStore();

  if (!jwt) {
    return null;
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="home" options={{ headerShown: false }} />
      <Stack.Screen name="agent-intro" options={{ headerShown: false }} />
      <Stack.Screen name="create-comic" options={{ headerShown: false }} />
      <Stack.Screen name="gallery" options={{ headerShown: false }} />
      <Stack.Screen name="comic-detail" options={{ headerShown: false }} />
    </Stack>
  );
}