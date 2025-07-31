import { ComicGridItem, ComicGridItemType, ComicPanelInfo, CompleteComicData, IncompleteComicData } from '@autiverse-monorepo/ts-core';
import colors from 'tailwindcss/colors';

export interface ComicGridTile {
  type: string;
  content: string;
  position: [number, number];
  action?: Array<{type: 'tell'|'emotion'|'think', content: string}>;
}

/**
 * 5x5 빈 그리드 생성
 */
export const createEmptyGrid = (): ComicGridTile[][] => {
  return Array.from({ length: 5 }, () =>
    Array.from({ length: 5 }, () => ({
      type: 'empty',
      content: '',
      position: [0, 0],
    }))
  );
};

/**
 * 패널의 grid 데이터를 5x5 그리드로 변환
 * @param panelGrid - 백엔드에서 받은 grid 데이터
 * @returns 5x5 그리드 배열
 */
export const convertPanelGridToMatrix = (panelGrid: ComicGridItem[]): ComicGridTile[][] => {
  // 5x5 빈 그리드 생성
  const grid = createEmptyGrid();
  
  if (!panelGrid || panelGrid.length === 0) {
    return grid;
  }
  
  // layout 데이터를 position에 따라 배치
  panelGrid.forEach((item: any) => {
    // tell, think, emotion 타입은 grid에 배치하지 않음 (Pawn의 action으로만 표시)
    if (item.type === 'tell' || item.type === 'think' || item.type === 'emotion') {
      return;
    }
    
    // location 타입도 grid에 배치하지 않음 (패널 속성으로만 표시)
    if (item.type === 'location') {
      return;
    }
    
    const [x, y] = item.position || [0, 0];
    // NaN 값 방지
    const safeX = isNaN(x) ? 0 : Math.max(0, Math.min(4, Math.floor(x)));
    const safeY = isNaN(y) ? 0 : Math.max(0, Math.min(4, Math.floor(y)));
    
    grid[safeY][safeX] = {
      type: item.type || 'empty',
      content: item.content || '',
      position: [safeX, safeY],
      action: item.action, // action 정보도 포함
    };
  });
  
  return grid;
};

/**
 * 타일 타입별 색상 반환
 * @param type - 타일 타입
 * @returns 색상 코드
 */
export const getTileColor = (item: ComicGridItem): string => {
  if(item.content === '나') {
    return colors.orange[400];  // 연한 주황색 (인물)
  }
  switch (item.type) {
    case 'figure': {
      if(item.content === '나') {
        return colors.orange[400];  // 연한 주황색 (인물)
      } else {
        return colors.fuchsia[300];  // 연한 주황색 (인물)
      }
    }
    case 'object': return '#B2DFDB';  // 연한 청록색 (물건)
    default: return '#FFFFFF';  // 흰색 (빈 칸)
  }
};

export const convertComicDataToPanels = (comicData: IncompleteComicData): CompleteComicData => {
  const panels: Record<string, any> = {};

  // 1-4 패널을 루프로 처리
  for (let i = 1; i <= 4; i++) {
    const panelKey = `panel${i}` as keyof IncompleteComicData;
    const panelData = comicData[panelKey];

    if (panelData && typeof panelData === 'object' && (panelData as ComicPanelInfo).content !== undefined) {
      // 1. 이미 올바른 구조인 경우 (admin-web과 동일)
      panels[panelKey] = {
        content: (panelData as ComicPanelInfo).content || '',
        grid: (panelData as ComicPanelInfo).grid || []
      };
    } else if (panelData) {
      // 2. 단순 문자열인 경우
      panels[panelKey] = {
        content: panelData as string,
        grid: []
      };
    } else {
      // 3. 데이터가 없는 경우 빈 패널 생성
      panels[panelKey] = {
        content: '',
        grid: []
      };
    }
  }

  return panels as CompleteComicData;
};
 