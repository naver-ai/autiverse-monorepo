import '../global.css';
import { Slot, Stack } from "expo-router";

export default function RootLayout() {
  return <RootNavigator />;
}

function RootNavigator() {
    const isSignedIn = false
     return <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!isSignedIn}>
            <Stack.Screen name="signin" />
        </Stack.Protected>
        <Stack.Protected guard={isSignedIn}>
            <Stack.Screen name="(app)" />
        </Stack.Protected>
     </Stack>
}