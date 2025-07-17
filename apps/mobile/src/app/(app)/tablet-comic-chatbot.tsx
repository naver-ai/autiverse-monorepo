import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { TabletComicChatbotScreen } from "../../features/tablet-comic-chatbot/screens/TabletComicChatbotScreen";

export default function TabletComicChatbotPage() {
  const params = useLocalSearchParams();
  const router = useRouter();
  
  return (
    <TabletComicChatbotScreen
      dyadId={params.dyadId as string}
      dyadName={params.dyadName as string}
      passcode={params.passcode as string}
      journalEntryId={params.journalEntryId as string}
      stage={params.stage as string}
      continueExisting={params.continueExisting === 'true'}
      router={router}
    />
  );
}