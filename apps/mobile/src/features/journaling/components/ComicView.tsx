import React from 'react';
import { View, Text, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
// @ts-ignore
import format from 'string-format';
import { convertComicDataToPanels } from '../utils';
import { styleTemplates } from '../../../styles';
import { ComicPanel } from './ComicPanel';
import { useSession } from '../hooks/useSession';
import { ComicPanelInfo, MessageIntent } from '@autiverse-monorepo/ts-core';
import { ComicGenerationStatus } from '../api';

export const ComicView = ({
  className,
  comicGenerationStatus,
  progressAnimation,
  sessionId,
}: {
  className?: string;
  comicGenerationStatus: ComicGenerationStatus;
  progressAnimation: Animated.Value;
  sessionId: string;
}) => {
  const { t } = useTranslation();

  const {sessionInfo} = useSession({sessionId: sessionId});

  const comicData = sessionInfo?.panels;
 
  const currentStage = sessionInfo?.stage;
  const focusedPanel = sessionInfo?.focusedPanel;

  const completeComicData = React.useMemo(() => {
    if(!comicData) {
      return null;
    }
    return convertComicDataToPanels(comicData);
  }, [comicData]);

  // 만화 패널 렌더링 함수
  const renderComicPanels = () => {
    if (!completeComicData) {
      return (
        <View className="flex-1 items-center justify-center">
          <Text className="text-lg text-gray-600 text-center" style={styleTemplates.withSemiboldFont}>
            {t('ChatStage.DefaultComicMessage')}
          </Text>
        </View>
      );
    }

    const renderPanel = (panelId: string, panelIndex: number) => {
      const panel: ComicPanelInfo = (completeComicData as any)[panelId];
      const isHighlighted = focusedPanel === panelId;

      return (
        <ComicPanel
          key={panelId}
          panelId={panelId}
          panelIndex={panelIndex}
          panel={panel}
          isHighlighted={isHighlighted}
        />
      );
    };

    return (
      <View className="flex-1 p-4">
        <View className="flex-1">
          {/* 첫 번째 행 */}
          <View className="flex-row flex-1 mb-4">
            {renderPanel('panel1', 0)}
            {renderPanel('panel2', 1)}
          </View>
          {/* 두 번째 행 */}
          <View className="flex-row flex-1">
            {renderPanel('panel3', 2)}
            {renderPanel('panel4', 3)}
          </View>
        </View>
      </View>
    );
  };

  return (<View className={className}>
            {/* 기존 만화 또는 기본 메시지 */}
            <View className={`flex-1 ${comicGenerationStatus.status === 'generating' || comicGenerationStatus.status?.startsWith('generating') ? 'opacity-30' : ''}`}>
              {comicData && (currentStage === 'revision_1' || currentStage === 'comic_context' || currentStage === 'revision_2' || currentStage === 'title' || currentStage === 'complete') ? (
                renderComicPanels()
              ) : (
                <View className="flex-1 items-center justify-center">
                  <Text className="text-lg text-gray-600 text-center" style={styleTemplates.withSemiboldFont}>
                  {t('ChatStage.DefaultComicMessage')}
                  </Text>
                </View>
              )}
            </View>
            
            {/* 만화 생성 중일 때 반투명 오버레이와 프로그레스 바 */}
            {(comicGenerationStatus.status === 'generating' || comicGenerationStatus.status?.startsWith('generating')) && (
              <View className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center">
                <View className="bg-white p-6 rounded-xl shadow-lg max-w-sm w-4/5">
                  {/* 로딩 애니메이션 */}
                  <View className="flex-row justify-center mb-4">
                    <View className="flex-row space-x-1">
                      {[0, 1, 2].map((i) => (
                        <View
                          key={i}
                          className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"
                          style={{
                            opacity: 0.6,
                            transform: [{ scale: 0.8 }],
                          }}
                        />
                      ))}
                    </View>
                  </View>

                  {/* 메시지 */}
                  <Text className="text-center mb-4 text-lg text-gray-800" style={styleTemplates.withBoldFont}>
                    {comicGenerationStatus.message}
                  </Text>

                  {/* 프로그레스 바 */}
                  <View className="w-full bg-gray-200 rounded-full h-2 mb-2 overflow-hidden">
                    <Animated.View
                      className="bg-blue-500 h-2 rounded-full"
                      style={{
                        width: progressAnimation.interpolate({
                          inputRange: [0, 100],
                          outputRange: ['0%', '100%'],
                        }),
                      }}
                    />
                  </View>

                  {/* 프로그레스 퍼센트 */}
                  <Text className="text-center text-sm text-gray-600" style={styleTemplates.withSemiboldFont}>
                    {format(t('ChatStage.ProgressCompleteTemplate'), { progress: Math.round(comicGenerationStatus.progress) })}
                  </Text>
                </View>
              </View>
            )}
          </View>);
}; 