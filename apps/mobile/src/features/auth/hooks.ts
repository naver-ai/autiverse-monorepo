import { useMutation, useQueryClient } from '@tanstack/react-query';
import { signInAPI, signOutAPI, verifyTokenAPI } from './api';
import { useAuthStore } from './store';
import { useCallback } from 'react';
import { router } from 'expo-router';

export const useAuth = () => {
  const { jwt, passcode, isVerifyingToken, isSigningIn, clearAuth, setIsVerifyingToken, setIsSigningIn, setJWT, setPasscode } = useAuthStore()

  const queryClient = useQueryClient();


  const signInMutation = useMutation({
    mutationFn: signInAPI,
    onMutate: (data) => {
      console.log("signInMutation onMutate", data);
      setIsSigningIn(true);
    },
    onSuccess: (data, variables) => {
      console.log("signInMutation onSuccess", data);
      setJWT(data.jwt);
      setPasscode(variables.passcode); // passcode 저장
      queryClient.setQueryData(["dyad"], data.dyad);
      // 로그인 성공 시 약간의 지연 후 다음 페이지로 이동
      setTimeout(() => {
        router.replace('/(app)');
      }, 100);
    },
    onError: (error) => {
      console.log("signInMutation onError", error);
    },
    onSettled(data, error, variables, context) {
      setIsSigningIn(false);
    },
  });

  const signOutMutation = useMutation({
    mutationFn: signOutAPI,
    onSuccess: () => {
      clearAuth();
    },
    onError: () => {
      // Even if the API call fails, clear local auth state
      console.log("signOutMutation onError")
      clearAuth();
    },
    onSettled(data, error, variables, context) {
      setIsSigningIn(false);
    },
  });

  const verifyTokenMutation = useMutation({
    mutationFn: verifyTokenAPI,
    onMutate: () => {
      setIsVerifyingToken(true);
    },
    onSuccess: (data) => {
      setJWT(data.jwt);
    },
    onError: (error) => {
      console.log("verifyTokenMutation onError", error)
      clearAuth();
    },
    onSettled(data, error, variables, context) {
      setIsVerifyingToken(false);
    },
  });

  const verifyToken = useCallback(() => {
    if (jwt) {
      verifyTokenMutation.mutate({ token: jwt });
    }
  }, [jwt, verifyTokenMutation.mutate]);

  const signOut = useCallback(() => {
    if (jwt) {
      signOutMutation.mutate({ token: jwt });
    }
  }, [jwt, signOutMutation.mutate]);

  return {
    // State
    isSignedIn: !!jwt,
    jwt,
    passcode,
    
    // Loading states
    isLoading: isSigningIn || isVerifyingToken,
    isSigningIn: isSigningIn,
    isVerifyingToken: isVerifyingToken,
    
    // Mutations
    signIn: signInMutation.mutate,
    signOut,
    verifyToken,
    
    // Errors
    signInError: signInMutation.error,
    signOutError: signOutMutation.error,
    verifyTokenError: verifyTokenMutation.error,
    
    // Reset errors
    resetSignInError: signInMutation.reset,
    resetSignOutError: signOutMutation.reset,
    resetVerifyTokenError: verifyTokenMutation.reset,
  };
}; 