import { createFileRoute } from '@tanstack/react-router';
import { ChatbotFlow } from '../../components/ChatbotFlow';

export const Route = createFileRoute('/_protected/comic-chatbot')({
  component: ChatbotFlow,
}); 