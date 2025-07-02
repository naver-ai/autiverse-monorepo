import { useEffect } from 'react';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../features/auth/hooks';

export default function AppIndex() {
  const queryClient = useQueryClient();
  const { jwt, passcode } = useAuth();

  useEffect(() => {
    // dyad 정보를 가져와서 agent-intro로 이동
    const dyad = queryClient.getQueryData(["dyad"]) as any;
    
    if (dyad && dyad.id && passcode) {
      // dyad 정보와 passcode가 있으면 agent-intro로 이동
      router.replace({
        pathname: '/(app)/agent-intro',
        params: { 
          dyadId: dyad.id,
          dyadName: dyad.child_name || dyad.alias,
          passcode: passcode
        }
      });
    } else {
      // dyad 정보가 없으면 기본 agent-intro로 이동
      router.replace('/(app)/agent-intro');
    }
  }, [queryClient, jwt, passcode]);

  return null; // 로딩 중에는 아무것도 표시하지 않음
} 