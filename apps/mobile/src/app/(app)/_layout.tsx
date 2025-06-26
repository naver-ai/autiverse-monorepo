import { Stack } from "expo-router";

export default function ProtectedRootLayout(){
    return <Stack>
        <Stack.Screen name="index" />
        <Stack.Screen name="home" options={{ headerShown: false }} />
    </Stack>
}