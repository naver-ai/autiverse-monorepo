import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { SecureStorage } from '../../core/SecureStorage';
import { jwtDecode } from 'jwt-decode';

interface AuthState {
  // State
  jwt: string | null;
  dyadId: string | null;
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
      dyadId: null,
      isVerifyingToken: false,
      isSigningIn: false,

      // Actions
      setJWT: (jwt: string) => {
        console.log("setJWT", jwt)
        try {
          const payload = jwtDecode(jwt);
          const dyadId = payload?.sub || null;
          console.log("Extracted dyadId from JWT:", dyadId);
          set({ jwt, dyadId });
        } catch (error) {
          console.error('JWT decode error:', error);
          set({ jwt, dyadId: null });
        }
      },

      setIsVerifyingToken: (isVerifyingToken: boolean) => {
        set({ isVerifyingToken });
      },

      setIsSigningIn: (isSigningIn: boolean) => {
        set({ isSigningIn });
      },

      clearAuth: () => {
        console.log("clearAuth")
        set({ jwt: null, dyadId: null });
      }
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => SecureStorage),
      partialize: (state) => ({
        jwt: state.jwt,
        dyadId: state.dyadId
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
