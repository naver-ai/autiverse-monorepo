import { Router } from 'expo-router';

export interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

export interface Place {
  id: string;
  name: string;
  monday?: boolean;
  tuesday?: boolean;
  wednesday?: boolean;
  thursday?: boolean;
  friday?: boolean;
  saturday?: boolean;
  sunday?: boolean;
}

export interface Person {
  id: string;
  name: string;
  avatar_config?: any;
}

export interface Preset {
  location: string;
  people: string[];
  label: string;
  dayInfo?: string[];
}

export interface TabletComicChatbotScreenProps {
  dyadId?: string;
  dyadName?: string;
  passcode?: string;
  router?: Router;
}

export interface ComicPanel {
  content: string;
  grid: any[];
}

export interface ComicData {
  panel1?: ComicPanel | string;
  panel2?: ComicPanel | string;
  panel3?: ComicPanel | string;
  panel4?: ComicPanel | string;
}

export interface ComicGenerationStatus {
  status: 'idle' | 'generating' | 'completed' | 'error' | 'cancelled';
  progress: number;
  message: string;
  comic_data?: any;
}

export const DAY_INFO = {
  'Monday': { name: '월요일' },
  'Tuesday': { name: '화요일' },
  'Wednesday': { name: '수요일' },
  'Thursday': { name: '목요일' },
  'Friday': { name: '금요일' },
  'Saturday': { name: '토요일' },
  'Sunday': { name: '일요일' }
} as const; 