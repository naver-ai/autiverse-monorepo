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
