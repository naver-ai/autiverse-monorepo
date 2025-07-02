// 이 파일은 더 이상 사용되지 않습니다. useComicGenerationQuery.ts를 사용하세요.
// 기존 코드와의 호환성을 위해 임시로 남겨둡니다.

import React from 'react';
import { useComicGeneration as useComicGenerationQuery } from './useComicGenerationQuery';

interface UseComicGenerationProps {
  journalEntryId: string | null;
  onComplete?: (comicData: any) => void;
}

export const useComicGeneration = ({ 
  journalEntryId, 
  onComplete 
}: UseComicGenerationProps) => {
  const {
    status,
    startGeneration,
    cancelGeneration,
    isLoading,
    startError,
    cancelError
  } = useComicGenerationQuery(journalEntryId);
        
  // onComplete 콜백 처리
  React.useEffect(() => {
    if (status.status === 'completed' && status.comic_data && onComplete) {
      onComplete(status.comic_data);
            }
  }, [status.status, status.comic_data, onComplete]);

  return {
    status,
    startGeneration,
    cancelGeneration,
    isLoading,
    startError,
    cancelError
  };
}; 