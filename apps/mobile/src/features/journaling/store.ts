import { create } from 'zustand';

interface JournalingState {
  // 기본 상태
  isSendingMessage: boolean;
  
  // 입력 관련 상태
  isInputActive: boolean;
  
  // Actions - 실제 사용되는 것들만 유지
  setIsSendingMessage: (loading: boolean) => void;
  setIsInputActive: (active: boolean) => void;
  
  // 복합 actions
  resetAll: () => void;
  resetForNewSession: () => void;
}

export const useJournalingStore = create<JournalingState>((set, get) => ({
  // 초기 상태
  isSendingMessage: false,

  isInputActive: false,

  setIsSendingMessage: (isLoading) => set({ isSendingMessage: isLoading }),
  setIsInputActive: (isInputActive) => set({ isInputActive }),
  
  resetAll: () => set({
    isSendingMessage: false,
    isInputActive: false,
  }),
  
  resetForNewSession: () => set({
    isSendingMessage: false,
    isInputActive: false,
  })
}));
