import { ComicGridItem, ComicGridItemAction, ComicGridItemType, ComicPanelInfo, Person } from "@autiverse-monorepo/ts-core";
import { View, Text, LayoutChangeEvent } from "react-native";
import { useCallback, useMemo, useState } from "react";
import { styleTemplates } from "../../../styles";
import { calculateCalloutBounds, convertPanelGridToMatrix, getTileColor } from "../utils";
import { Pawn } from "./Pawn";
import { useDyad } from "../../../api/dyad";
import { SceneObject } from "./SceneObject";
import Color from "color";
import { ComicElementSize, ComicProvider, useGetFigureColor } from "../styles";
import { Callout } from "./Callout";


export const ComicPanelView = ({
  panelIndex, panel, isHighlighted = false, panelSize, showStory = true, elementSize = ComicElementSize.medium
}: {
  panelIndex: number;
  panel: ComicPanelInfo;
  isHighlighted?: boolean;
  panelSize?: number;
  showStory?: boolean;
  elementSize?: ComicElementSize;
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

  const matrix = useMemo(() => {
    return convertPanelGridToMatrix(panel.grid);
  }, [panel.grid])

  const callouts = useMemo(() => {
    const figures = panel.grid.filter((item: ComicGridItem) => item.type === ComicGridItemType.Figure);
    const figuresWithCallouts = figures.filter((item: ComicGridItem) => item.action?.some((action) => action.type === 'tell' || action.type === 'think'));
    const actionsWithItem: Array<{item: ComicGridItem, action: ComicGridItemAction}> = []
    figuresWithCallouts.forEach((item: ComicGridItem) => {
      item.action?.forEach((action) => {
        if(action.type === 'tell' || action.type === 'think') {
          actionsWithItem.push({item, action})
        }
      })
    })

    const bounds = calculateCalloutBounds(actionsWithItem, matrix)
    
    return actionsWithItem.map((action, index) => {
      return {
        ...action,
        bounds: bounds[index]
      }
    })

  }, [panel.grid, matrix])

  return (<ComicProvider elementSize={elementSize} gridSize={gridSize}>
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
        <View className="mb-2 p-2 rounded-lg border-l-3 border-blue-500">
          <Text className="text-base text-gray-800 leading-6" style={styleTemplates.withSemiboldFont}>
            <Text className="text-blue-500" style={styleTemplates.withBoldFont}>{panelIndex + 1}. </Text>
            {!panel.content?.startsWith('null') && panel.content}
          </Text>
        </View>
      )}

      {/* 5x5 그리드 */}
      <View className="flex-1 justify-center items-center bg-gray-50 rounded-lg" 
      onLayout={onLayoutPanelArea}>
        <View style={{ width: effectivePanelSize, height: effectivePanelSize, position: 'relative' }}>
          {/* backend에서 받은 layout 데이터를 5x5 grid로 변환 */}
          {matrix.length > 0 ? matrix.map((row, y) => (
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
                      return (
                        <View
                          key={`${x}-${y}`}
                          style={{
                            position: 'relative',
                            width: gridSize,
                            height: gridSize,
                          }}  
                        >
                          <Pawn 
                            bodyWidth={gridSize-8} 
                            item={tile}
                          />
                        </View>
                      );
                    }

                    // 다른 타입들은 기존대로 텍스트 표시
                    let tolerableLeft = 0;
                    let tolerableRight = 0;
                    if(x > 0 && row[x-1].type === ComicGridItemType.Empty){
                      tolerableLeft = 0.5;
                    }
                    if(x < 4 && row[x+1].type === ComicGridItemType.Empty){
                      tolerableRight = 0.5;
                    }

                    return (<View
                      key={`${x}-${y}`}
                      style={{
                        position: 'relative',
                        width: gridSize,
                        height: gridSize,
                      }}  
                    >
                      <SceneObject
                        key={`${x}-${y}`}
                        item={tile}
                        pivotPosition={{x: gridSize / 2, y: gridSize / 2}}
                        tolerableLeft={tolerableLeft}
                        tolerableRight={tolerableRight}
                      /></View>
                    );
                  })}
                </View>
              )) : (
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
          {/* Render emotions and callouts */}
          { 
            callouts.length > 0 && callouts.map((callout, index) => {
              return <Callout key={`${index}`} {...callout}/>
          })
          }
        </View>

          
          {/* 장소 정보를 오른쪽 하단에 표시 */}
          {panel.place && panel.place.trim() && (
            <View className="absolute bottom-2 right-2 px-2 py-1">
              <Text className="text-sm text-gray-600" style={styleTemplates.withRegularFont}>
                [📍 {panel.place}]
              </Text>
            </View>
          )}
      </View>
    </View></ComicProvider>
  );
};
