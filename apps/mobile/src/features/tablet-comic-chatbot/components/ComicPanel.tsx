import React from 'react';
import { View, Text } from 'react-native';
import { getTileColor } from '../utils';
import { styleTemplates } from '../../../styles';

interface ComicPanelProps {
  panelId: string;
  panelIndex: number;
  panel: any;
  isHighlighted: boolean;
}

export const ComicPanel: React.FC<ComicPanelProps> = ({
  panelId,
  panelIndex,
  panel,
  isHighlighted
}) => {
  // admin-web과 동일: 패널이 없으면 아예 렌더링하지 않음
  if (!panel) {
    return null;
  }

  return (
    <View 
      className={`bg-white p-2 rounded-xl shadow-md border-2 ${
        isHighlighted ? 'border-red-500 border-3' : 'border-gray-200'
      }`}
      style={{ 
        height: 330, 
        maxHeight: 330,
        flex: 1,
        marginHorizontal: 4,
        ...(isHighlighted && {
          borderWidth: 3,
          borderColor: '#e53935',
          shadowColor: '#e53935',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
          elevation: 8
        })
      }}
    >
      {/* 스토리 텍스트 (admin-web과 동일한 스타일) */}
      <View className="mb-2 p-2 bg-gray-50 rounded-lg border-l-3 border-blue-500">
        <Text className="text-sm text-gray-800 leading-5" style={styleTemplates.withSemiboldFont}>
          <Text className="font-bold text-blue-500" style={styleTemplates.withBoldFont}>{panelIndex + 1}. </Text>
          {!panel.content?.startsWith('null') && panel.content}
        </Text>
      </View>

      {/* 5x5 그리드 (admin-web과 동일: 항상 표시) */}
      <View className="flex-1 justify-center items-center">
        <View style={{ width: 200, height: 200 }}>
          {/* backend에서 받은 layout 데이터를 5x5 grid로 변환 */}
          {panel?.grid && panel.grid.length > 0 ? (
            // 5x5 빈 그리드 생성 후 layout 데이터로 채우기
            (() => {
              // 5x5 빈 그리드 생성
              const grid = Array.from({ length: 5 }, () => 
                Array.from({ length: 5 }, () => ({
                  type: 'empty',
                  content: '',
                  position: [0, 0]
                }))
              );
              
              // layout 데이터를 position에 따라 배치
              panel.grid.forEach((item: any) => {
                const [x, y] = item.position || [0, 0];
                // NaN 값 방지
                const safeX = isNaN(x) ? 0 : Math.max(0, Math.min(4, Math.floor(x)));
                const safeY = isNaN(y) ? 0 : Math.max(0, Math.min(4, Math.floor(y)));
                
                grid[safeY][safeX] = {
                  type: item.type || 'empty',
                  content: item.content || '',
                  position: [safeX, safeY]
                };
              });
              
              // 5x5 grid 렌더링
              return grid.map((row: any[], y: number) => (
                <View key={y} style={{ flexDirection: 'row', height: 40 }}>
                  {row.map((tile: any, x: number) => (
                    <View
                      key={`${x}-${y}`}
                      style={{ 
                        width: 40,
                        height: 40,
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
              <View key={y} style={{ flexDirection: 'row', height: 40 }}>
                {Array.from({ length: 5 }, (_, x) => (
                  <View
                    key={`${x}-${y}`}
                    style={{ 
                      width: 40,
                      height: 40,
                      borderWidth: 1,
                      borderColor: '#ddd',
                      borderRadius: 4,
                      backgroundColor: '#FFFFFF',
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}
                  />
                ))}
              </View>
            ))
          )}
        </View>
      </View>
    </View>
  );
}; 