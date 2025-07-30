import { TouchableOpacity, View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useMemo } from 'react';
import { styleTemplates } from '../../../styles';
import { getTileColor } from '../../journaling/utils';
// @ts-ignore
import format from 'string-format';
import { useTranslation } from 'react-i18next';
import { ComicGridItem, ComicGridItemType, escapeJongseong, GalleryComicItem } from '@autiverse-monorepo/ts-core';

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 10,
    zIndex: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },

  comicCard: {
    width: '31%',
    aspectRatio: 1.2, // 더 낮은 직사각형 비율 (가로:세로 = 6:5)
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  comicPreview: {
    width: '100%',
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 20, // 날짜와 뱃지 공간 확보
    marginBottom: 6,
  },

  panelsPreview: {
    width: '100%',
    height: '100%',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: 2,
  },
  panelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
    gap: 2,
  },

  panelPreview: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewGridRow: {
    flexDirection: 'row',
    height: 23,
  },
  previewGridTile: {
    width: 23,
    height: 23,
    borderWidth: 0.5,
    borderColor: '#DDD',
    borderRadius: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 1,
  },
  previewGridTileText: {
    fontSize: 7,
    textAlign: 'center',
    lineHeight: 12,
    color: '#333',
  },
  emptyPreview: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  emptyPreviewText: {
    fontSize: 12,
    color: '#6C757D',
  },

  comicTitle: {
    fontSize: 13,
    color: '#212529',
    textAlign: 'center',
    marginTop: 4,
  },
});

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
        style={[
          styles.badge,
          { backgroundColor: isComplete ? '#28A745' : '#FFC107' },
        ]}
      >
        <Text
          style={[
            styles.badgeText,
            { color: isComplete ? '#FFFFFF' : '#000000' },
          ]}
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
    <TouchableOpacity key={comic.id} style={styles.comicCard} onPress={onPress}>
      {/* Badge - 오른쪽 상단 */}
      {renderBadge(comic.stage)}

      <View style={styles.comicPreview}>
        {comic.panels && comic.panels.length > 0 ? (
          // 4개 패널을 2x2 그리드로 배치한 미리보기
          <View style={styles.panelsPreview}>
            {/* 첫 번째 행: 패널 1, 2 */}
            <View style={styles.panelRow}>
              {[0, 1].map((panelIndex: number) => (
                <View key={panelIndex} style={styles.panelPreview}>
                  {comic.panels[panelIndex]?.grid &&
                  comic.panels[panelIndex].grid.length > 0
                    ? // 5x5 그리드 (원본 크기)
                      (() => {
                        const panel = comic.panels[panelIndex];
                        const grid = Array.from({ length: 5 }, () =>
                          Array.from({ length: 5 }, () => ({
                            type: ComicGridItemType.Empty,
                            content: '',
                            position: [0, 0],
                          } as ComicGridItem)),
                        );

                        // layout 데이터를 5x5로 배치 (원본 그대로)
                        panel.grid.forEach((item: any) => {
                          const [x, y] = item.position || [0, 0];
                          const safeX = Math.max(0, Math.min(4, Math.floor(x)));
                          const safeY = Math.max(0, Math.min(4, Math.floor(y)));

                          grid[safeY][safeX] = {
                            type: item.type || ComicGridItemType.Empty,
                            content: item.content || '',
                            position: [safeX, safeY],
                          };
                        });

                        return grid.map((row: any[], y: number) => (
                          <View key={y} style={styles.previewGridRow}>
                            {row.map((tile: any, x: number) => (
                              <View
                                key={`${x}-${y}`}
                                style={[
                                  styles.previewGridTile,
                                  { backgroundColor: getTileColor(tile.type) },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.previewGridTileText,
                                    styleTemplates.withSemiboldFont,
                                  ]}
                                  numberOfLines={1}
                                >
                                  {tile.content}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ));
                      })()
                    : // 빈 5x5 그리드 표시
                      Array.from({ length: 5 }, (_, y) => (
                        <View key={y} style={styles.previewGridRow}>
                          {Array.from({ length: 5 }, (_, x) => (
                            <View
                              key={`${x}-${y}`}
                              style={styles.previewGridTile}
                            />
                          ))}
                        </View>
                      ))}
                </View>
              ))}
            </View>

            {/* 두 번째 행: 패널 3, 4 */}
            <View style={styles.panelRow}>
              {[2, 3].map((panelIndex: number) => (
                <View key={panelIndex} style={styles.panelPreview}>
                  {comic.panels[panelIndex]?.grid &&
                  comic.panels[panelIndex].grid.length > 0
                    ? // 5x5 그리드 (원본 크기)
                      (() => {
                        const panel = comic.panels[panelIndex];
                        const grid = Array.from({ length: 5 }, () =>
                          Array.from({ length: 5 }, () => ({
                            type: ComicGridItemType.Empty,
                            content: '',
                            position: [0, 0],
                          })),
                        );

                        // layout 데이터를 5x5로 배치 (원본 그대로)
                        panel.grid.forEach((item: any) => {
                          const [x, y] = item.position || [0, 0];
                          const safeX = Math.max(0, Math.min(4, Math.floor(x)));
                          const safeY = Math.max(0, Math.min(4, Math.floor(y)));

                          grid[safeY][safeX] = {
                            type: item.type || ComicGridItemType.Empty,
                            content: item.content || '',
                            position: [safeX, safeY],
                          };
                        });

                        return grid.map((row: any[], y: number) => (
                          <View key={y} style={styles.previewGridRow}>
                            {row.map((tile: any, x: number) => (
                              <View
                                key={`${x}-${y}`}
                                style={[
                                  styles.previewGridTile,
                                  { backgroundColor: getTileColor(tile.type) },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.previewGridTileText,
                                    styleTemplates.withSemiboldFont,
                                  ]}
                                  numberOfLines={1}
                                >
                                  {tile.content}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ));
                      })()
                    : // 빈 5x5 그리드 표시
                      Array.from({ length: 5 }, (_, y) => (
                        <View key={y} style={styles.previewGridRow}>
                          {Array.from({ length: 5 }, (_, x) => (
                            <View
                              key={`${x}-${y}`}
                              style={styles.previewGridTile}
                            />
                          ))}
                        </View>
                      ))}
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.emptyPreview}>
            <Text
              style={[styles.emptyPreviewText, styleTemplates.withBoldFont]}
            >
              만화 없음
            </Text>
          </View>
        )}
      </View>

      {/* Title - 하단 */}
      <Text
        style={[styles.comicTitle, styleTemplates.withSemiboldFont]}
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
