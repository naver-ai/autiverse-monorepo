import { create } from 'zustand';

interface JournalingState {
  // 기본 상태
  isLoading: boolean;
  
  // 섹션 관련 상태
  showPraiseSection: boolean;
  showFarewellSection: boolean;
  completionMessage: string;
  
  // 입력 관련 상태
  isInputActive: boolean;
  isAfterFarewell: boolean;
  
  // Actions - 실제 사용되는 것들만 유지
  setIsLoading: (loading: boolean) => void;
  setIsInputActive: (active: boolean) => void;
  setIsAfterFarewell: (after: boolean) => void;
  // Semantic setters - 관련된 상태들을 함께 업데이트

  transitionToPraiseSection: () => void;
  transitionToFarewellSection: () => void;
  
  // 복합 actions
  resetAll: () => void;
  resetForNewSession: () => void;
}

export const useJournalingStore = create<JournalingState>((set, get) => ({
  // 초기 상태
  isLoading: false,

  showPraiseSection: false,
  showFarewellSection: false,
  completionMessage: '',
  
  isInputActive: false,
  isAfterFarewell: false,

  setIsLoading: (isLoading) => set({ isLoading }),
  setIsInputActive: (isInputActive) => set({ isInputActive }),
  setIsAfterFarewell: (isAfterFarewell) => set({ isAfterFarewell }),
  
  transitionToPraiseSection: () => set({
    showPraiseSection: true,
    showFarewellSection: false
  }),
  
  transitionToFarewellSection: () => set({
    showPraiseSection: false,
    showFarewellSection: true
  }),
  
  resetAll: () => set({
    isLoading: false,
    showPraiseSection: false,
    showFarewellSection: false,
    completionMessage: '',
    isInputActive: false,
    isAfterFarewell: false
  }),
  
  resetForNewSession: () => set({
    isLoading: false,
    showPraiseSection: false,
    showFarewellSection: false,
    completionMessage: '',
    isInputActive: false,
    isAfterFarewell: false
  })
}));
