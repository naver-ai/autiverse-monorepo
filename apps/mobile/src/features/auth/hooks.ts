import { useMutation, useQueryClient } from '@tanstack/react-query';
import { signInAPI, signOutAPI, verifyTokenAPI } from './api';
import { useAuthStore } from './store';
import { useCallback } from 'react';

export const useAuth = () => {
  const { jwt, isVerifyingToken, isSigningIn, clearAuth, setIsVerifyingToken, setIsSigningIn, setJWT } = useAuthStore()

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
      queryClient.setQueryData(["dyad"], data.dyad);
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