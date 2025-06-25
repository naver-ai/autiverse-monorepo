import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { SecureStorage } from '../../core/SecureStorage';

interface AuthState {
  // State
  jwt: string | null;
  isVerifyingToken: boolean;
  isSigningIn: boolean;
  
  // Actions
  clearAuth: () => void;
  setJWT: (jwt: string) => void;
  setIsVerifyingToken: (isVerifyingToken: boolean) => void;
  setIsSigningIn: (isSigningIn: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // Initial state
      jwt: null,
      isVerifyingToken: false,
      isSigningIn: false,

      // Actions
      setJWT: (jwt: string) => {
        console.log("setJWT", jwt)
        set({ jwt });
      },

      setIsVerifyingToken: (isVerifyingToken: boolean) => {
        set({ isVerifyingToken });
      },
      setIsSigningIn: (isSigningIn: boolean) => {
        set({ isSigningIn });
      },

      clearAuth: () => {
        console.log("clearAuth")
        set({ jwt: null });
      }
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => SecureStorage),
      partialize: (state) => ({
        jwt: state.jwt
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
