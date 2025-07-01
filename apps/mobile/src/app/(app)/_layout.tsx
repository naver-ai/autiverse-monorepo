import { Stack } from "expo-router";

export default function ProtectedRootLayout(){
    return <Stack>
        <Stack.Screen name="index" />
        <Stack.Screen name="tablet-comic-chatbot" options={{ headerShown: false }} />
    </Stack>
}