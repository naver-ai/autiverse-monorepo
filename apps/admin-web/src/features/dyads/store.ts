import { create } from 'zustand';

// Define store state interface
interface AgentModalState {
  isOpen: boolean;
  selectedDyadId: string | null;
  openAgentModal: (dyadId: string) => void;
  closeAgentModal: () => void;
}

// Create agent modal store
export const useAgentModalStore = create<AgentModalState>((set) => ({
  isOpen: false,
  selectedDyadId: null,
  openAgentModal: (dyadId) => set({ isOpen: true, selectedDyadId: dyadId }),
  closeAgentModal: () => set({ isOpen: false, selectedDyadId: null }),
}));

// Define person modal store state interface
interface PersonModalState {
  isOpen: boolean;
  selectedDyadId: string | null;
  openPersonModal: (dyadId: string) => void;
  closePersonModal: () => void;
}

// Create person modal store
export const usePersonModalStore = create<PersonModalState>((set) => ({
  isOpen: false,
  selectedDyadId: null,
  openPersonModal: (dyadId) => set({ isOpen: true, selectedDyadId: dyadId }),
  closePersonModal: () => set({ isOpen: false, selectedDyadId: null }),
}));

// Define place modal store state interface
interface PlaceModalState {
  isOpen: boolean;
  selectedDyadId: string | null;
  openPlaceModal: (dyadId: string) => void;
  closePlaceModal: () => void;
}

// Create place modal store
export const usePlaceModalStore = create<PlaceModalState>((set) => ({
  isOpen: false,
  selectedDyadId: null,
  openPlaceModal: (dyadId) => set({ isOpen: true, selectedDyadId: dyadId }),
  closePlaceModal: () => set({ isOpen: false, selectedDyadId: null }),
}));
