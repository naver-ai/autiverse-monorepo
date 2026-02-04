import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { useMemo, memo } from 'react';
import { styleTemplates } from '../../../styles';
import { ComicPanelView } from '../../comic/components/ComicPanelView';
import { GridView } from '../../../components/GridView';
// @ts-ignore
import format from 'string-format';
import { useTranslation } from 'react-i18next';
import { escapeJongseong, GalleryComicItem, UserLocale } from '@autiverse-monorepo/ts-core';
import { useDyad } from '../../../api/dyad';
import { twMerge } from 'tailwind-merge';
import { ComicElementSize } from '../../comic/styles';

export const JournalListElement = memo(({
  comic,
  onPress,
  style,
}: {
  comic: GalleryComicItem;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) => {
  const { t } = useTranslation();
  const { locale } = useDyad();
  const dayNames = locale === UserLocale.English
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : ['일', '월', '화', '수', '목', '금', '토'];

  const title = useMemo(() => {
    return (
      comic.title ||
      format(t('Journaling.DefaultTitleTemplate'), {
        child_name: escapeJongseong(comic.child_name || '친구'),
        agent_name: escapeJongseong(comic.agent_name || '친구'),
      })
    );
  }, [comic.title, comic.child_name, comic.agent_name, t]);

  const isComplete = useMemo(() => comic.stage === 'complete', [comic.stage]);

  return (
    <TouchableOpacity
      key={comic.id}
      className="w-[430px] h-[480px] bg-white rounded-xl p-2 mb-4 shadow-lg shadow-black/10"
      onPress={onPress}
    >
      <View className="w-full flex-1 rounded-lg overflow-hidden">
        {comic.panels && comic.panels.length > 0 ? (
          // 4개 패널을 2x2 그리드로 배치한 미리보기
          <GridView
            numColumns={2}
            numRows={2}
            gapX={2}
            gapY={2}
            className="w-full h-full"
          >
            {[0, 1, 2, 3].map((panelIndex: number) => (
              <View
                key={panelIndex}
                className="w-full h-full justify-center items-center"
              >
                <ComicPanelView
                  panelIndex={panelIndex}
                  panel={comic.panels[panelIndex]}
                  showStory={false}
                  elementSize={ComicElementSize.small}
                />
              </View>
            ))}
          </GridView>
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

      {/* Title - 하단: 제목은 남은 공간만 쓰고, 완성 배지는 오른쪽에 고정 */}
      <View className="flex-row justify-between items-center gap-2 px-2 py-2">
        <View className="flex-1 min-w-0">
          <Text
            className="text-lg text-gray-800"
            style={styleTemplates.withSemiboldFont}
            numberOfLines={2}
          >
            {comic.created_at ? (() => {
              const date = new Date(comic.created_at);
              const month = date.getMonth() + 1;
              const day = date.getDate();
              const dayOfWeek = dayNames[date.getDay()];
              return `[${month}/${day} (${dayOfWeek})]`;
            })() : ''}{' '}
            {title}
          </Text>
        </View>
        <Text
          style={styleTemplates.withBoldFont}
          className={twMerge(
            'flex-shrink-0 px-3 py-1 rounded-full text-base',
            isComplete ? 'text-white bg-green-500' : 'text-black bg-yellow-400',
          )}
        >
          {isComplete ? '완성' : '미완성'}
        </Text>
      </View>
    </TouchableOpacity>
  );
});
