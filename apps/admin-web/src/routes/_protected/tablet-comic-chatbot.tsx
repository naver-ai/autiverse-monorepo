import { createFileRoute } from '@tanstack/react-router';
import { TabletComicChatbot } from '../../components/TabletComicChatbot';

export const Route = createFileRoute('/_protected/tablet-comic-chatbot')({
  component: TabletComicChatbot,
}); 