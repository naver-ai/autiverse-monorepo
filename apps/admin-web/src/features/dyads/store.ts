import { create } from 'zustand';

// Define store state interface
interface InterestModalState {
  isOpen: boolean;
  selectedDyadId: string | null;
  openInterestModal: (dyadId: string) => void;
  closeInterestModal: () => void;
}

// Create interest modal store
export const useInterestModalStore = create<InterestModalState>((set) => ({
  isOpen: false,
  selectedDyadId: null,
  openInterestModal: (dyadId) => set({ isOpen: true, selectedDyadId: dyadId }),
  closeInterestModal: () => set({ isOpen: false, selectedDyadId: null }),
}));
