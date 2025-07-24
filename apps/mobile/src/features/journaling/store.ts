import { create } from 'zustand';

interface JournalingState {
  // 기본 상태
  isLoading: boolean;
  
  // 입력 관련 상태
  isInputActive: boolean;
  
  // Actions - 실제 사용되는 것들만 유지
  setIsLoading: (loading: boolean) => void;
  setIsInputActive: (active: boolean) => void;
  
  // 복합 actions
  resetAll: () => void;
  resetForNewSession: () => void;
}

export const useJournalingStore = create<JournalingState>((set, get) => ({
  // 초기 상태
  isLoading: false,

  isInputActive: false,

  setIsLoading: (isLoading) => set({ isLoading }),
  setIsInputActive: (isInputActive) => set({ isInputActive }),
  
  resetAll: () => set({
    isLoading: false,
    isInputActive: false,
  }),
  
  resetForNewSession: () => set({
    isLoading: false,
    isInputActive: false,
  })
}));
