import { ComicPanelInfo } from "@autiverse-monorepo/ts-core";
import { View, Text, LayoutChangeEvent } from "react-native";
import { useCallback, useState } from "react";
import { styleTemplates } from "../../../styles";
import { convertPanelGridToMatrix, getTileColor } from "../utils";


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
      className={`flex-1 mx-1 p-2 bg-white rounded-lg ${isHighlighted ? 'border-orange-300 border-4 shadow-orange-300' : 'border-gray-200'}`}
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
        <View style={{ width: effectivePanelSize, height: effectivePanelSize }}>
          {/* backend에서 받은 layout 데이터를 5x5 grid로 변환 */}
          {panel?.grid && panel.grid.length > 0 ? (
            // 5x5 빈 그리드 생성 후 layout 데이터로 채우기
            (() => {
              const grid = convertPanelGridToMatrix(panel.grid);

              // 5x5 grid 렌더링
              return grid.map((row: any[], y: number) => (
                <View key={y} style={{ flexDirection: 'row', height: gridSize }}>
                  {row.map((tile: any, x: number) => (
                    <View
                      key={`${x}-${y}`}
                      style={{
                        width: gridSize,
                        height: gridSize,
                        borderWidth: 1,
                        borderColor: '#ddd',
                        borderRadius: 4,
                        backgroundColor: getTileColor(tile.type),
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
                  ))}
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
                      borderWidth: 1,
                      borderColor: '#ddd',
                      borderRadius: 4,
                      backgroundColor: '#FFFFFF',
                      justifyContent: 'center',
                      alignItems: 'center'
                    }} />
                ))}
              </View>
            ))
          )}
        </View>
      </View>
    </View>
  );
};
