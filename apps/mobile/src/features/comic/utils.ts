import { ComicGridItem, ComicGridItemAction, ComicGridItemType, ComicPanelInfo, CompleteComicData, IncompleteComicData } from '@autiverse-monorepo/ts-core';
import colors from 'tailwindcss/colors';

/**
 * 5x5 빈 그리드 생성
 */
export function createEmptyGrid(): ComicGridItem[][] {
  return Array.from({ length: 5 }, () =>
    Array.from({ length: 5 }, () => ({
      type: ComicGridItemType.Empty,
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
export function convertPanelGridToMatrix(panelGrid: ComicGridItem[]): ComicGridItem[][] {
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
      type: item.type || ComicGridItemType.Empty,
      content: item.content || '',
      position: [safeX, safeY],
      action: item.action, // action 정보도 포함
    };
  });
  
  return grid;
};

export function calculateCalloutBounds(callouts: Array<{item: ComicGridItem, action: ComicGridItemAction}>, 
    tiles: ComicGridItem[][]): Array<{x: number, y: number, x2: number, y2: number}> {
  const result: Array<{x: number, y: number, x2: number, y2: number}> = [];
  const occupiedPositions = new Set<string>(); // 이미 사용된 위치 추적
  
  callouts.forEach((callout) => {
    const [itemX, itemY] = callout.item.position || [0, 0];
    
    // item 위치 주변의 가능한 위치들을 우선순위 순으로 정렬
    const possiblePositions = [];
    
    // 1. item 바로 옆 위치들 (상하좌우)
    const adjacentPositions = [
      [itemX + 1, itemY], // 오른쪽
      [itemX - 1, itemY], // 왼쪽
      [itemX, itemY + 1], // 아래
      [itemX, itemY - 1], // 위
    ];
    
    // 2. item 대각선 위치들
    const diagonalPositions = [
      [itemX + 1, itemY + 1], // 오른쪽 아래
      [itemX + 1, itemY - 1], // 오른쪽 위
      [itemX - 1, itemY + 1], // 왼쪽 아래
      [itemX - 1, itemY - 1], // 왼쪽 위
    ];
    
    // 3. 더 멀리 있는 위치들 (2칸 거리)
    const distantPositions = [
      [itemX + 2, itemY], [itemX - 2, itemY], [itemX, itemY + 2], [itemX, itemY - 2],
      [itemX + 2, itemY + 1], [itemX + 2, itemY - 1], [itemX - 2, itemY + 1], [itemX - 2, itemY - 1],
      [itemX + 1, itemY + 2], [itemX - 1, itemY + 2], [itemX + 1, itemY - 2], [itemX - 1, itemY - 2],
    ];
    
    // 우선순위 순으로 가능한 위치들을 추가
    possiblePositions.push(...adjacentPositions, ...diagonalPositions, ...distantPositions);
    
    // 유효한 위치 찾기
    let selectedPosition: [number, number] | null = null;
    
    for (const [x, y] of possiblePositions) {
      // 그리드 범위 내에 있는지 확인
      if (x < 0 || x >= 5 || y < 0 || y >= 5) continue;
      
      // 빈 타일인지 확인
      if (tiles[y][x].type !== ComicGridItemType.Empty) continue;
      
      // 이미 사용된 위치인지 확인
      const positionKey = `${x},${y}`;
      if (occupiedPositions.has(positionKey)) continue;
      
      selectedPosition = [x, y];
      break;
    }
    
    // 만약 위의 위치들이 모두 사용 중이라면, 남은 빈 타일 중에서 가장 가까운 위치 찾기
    if (!selectedPosition) {
      let minDistance = Infinity;
      
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          if (tiles[y][x].type !== ComicGridItemType.Empty) continue;
          
          const positionKey = `${x},${y}`;
          if (occupiedPositions.has(positionKey)) continue;
          
          // Manhattan distance 계산
          const distance = Math.abs(x - itemX) + Math.abs(y - itemY);
          if (distance < minDistance) {
            minDistance = distance;
            selectedPosition = [x, y];
          }
        }
      }
    }
    
    // 위치를 찾았다면 결과에 추가하고 사용된 위치로 표시
    if (selectedPosition) {
      const [x, y] = selectedPosition;
      const positionKey = `${x},${y}`;
      occupiedPositions.add(positionKey);
      
      result.push({
        x: x,
        y: y,
        x2: x + 1,
        y2: y + 1
      });
    }
  });
  
  return result;
}

/**
 * 타일 타입별 색상 반환
 * @param type - 타일 타입
 * @returns 색상 코드
 */
export function getTileColor(item: ComicGridItem): string {
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

export function convertComicDataToPanels(comicData: IncompleteComicData): CompleteComicData {
  const panels: Record<string, any> = {};

  // 1-4 패널을 루프로 처리
  for (let i = 1; i <= 4; i++) {
    const panelKey = `panel${i}` as keyof IncompleteComicData;
    const panelData = comicData[panelKey];

    if (panelData && typeof panelData === 'object' && (panelData as ComicPanelInfo).content !== undefined) {
      // 1. 이미 올바른 구조인 경우 (admin-web과 동일)
      panels[panelKey] = {
        content: (panelData as ComicPanelInfo).content || '',
        place: (panelData as ComicPanelInfo).place || '',
        grid: (panelData as ComicPanelInfo).grid || []
      };
    } else if (panelData) {
      // 2. 단순 문자열인 경우
      panels[panelKey] = {
        content: panelData as string,
        place: '',
        grid: []
      };
    } else {
      // 3. 데이터가 없는 경우 빈 패널 생성
      panels[panelKey] = {
        content: '',
        place: '',
        grid: []
      };
    }
  }

  return panels as CompleteComicData;
};
 