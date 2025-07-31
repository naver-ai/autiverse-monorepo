import { ComicPanelInfo, Person } from "@autiverse-monorepo/ts-core";
import { View, Text, LayoutChangeEvent } from "react-native";
import { useCallback, useState } from "react";
import { styleTemplates } from "../../../styles";
import { convertPanelGridToMatrix, getTileColor } from "../utils";
import { Pawn } from "./Pawn";
import { useDyad } from "../../../api/dyad";


export const ComicPanelView = ({
  panelIndex, panel, isHighlighted = false, panelSize, showStory = true
}: {
  panelIndex: number;
  panel: ComicPanelInfo;
  isHighlighted?: boolean;
  panelSize?: number;
  showStory?: boolean;
}) => {
  // 패널이 없으면 아예 렌더링하지 않음
  if (!panel) {
    return null;
  }

  const {dyad} = useDyad()

  // 동적 패널 사이즈를 위한 상태
  const [dynamicPanelSize, setDynamicPanelSize] = useState<number | null>(null);

  // panelSize가 제공되지 않았을 때 사용할 동적 사이즈 계산
  const effectivePanelSize = panelSize || dynamicPanelSize || 200; // 기본값 200
  const gridSize = effectivePanelSize / 5;

  const onLayoutPanelArea = useCallback((event: LayoutChangeEvent) => {
    // panelSize가 제공되지 않았을 때만 동적 사이즈 설정
    if (!panelSize) {
      const { width, height } = event.nativeEvent.layout;
      const containerSize = Math.min(width, height);
      setDynamicPanelSize(containerSize);
    }
  }, [panelSize])

  return (
    <View
      className={`flex-1 mx-1 p-2 bg-white rounded-lg ${isHighlighted ? 'border-orange-300 border-4' : 'border-gray-200'}`}
      style={isHighlighted && {
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 12
        }}
    >
      {/* 스토리 텍스트 */}
      {showStory && (
        <View className="mb-2 p-2 bg-gray-50 rounded-lg border-l-3 border-blue-500">
          <Text className="text-base text-gray-800 leading-6" style={styleTemplates.withSemiboldFont}>
            <Text className="text-blue-500" style={styleTemplates.withBoldFont}>{panelIndex + 1}. </Text>
            {!panel.content?.startsWith('null') && panel.content}
          </Text>
        </View>
      )}

      {/* 5x5 그리드 */}
      <View className="flex-1 justify-center items-center" 
      onLayout={onLayoutPanelArea}>
        <View style={{ width: effectivePanelSize, height: effectivePanelSize, position: 'relative' }}>
          {/* backend에서 받은 layout 데이터를 5x5 grid로 변환 */}
          {panel?.grid && panel.grid.length > 0 ? (
            // 5x5 빈 그리드 생성 후 layout 데이터로 채우기
            (() => {
              const grid = convertPanelGridToMatrix(panel.grid);

              // 5x5 grid 렌더링
              return grid.map((row, y) => (
                <View key={y} style={{ flexDirection: 'row', height: gridSize }}>
                  {row.map((tile: any, x: number) => {
                    // 빈 셀이거나 내용이 없으면 렌더링하지 않음
                    if (tile.type === 'empty' || !tile.content) {
                      return (
                        <View
                          key={`${x}-${y}`}
                          style={{
                            width: gridSize,
                            height: gridSize,
                            backgroundColor: 'transparent',
                          }}  
                        />
                      );
                    }

                    // figure 타입이면 Pawn 컴포넌트 표시
                    if (tile.type === 'figure' || tile.content === '나') {

                      const person = dyad?.people.find((person: Person) => person.name === tile.content);
                      const color = person?.avatar_config?.color || 'transparent'
                      return (
                        <View
                          key={`${x}-${y}`}
                          style={{
                            position: 'relative',
                            width: gridSize,
                            height: gridSize,
                            padding: 4
                          }}  
                        >
                          <Pawn 
                            bodyWidth={gridSize-8} 
                            bandColor={color} 
                            bodyPosition={{x: gridSize / 2, y: gridSize / 2}} 
                            label={tile.content}
                            actions={tile.action}
                          />
                        </View>
                      );
                    }

                    // 다른 타입들은 기존대로 텍스트 표시
                    return (
                      <View
                        key={`${x}-${y}`}
                        style={{
                          width: gridSize,
                          height: gridSize,
                          borderWidth: 1,
                          borderColor: '#ddd',
                          borderRadius: 4,
                          backgroundColor: getTileColor(tile),
                          justifyContent: 'center',
                          alignItems: 'center',
                          padding: 4
                        }}  
                      >
                        <Text style={{
                          fontSize: 12,
                          textAlign: 'center',
                          lineHeight: 14,
                          color: '#333',
                          ...styleTemplates.withSemiboldFont
                        }} numberOfLines={2}>
                          {tile.content}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ));
            })()
          ) : (
            // 빈 그리드 표시 (5x5)
            Array.from({ length: 5 }, (_, y) => (
              <View key={y} style={{ flexDirection: 'row', height: gridSize }}>
                {Array.from({ length: 5 }, (_, x) => (
                  <View
                    key={`${x}-${y}`}
                    style={{
                      width: gridSize,
                      height: gridSize,
                      borderWidth: 0.5,
                      borderColor: '#f0f0f0',
                      backgroundColor: 'transparent',
                    }} />
                ))}
              </View>
            ))
          )}
          
          {/* 장소 정보를 오른쪽 하단에 표시 */}
          {panel.place && panel.place.trim() && (
            <View 
              style={{
                position: 'absolute',
                bottom: 3,
                right: -40,
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#E5E7EB',
              }}
            >
              <Text className="text-xs text-gray-600" style={styleTemplates.withRegularFont}>
                📍 {panel.place}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};
