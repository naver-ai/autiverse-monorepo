import { create } from 'zustand';

interface JournalingState {
  // 기본 상태
  inputText: string;
  isLoading: boolean;
  
  showPresetSelection: boolean;
  
  // 만화 생성 관련 상태
  isComicCompleted: boolean;
  
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
  setInputText: (text: string) => void;
  setShowPresetSelection: (show: boolean) => void;
  
  // Semantic setters - 관련된 상태들을 함께 업데이트
  initializeSession: (sessionData: {
    journalEntryId: string;
    stage: string;
    panels?: any;
    title?: string;
    focusedPanel?: string | null;
    showPresetSelection?: boolean;
  }) => void;
  
  startChatbotSession: (sessionData: {
    journalEntryId: string;
    stage: string;
  }) => void;
  
  transitionToPraiseSection: () => void;
  transitionToFarewellSection: () => void;
  
  prepareForMessageSend: () => void;
  handleMessageResponse: (responseData: {
    stage: string;
    response: string;
    focusedPanel?: string | null;
    auto_comic_generation?: boolean;
  }) => void;
  
  // 복합 actions
  resetAll: () => void;
  resetForNewSession: () => void;
}

export const useJournalingStore = create<JournalingState>((set, get) => ({
  // 초기 상태
  inputText: '',
  isLoading: false,
  
  showPresetSelection: true,
  
  selectedPlaceId: null,
  selectedPersonIds: [],
  
  isComicCompleted: false,
  showPraiseSection: false,
  showFarewellSection: false,
  completionMessage: '',
  
  isInputActive: false,
  isAfterFarewell: false,

  setInputText: (inputText) => set({ inputText }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setIsInputActive: (isInputActive) => set({ isInputActive }),
  setIsAfterFarewell: (isAfterFarewell) => set({ isAfterFarewell }),
  setShowPresetSelection: (showPresetSelection: boolean) => set({ showPresetSelection }),
  
  // Semantic setters
  initializeSession: (sessionData) => set({
    showPresetSelection: sessionData.showPresetSelection !== undefined ? sessionData.showPresetSelection : false
  }),
  
  startChatbotSession: (sessionData) => set({
    showPresetSelection: false
  }),
  
  transitionToPraiseSection: () => set({
    showPraiseSection: true,
    showFarewellSection: false
  }),
  
  transitionToFarewellSection: () => set({
    showPraiseSection: false,
    showFarewellSection: true
  }),
  
  prepareForMessageSend: () => set({
    inputText: '',
    isLoading: true
  }),
  
  handleMessageResponse: (responseData) => set((state) => {
    const updates: any = {
      currentStage: responseData.stage,
      isLoading: false
    };
    
    // 완료 메시지 감지 - This will be handled by the component with i18n
    if (responseData.response.includes('다음 버튼을 눌러줘')) {
      updates.completionMessage = responseData.response;
      updates.isInputActive = true;
    } else {
      updates.completionMessage = '';
    }
    
    // focusedPanel 업데이트
    if (responseData.focusedPanel !== undefined) {
      updates.focusedPanel = responseData.focusedPanel;
    }
    
    return updates;
  }),
  
  resetAll: () => set({
    inputText: '',
    isLoading: false,
    showPresetSelection: false,
    isComicCompleted: false,
    showPraiseSection: false,
    showFarewellSection: false,
    completionMessage: '',
    isInputActive: false,
    isAfterFarewell: false
  }),
  
  resetForNewSession: () => set({
    inputText: '',
    isLoading: false,
    isComicCompleted: false,
    showPraiseSection: false,
    showFarewellSection: false,
    completionMessage: '',
    isInputActive: false,
    isAfterFarewell: false
  })
}));
