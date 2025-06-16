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

interface FourSceneComicProps {
  panels: Record<string, Panel>;
}

// Styled components
const ComicContainer = styled.div`
  display: flex;
  gap: 32px;
  padding: 16px;
  border-radius: 8px;
  max-width: 1200px;
  margin: 0 auto;
  align-items: flex-start;
`;

const PanelsContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 350px);
  grid-template-rows: repeat(2, 350px);
  gap: 16px;
  justify-content: center;
`;

const TextContainer = styled.div`
  flex: 0 0 300px;
  padding: 16px;
  background: white;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  height: 716px;
  overflow-y: auto;
`;

const StoryText = styled.div`
  margin-bottom: 16px;
  padding: 8px;
  border-radius: 4px;
  background: #f8f9fa;
  &:last-child {
    margin-bottom: 0;
  }
`;

const PanelContainer = styled.div`
  background: white;
  padding: 16px;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
`;

const PanelNumber = styled.div`
  position: absolute;
  top: 8px;
  left: 8px;
  width: 28px;
  height: 28px;
  background: #4A5568;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: bold;
  z-index: 1;
`;

const PanelGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  grid-template-rows: repeat(5, 1fr);
  gap: 2px;
  aspect-ratio: 1;
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
  font-size: 14px;
  aspect-ratio: 1;
  padding: 4px;
  text-align: center;
  word-break: keep-all;
  white-space: pre-wrap;
  line-height: 1.2;
  min-height: 100%;
  
  /* 호버 시 툴팁 스타일 */
  position: relative;
  
  &:hover::after {
    content: attr(title);
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
    z-index: 10;
  }
`;

export const FourSceneComic: React.FC<FourSceneComicProps> = ({ panels }) => {
  return (
    <ComicContainer>
      <PanelsContainer>
        {['panel1', 'panel2', 'panel3', 'panel4'].map((panelId, index) => {
          const panel = panels[panelId];
          return (
            <PanelContainer key={panelId}>
              <PanelNumber>{index + 1}</PanelNumber>
              <PanelGrid>
                {panel.grid.map((row, y) =>
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
      
      <TextContainer>
        <h3 className="text-lg font-bold mb-4">스토리</h3>
        {['panel1', 'panel2', 'panel3', 'panel4'].map((panelId, index) => (
          <StoryText key={panelId}>
            <span className="font-bold">{index + 1}. </span>
            {panels[panelId].content}
          </StoryText>
        ))}
      </TextContainer>
    </ComicContainer>
  );
};

export default FourSceneComic; 