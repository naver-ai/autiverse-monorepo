import React from 'react';
import styled from '@emotion/styled';

// Types matching the backend structures
type TileType = 'empty' | 'figure' | 'object' | 'location' | 'action' | 'think' | 'tell' | 'emotion';

interface Tile {
  type: TileType;
  content: string;
  position: [number, number];
}

interface Panel {
  content: string;
  grid: Tile[][];
}

interface TabletFourSceneComicProps {
  panels: Record<string, Panel>;
  focusedPanel?: string;
}

// Styled components optimized for tablet
const ComicContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 2px 5px 5px 5px;
  border-radius: 12px;
  width: 100%;
  height: 100vh;
  max-width: 900px;
  max-height: 100vh;
  margin: 15vh auto 0 auto;
  align-items: center;
  justify-content: flex-start;
`;

const PanelsContainer = styled.div<{ maxContentLength: number }>`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 15px;
  width: 100%;
  max-width: 700px;
  max-height: 400px;
  aspect-ratio: 2;
  justify-items: center;
  align-items: start;
`;

const TextContainer = styled.div`
  width: 100%;
  max-width: 600px;
  padding: 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border: 2px solid #e0e0e0;
`;

const StoryText = styled.div`
  margin-bottom: 15px;
  padding: 12px;
  border-radius: 8px;
  background: #f8f9fa;
  border-left: 4px solid #4A90E2;
  font-size: 16px;
  line-height: 1.5;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const PanelContainer = styled.div<{ highlight?: boolean; contentLength: number }>`
  background: white;
  padding: 8px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border: 2px solid #e0e0e0;
  position: relative;
  width: 100%;
  height: 330px;
  max-height: 330px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  ${({ highlight }) =>
    highlight &&
    `
      border: 3px solid #e53935 !important;
      box-shadow: 0 0 0 4px rgba(229,57,53,0.15);
    `}
`;

const PanelStoryText = styled.div`
  margin-bottom: 6px;
  padding: 6px 10px;
  border-radius: 6px;
  background: #f8f9fa;
  border-left: 3px solid #4A90E2;
  font-size: 14px;
  line-height: 1.4;
  color: #333;
  flex-shrink: 0;
`;

const PanelNumber = styled.div`
  position: absolute;
  top: 12px;
  right: 12px;
  width: 28px;
  height: 28px;
  background: #4A90E2;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: bold;
  z-index: 1;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
`;

const PanelGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  grid-template-rows: repeat(5, 1fr);
  gap: 3px;
  width: 200px;
  height: 200px;
  margin: 0 auto;
  flex: 1;
  justify-content: center;
  align-items: center;
`;

const Tile = styled.div<{ type: TileType }>`
  background: ${props => {
    switch (props.type) {
      case 'figure': return '#FFE0B2';  // 연한 주황색 (인물)
      case 'object': return '#B2DFDB';  // 연한 청록색 (물건)
      case 'location': return '#E1BEE7';  // 연한 보라색 (장소)
      case 'think': return '#C8E6C9';  // 연한 초록색 (생각)
      case 'tell': return '#BBDEFB';  // 연한 파란색 (대화)
      case 'emotion': return '#F8BBD0';  // 연한 분홍색 (감정)
      default: return '#FFFFFF';  // 흰색 (빈 칸)
    }
  }};
  border: 1px solid #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  aspect-ratio: 1;
  padding: 4px;
  text-align: center;
  word-break: keep-all;
  white-space: pre-wrap;
  line-height: 1.2;
  min-height: 100%;
  border-radius: 4px;
  
  /* 호버 시 툴팁 스타일 */
  position: relative;
  
  &:hover::after {
    content: attr(title);
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 14px;
    white-space: nowrap;
    z-index: 10;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
`;

const StoryTitle = styled.h3`
  font-size: 20px;
  font-weight: bold;
  margin-bottom: 15px;
  color: #333;
  text-align: center;
`;

const PanelNumberText = styled.span`
  font-weight: bold;
  color: #4A90E2;
  margin-right: 8px;
`;

export const TabletFourSceneComic: React.FC<TabletFourSceneComicProps> = ({ panels, focusedPanel }) => {
  // 모든 패널의 스토리 길이를 계산하여 최대 길이 찾기
  const allContentLengths = Object.values(panels).map(panel => 
    panel?.content?.length || 0
  );
  
  const maxContentLength = Math.max(...allContentLengths);

  return (
    <ComicContainer>
      <PanelsContainer maxContentLength={maxContentLength}>
        {['panel1', 'panel2', 'panel3', 'panel4'].map((panelId, index) => {
          const panel = panels[panelId];
          if (!panel) {
            return null; // 패널이 null이면 아예 렌더링하지 않음
          }
          const highlight = focusedPanel === panelId;
          return (
            <PanelContainer key={panelId} highlight={highlight} contentLength={panel.content?.length || 0}>
              <PanelStoryText>
                <PanelNumberText>{index + 1}.</PanelNumberText>
                {!panel.content?.startsWith('null') && panel.content}
              </PanelStoryText>
              <PanelGrid>
                {panel.grid && panel.grid.map((row, y) =>
                  row.map((tile, x) => (
                    <Tile
                      key={`${x}-${y}`}
                      type={tile.type}
                      title={tile.content}
                    >
                      {tile.content}
                    </Tile>
                  ))
                )}
              </PanelGrid>
            </PanelContainer>
          );
        })}
      </PanelsContainer>
    </ComicContainer>
  );
};

export default TabletFourSceneComic; 