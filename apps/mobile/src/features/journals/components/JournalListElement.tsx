import { TouchableOpacity, View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useMemo } from 'react';
import { styleTemplates } from '../../../styles';
import { ComicPanelView } from '../../comic/components/ComicPanelView';
// @ts-ignore
import format from 'string-format';
import { useTranslation } from 'react-i18next';
import { escapeJongseong, GalleryComicItem } from '@autiverse-monorepo/ts-core';
import { twMerge } from 'tailwind-merge';

export const JournalListElement = ({
  comic,
  onPress,
  style
}: {
  comic: GalleryComicItem;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) => {

    const {t} = useTranslation();

  // badge 컴포넌트
  const renderBadge = (stage: string) => {
    const isComplete = stage === 'complete';
    return (
      <View
        className={twMerge(
          'absolute top-1.5 right-1.5 px-1.5 py-1 rounded-full z-10',
          isComplete ? 'bg-green-500' : 'bg-yellow-400'
        )}
      >
        <Text
          className={twMerge(
            'text-xs font-bold',
            isComplete ? 'text-white' : 'text-black'
          )}
        >
          {isComplete ? '완성' : '미완성'}
        </Text>
      </View>
    );
  };

  const title = useMemo(() => {

    return comic.title || format(t('Journaling.DefaultTitleTemplate'), { 
      child_name: escapeJongseong(comic.child_name || '친구'),
      agent_name: escapeJongseong(comic.agent_name || '친구'),
    });

  }, [comic, t]);

  return (
    <TouchableOpacity 
      key={comic.id} 
      className="w-[400px] h-[450px] bg-white rounded-xl p-2 mb-4 shadow-lg shadow-black/10" 
      onPress={onPress}
    >
      {/* Badge - 오른쪽 상단 */}
      {renderBadge(comic.stage)}

      <View className="w-full flex-1 rounded-lg overflow-hidden mt-5 mb-1.5">
        {comic.panels && comic.panels.length > 0 ? (
          // 4개 패널을 2x2 그리드로 배치한 미리보기
          <View className="w-full h-full flex-col justify-between">
            {/* 첫 번째 행: 패널 1, 2 */}
            <View className="flex-row justify-between flex-1">
              {[0, 1].map((panelIndex: number) => (
                <View key={panelIndex} className="flex-1 justify-center items-center">
                  <ComicPanelView
                    panelIndex={panelIndex}
                    panel={comic.panels[panelIndex]}
                    panelSize={130}
                    showStory={false}
                  />
                </View>
              ))}
            </View>

            {/* 두 번째 행: 패널 3, 4 */}
            <View className="flex-row justify-between flex-1 gap-0.5">
              {[2, 3].map((panelIndex: number) => (
                <View key={panelIndex} className="flex-1 justify-center items-center">
                  <ComicPanelView
                    panelIndex={panelIndex}
                    panel={comic.panels[panelIndex]}
                    panelSize={130}
                    showStory={false}
                  />
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View className="w-full h-full justify-center items-center bg-gray-50">
            <Text
              className="text-sm text-center"
              style={styleTemplates.withBoldFont}
            >
              만화 없음
            </Text>
          </View>
        )}
      </View>

      {/* Title - 하단 */}
      <Text
        className="text-lg text-center mt-2"
        style={styleTemplates.withSemiboldFont}
        numberOfLines={2}
      >
        {comic.created_at
          ? (() => {
              const date = new Date(comic.created_at);
              const month = date.getMonth() + 1;
              const day = date.getDate();
              const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][
                date.getDay()
              ];
              return `[${month}/${day} (${dayOfWeek})]`;
            })()
          : ''}{' '}
        {title}
      </Text>
    </TouchableOpacity>
  );
};
