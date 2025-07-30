import { IncompleteComicData, ComicPanelInfo, CompleteComicData } from '@autiverse-monorepo/ts-core';

// 타일 타입별 색상 정의
export const getTileColor = (type: string) => {
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

export const convertComicDataToPanels = (comicData: IncompleteComicData): CompleteComicData => {
  
  // admin-web의 TabletFourSceneComic과 동일한 구조로 변환
  const panels: Record<string, any> = {};
  
  // backend에서 오는 데이터 구조를 처리
  // 1. 이미 올바른 구조인 경우 (admin-web과 동일)
  if (comicData.panel1 && typeof comicData.panel1 === 'object' && (comicData.panel1 as ComicPanelInfo).content !== undefined) {
    panels.panel1 = {
      content: (comicData.panel1 as ComicPanelInfo).content || '',
      grid: (comicData.panel1 as ComicPanelInfo).grid || []
    };
  } else if (comicData.panel1) {
    // 2. 단순 문자열인 경우
    panels.panel1 = {
      content: comicData.panel1 as string,
      grid: []
    };
  } else {
    // 3. 데이터가 없는 경우 빈 패널 생성
    panels.panel1 = {
      content: '',
      grid: []
    };
  }
  
  if (comicData.panel2 && typeof comicData.panel2 === 'object' && (comicData.panel2 as ComicPanelInfo).content !== undefined) {
    panels.panel2 = {
      content: (comicData.panel2 as ComicPanelInfo).content || '',
      grid: (comicData.panel2 as ComicPanelInfo).grid || []
    };
  } else if (comicData.panel2) {
    panels.panel2 = {
      content: comicData.panel2 as string,
      grid: []
    };
  } else {
    panels.panel2 = {
      content: '',
      grid: []
    };
  }
  
  if (comicData.panel3 && typeof comicData.panel3 === 'object' && (comicData.panel3 as ComicPanelInfo).content !== undefined) {
    panels.panel3 = {
      content: (comicData.panel3 as ComicPanelInfo).content || '',
      grid: (comicData.panel3 as ComicPanelInfo).grid || []
    };
  } else if (comicData.panel3) {
    panels.panel3 = {
      content: comicData.panel3 as string,
      grid: []
    };
  } else {
    panels.panel3 = {
      content: '',
      grid: []
    };
  }
  
  if (comicData.panel4 && typeof comicData.panel4 === 'object' && (comicData.panel4 as ComicPanelInfo).content !== undefined) {
    panels.panel4 = {
      content: (comicData.panel4 as ComicPanelInfo).content || '',
      grid: (comicData.panel4 as ComicPanelInfo).grid || []
    };
  } else if (comicData.panel4) {
    panels.panel4 = {
      content: comicData.panel4 as string,
      grid: []
    };
  } else {
    panels.panel4 = {
      content: '',
      grid: []
    };
  }
  
  return panels as CompleteComicData;
};

// 현재 요일 가져오기
export const getCurrentDay = () => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date().getDay()];
}; 