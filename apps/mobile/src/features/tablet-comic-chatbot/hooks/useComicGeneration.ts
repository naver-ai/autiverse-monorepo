import { useState, useEffect, useRef } from 'react';

interface ComicGenerationStatus {
  status: 'idle' | 'generating' | 'completed' | 'error' | 'cancelled';
  progress: number;
  message: string;
  comic_data?: any;
}

interface UseComicGenerationProps {
  journalEntryId: string | null;
  onComplete?: (comicData: any) => void;
}

export const useComicGeneration = ({ 
  journalEntryId, 
  onComplete 
}: UseComicGenerationProps) => {
  const [status, setStatus] = useState<ComicGenerationStatus>({
    status: 'idle',
    progress: 0,
    message: ''
  });
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startGeneration = async (panelContents: Record<string, string>) => {
    if (!journalEntryId) {
      console.error('journalEntryId is required to start comic generation');
      return;
    }

    try {
      setStatus({
        status: 'generating',
        progress: 0,
        message: '만화 생성이 시작되었습니다.'
      });

      // 만화 생성 시작
      const response = await fetch('http://10.66.106.38:3000/api/v1/app/comic-generation/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          journal_entry_id: journalEntryId,
          panel_contents: panelContents
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start comic generation');
      }

      // 상태 폴링 시작
      startPolling();

    } catch (error) {
      console.error('Error starting comic generation:', error);
      setStatus({
        status: 'error',
        progress: 0,
        message: '만화 생성 시작에 실패했습니다.'
      });
    }
  };

  // 자동으로 만화 생성 상태 확인
  const checkGenerationStatus = async () => {
    if (!journalEntryId) return;

    try {
      const response = await fetch(`http://10.66.106.38:3000/api/v1/app/comic-generation/status/${journalEntryId}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Comic generation status check:', data);
        
        // 상태가 변경된 경우에만 업데이트
        if (data.status !== status.status) {
          if (data.status === 'generating') {
            console.log('Comic generation detected, starting to monitor...');
            setStatus({
              status: data.status,
              progress: data.progress,
              message: data.message,
              comic_data: data.comic_data
            });
            startPolling();
          } else if (data.status === 'completed') {
            console.log('Comic generation completed');
            setStatus({
              status: data.status,
              progress: data.progress,
              message: data.message,
              comic_data: data.comic_data
            });
            stopPolling();
            
            if (data.comic_data && onComplete) {
              onComplete(data.comic_data);
            }
          } else if (data.status === 'error' || data.status === 'cancelled') {
            console.log(`Comic generation ${data.status}`);
            setStatus({
              status: data.status,
              progress: data.progress,
              message: data.message,
              comic_data: data.comic_data
            });
            stopPolling();
          }
        } else {
          // 상태가 같아도 진행률이나 메시지가 변경된 경우 업데이트
          if (data.progress !== status.progress || data.message !== status.message) {
            setStatus(prev => ({
              ...prev,
              progress: data.progress,
              message: data.message,
              comic_data: data.comic_data
            }));
          }
        }
      }
    } catch (error) {
      // 에러가 발생하면 만화 생성이 진행 중이지 않은 것
      console.log('No comic generation in progress');
    }
  };

  const startPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(async () => {
      if (!journalEntryId) return;

      try {
        const response = await fetch(`http://10.66.106.38:3000/api/v1/app/comic-generation/status/${journalEntryId}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('Polling comic generation status:', data);
          
          setStatus({
            status: data.status,
            progress: data.progress,
            message: data.message,
            comic_data: data.comic_data
          });

          // 완료되면 폴링 중지
          if (data.status === 'completed' || data.status === 'error' || data.status === 'cancelled') {
            console.log(`Comic generation ${data.status}, stopping polling`);
            stopPolling();
            
            if (data.status === 'completed' && data.comic_data && onComplete && status.status !== 'completed') {
              onComplete(data.comic_data);
            }
          }
        }
      } catch (error) {
        console.error('Error polling comic generation status:', error);
        setStatus({
          status: 'error',
          progress: 0,
          message: '상태 확인 중 오류가 발생했습니다.'
        });
        stopPolling();
      }
    }, 1000); // 1초마다 폴링
  };

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const cancelGeneration = async () => {
    if (!journalEntryId) return;

    try {
      const response = await fetch(`http://10.66.106.38:3000/api/v1/app/comic-generation/cancel/${journalEntryId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setStatus({
          status: 'cancelled',
          progress: 0,
          message: '만화 생성이 취소되었습니다.'
        });
        stopPolling();
      }
    } catch (error) {
      console.error('Error cancelling comic generation:', error);
    }
  };

  // 컴포넌트 언마운트 시 폴링 중지
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  return {
    status,
    startGeneration,
    cancelGeneration,
    stopPolling,
    checkGenerationStatus
  };
}; 