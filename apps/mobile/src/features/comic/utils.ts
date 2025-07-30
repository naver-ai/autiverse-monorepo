import { ComicGridItem, ComicGridItemType, ComicPanelInfo, CompleteComicData, IncompleteComicData } from '@autiverse-monorepo/ts-core';

export interface ComicGridTile {
  type: string;
  content: string;
  position: [number, number];
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
    const [x, y] = item.position || [0, 0];
    // NaN 값 방지
    const safeX = isNaN(x) ? 0 : Math.max(0, Math.min(4, Math.floor(x)));
    const safeY = isNaN(y) ? 0 : Math.max(0, Math.min(4, Math.floor(y)));
    
    grid[safeY][safeX] = {
      type: item.type || 'empty',
      content: item.content || '',
      position: [safeX, safeY],
    };
  });
  
  return grid;
};

/**
 * 타일 타입별 색상 반환
 * @param type - 타일 타입
 * @returns 색상 코드
 */
export const getTileColor = (type: ComicGridItemType): string => {
  switch (type) {
    case 'figure': return '#FFE0B2';  // 연한 주황색 (인물)
    case 'object': return '#B2DFDB';  // 연한 청록색 (물건)
    case 'location': return '#E1BEE7';  // 연한 보라색 (장소)
    case 'think': return '#C8E6C9';  // 연한 초록색 (생각)
    case 'tell': return '#BBDEFB';  // 연한 파란색 (대화)
    case 'emotion': return '#F8BBD0';  // 연한 분홍색 (감정)
    default: return '#FFFFFF';  // 흰색 (빈 칸)
  }
};

/**
 * 그리드 크기별 스타일 설정
 */
export const getGridSizeStyles = (size: 'small' | 'medium' | 'large') => {
  switch (size) {
    case 'small':
      return {
        tileSize: 26,
        fontSize: 12,
        padding: 1,
      };
    case 'medium':
      return {
        tileSize: 40,
        fontSize: 12,
        padding: 4,
      };
    case 'large':
      return {
        tileSize: 50,
        fontSize: 14,
        padding: 6,
      };
    default:
      return {
        tileSize: 40,
        fontSize: 12,
        padding: 4,
      };
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
 