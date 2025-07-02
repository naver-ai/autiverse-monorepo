import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { SecureStorage } from '../../core/SecureStorage';

interface AuthState {
  // State
  jwt: string | null;
  passcode: string | null;
  isVerifyingToken: boolean;
  isSigningIn: boolean;
  
  // Actions
  clearAuth: () => void;
  setJWT: (jwt: string) => void;
  setPasscode: (passcode: string) => void;
  setIsVerifyingToken: (isVerifyingToken: boolean) => void;
  setIsSigningIn: (isSigningIn: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // Initial state
      jwt: null,
      passcode: null,
      isVerifyingToken: false,
      isSigningIn: false,

      // Actions
      setJWT: (jwt: string) => {
        console.log("setJWT", jwt)
        set({ jwt });
      },

      setPasscode: (passcode: string) => {
        console.log("setPasscode", passcode)
        set({ passcode });
      },

      setIsVerifyingToken: (isVerifyingToken: boolean) => {
        set({ isVerifyingToken });
      },
      setIsSigningIn: (isSigningIn: boolean) => {
        set({ isSigningIn });
      },

      clearAuth: () => {
        console.log("clearAuth")
        set({ jwt: null, passcode: null });
      }
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => SecureStorage),
      partialize: (state) => ({
        jwt: state.jwt,
        passcode: state.passcode
      }),
      onRehydrateStorage: (state) => {

        return (state, error) => {
          console.log('hydration finished', state, error)
          if (error) {
            console.log('an error happened during hydration', error)
          } else {
            console.log('hydration finished')
          }
        }
      },
    }
  )
);
