import { create } from 'zustand';
import { ChatMessage, Preset } from './types';

interface JournalingState {
  // 기본 상태
  messages: ChatMessage[];
  inputText: string;
  isLoading: boolean;
  currentStage: string;
  sessionId: string | null;
  comicData: any;
  focusedPanel: string | null;
  
  // 2단계 선택을 위한 상태
  selectedLocation: string | null;
  selectedPeople: string[];
  selectionStep: 'location' | 'people';
  showPresetSelection: boolean;
  
  // API 기반 상태
  selectedPlaceId: string | null;
  selectedPersonIds: string[];
  
  // 만화 생성 관련 상태
  isComicCompleted: boolean;
  comicTitle: string;
  
  // 섹션 관련 상태
  showPraiseSection: boolean;
  showFarewellSection: boolean;
  completionMessage: string;
  
  // 입력 관련 상태
  isInputActive: boolean;
  isAfterFarewell: boolean;
  
  // Actions - 실제 사용되는 것들만 유지
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  addMessages: (newMessages: ChatMessage[]) => void;
  setIsLoading: (loading: boolean) => void;
  setCurrentStage: (stage: string) => void;
  setIsInputActive: (active: boolean) => void;
  setIsAfterFarewell: (after: boolean) => void;
  setInputText: (text: string) => void;
  
  // Semantic setters - 관련된 상태들을 함께 업데이트
  initializeSession: (sessionData: {
    journalEntryId: string;
    stage: string;
    panels?: any;
    title?: string;
    focusedPanel?: string | null;
    messages?: ChatMessage[];
    showPresetSelection?: boolean;
  }) => void;
  
  updateSessionInfo: (sessionData: {
    panels?: any;
    stage?: string;
    title?: string;
    focusedPanel?: string | null;
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
  handleLocationSelect: (location: string, placeId?: string) => void;
  handlePersonToggle: (person: string, personId?: string) => void;
  handleBackToLocation: () => void;
  resetAll: () => void;
  resetForNewSession: () => void;
}

export const useJournalingStore = create<JournalingState>((set, get) => ({
  // 초기 상태
  messages: [],
  inputText: '',
  isLoading: false,
  currentStage: 'intro',
  sessionId: null,
  comicData: null,
  focusedPanel: null,
  
  selectedLocation: null,
  selectedPeople: [],
  selectionStep: 'location',
  showPresetSelection: true,
  
  selectedPlaceId: null,
  selectedPersonIds: [],
  
  isComicCompleted: false,
  comicTitle: '그림 일기',
  
  showPraiseSection: false,
  showFarewellSection: false,
  completionMessage: '',
  
  isInputActive: false,
  isAfterFarewell: false,
  
  // Actions - 실제 사용되는 것들만 유지
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ 
    messages: [...state.messages, message] 
  })),
  addMessages: (newMessages) => set((state) => ({ 
    messages: [...state.messages, ...newMessages] 
  })),
  setInputText: (inputText) => set({ inputText }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setCurrentStage: (currentStage) => set({ currentStage }),
  setIsInputActive: (isInputActive) => set({ isInputActive }),
  setIsAfterFarewell: (isAfterFarewell) => set({ isAfterFarewell }),
  
  // Semantic setters
  initializeSession: (sessionData) => set({
    sessionId: sessionData.journalEntryId,
    currentStage: sessionData.stage,
    comicData: sessionData.panels || null,
    comicTitle: sessionData.title || '그림 일기',
    focusedPanel: sessionData.focusedPanel || null,
    messages: sessionData.messages || [],
    showPresetSelection: sessionData.showPresetSelection !== undefined ? sessionData.showPresetSelection : false
  }),
  
  updateSessionInfo: (sessionData) => set((state) => ({
    comicData: sessionData.panels !== undefined ? sessionData.panels : state.comicData,
    currentStage: sessionData.stage || state.currentStage,
    comicTitle: sessionData.title || state.comicTitle,
    focusedPanel: sessionData.focusedPanel !== undefined ? sessionData.focusedPanel : state.focusedPanel
  })),
  
  startChatbotSession: (sessionData) => set({
    sessionId: sessionData.journalEntryId,
    currentStage: sessionData.stage,
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
    
    // 완료 메시지 감지
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
  
  // 복합 actions
  handleLocationSelect: (location, placeId) => set((state) => ({
    selectedLocation: location,
    selectedPlaceId: placeId || null,
    selectedPeople: [],
    selectedPersonIds: [],
    selectionStep: 'people'
  })),
  
  handlePersonToggle: (person, personId) => set((state) => {
    if (personId) {
      const newSelectedPersonIds = state.selectedPersonIds.includes(personId)
        ? state.selectedPersonIds.filter(p => p !== personId)
        : [...state.selectedPersonIds, personId];
      return { selectedPersonIds: newSelectedPersonIds };
    } else {
      const newSelectedPeople = state.selectedPeople.includes(person)
        ? state.selectedPeople.filter(p => p !== person)
        : [...state.selectedPeople, person];
      return { selectedPeople: newSelectedPeople };
    }
  }),
  
  handleBackToLocation: () => set((state) => ({
    selectedLocation: null,
    selectedPeople: [],
    selectionStep: 'location'
  })),
  
  resetAll: () => set({
    messages: [],
    inputText: '',
    isLoading: false,
    currentStage: 'intro',
    sessionId: null,
    comicData: null,
    focusedPanel: null,
    selectedLocation: null,
    selectedPeople: [],
    selectionStep: 'location',
    showPresetSelection: true,
    selectedPlaceId: null,
    selectedPersonIds: [],
    isComicCompleted: false,
    comicTitle: '그림 일기',
    showPraiseSection: false,
    showFarewellSection: false,
    completionMessage: '',
    isInputActive: false,
    isAfterFarewell: false
  }),
  
  resetForNewSession: () => set({
    messages: [],
    inputText: '',
    isLoading: false,
    currentStage: 'intro',
    sessionId: null,
    comicData: null,
    focusedPanel: null,
    selectedLocation: null,
    selectedPeople: [],
    selectionStep: 'location',
    showPresetSelection: false, // intro로 돌아갈 때는 false
    selectedPlaceId: null,
    selectedPersonIds: [],
    isComicCompleted: false,
    comicTitle: '그림 일기',
    showPraiseSection: false,
    completionMessage: '',
    isInputActive: false
  })
}));
