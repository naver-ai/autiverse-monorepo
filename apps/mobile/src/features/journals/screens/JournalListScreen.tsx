import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../../features/auth/store';
import { getGalleryAPI } from '../../../api/dyad';
import { useQuery } from '@tanstack/react-query';
import { getTileColor } from '../../journaling/utils';
import { styleTemplates } from '../../../styles';

// 한국어 조사 처리 함수
function getKoreanParticle(name: string): string {
  const lastName = name.charAt(name.length - 1);
  const lastCharCode = lastName.charCodeAt(0);
  
  // 받침이 있는지 확인 (한글 유니코드 범위: 44032-55203)
  if (lastCharCode >= 44032 && lastCharCode <= 55203) {
    const finalConsonant = (lastCharCode - 44032) % 28;
    return finalConsonant === 0 ? '와' : '이와';
  }
  
  // 한글이 아닌 경우 기본값
  return '와';
}

function getKoreanSubjectParticle(name: string): string {
  const lastName = name.charAt(name.length - 1);
  const lastCharCode = lastName.charCodeAt(0);
  
  // 받침이 있는지 확인
  if (lastCharCode >= 44032 && lastCharCode <= 55203) {
    const finalConsonant = (lastCharCode - 44032) % 28;
    return finalConsonant === 0 ? '가' : '이가';
  }
  
  // 한글이 아닌 경우 기본값
  return '가';
}

export default function JournalListScreen() {
  const router = useRouter();
  const { jwt } = useAuthStore();

  const { data: galleryData, isLoading, error } = useQuery({
    queryKey: ['gallery'],
    queryFn: () => getGalleryAPI(jwt!!),
    enabled: !!jwt
  });

  const handleComicPress = (comic: any) => {
    router.push({
      pathname: '/comic-detail',
      params: { 
        comicId: comic.id,
        panels: JSON.stringify(comic.panels),
        revision2: JSON.stringify(comic.revision_2),
        childName: comic.child_name,
        agentName: comic.agent_name,
        createdAt: comic.created_at,
        title: comic.title || ''
      }
    });
  };

  // badge 컴포넌트
  const renderBadge = (stage: string) => {
    const isComplete = stage === 'complete';
    return (
      <View style={[
        styles.badge,
        { backgroundColor: isComplete ? '#28A745' : '#FFC107' }
      ]}>
        <Text style={[
          styles.badgeText,
          { color: isComplete ? '#FFFFFF' : '#000000' }
        ]}>
          {isComplete ? '완성' : '미완성'}
        </Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={[styles.loadingText, styleTemplates.withBoldFont]}>지금까지 쓴 일기 불러오는 중...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={[styles.errorText, styleTemplates.withBoldFont]}>지금까지 쓴 일기를 불러오는데 실패했습니다.</Text>
      </View>
    );
  }

  const comics = galleryData?.comics || [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={[styles.backButtonText, styleTemplates.withBoldFont]}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={[styles.title, styleTemplates.withBoldFont]}>지금까지 쓴 일기</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {comics.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, styleTemplates.withBoldFont]}>아직 완성된 만화일기가 없어요</Text>
          </View>
        ) : (
          <View style={styles.comicsGrid}>
            {comics.map((comic: any) => (
              <TouchableOpacity
                key={comic.id}
                style={styles.comicCard}
                onPress={() => handleComicPress(comic)}
              >
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
                            {comic.panels[panelIndex]?.grid && comic.panels[panelIndex].grid.length > 0 ? (
                              // 5x5 그리드 (원본 크기)
                              (() => {
                                const panel = comic.panels[panelIndex];
                                const grid = Array.from({ length: 5 }, () => 
                                  Array.from({ length: 5 }, () => ({
                                    type: 'empty',
                                    content: '',
                                    position: [0, 0]
                                  }))
                                );
                                
                                // layout 데이터를 5x5로 배치 (원본 그대로)
                                panel.grid.forEach((item: any) => {
                                  const [x, y] = item.position || [0, 0];
                                  const safeX = Math.max(0, Math.min(4, Math.floor(x)));
                                  const safeY = Math.max(0, Math.min(4, Math.floor(y)));
                                  
                                  grid[safeY][safeX] = {
                                    type: item.type || 'empty',
                                    content: item.content || '',
                                    position: [safeX, safeY]
                                  };
                                });
                                
                                return grid.map((row: any[], y: number) => (
                                  <View key={y} style={styles.previewGridRow}>
                                    {row.map((tile: any, x: number) => (
                                      <View
                                        key={`${x}-${y}`}
                                        style={[styles.previewGridTile, { backgroundColor: getTileColor(tile.type) }]}
                                      >
                                        <Text style={[styles.previewGridTileText, styleTemplates.withSemiboldFont]} numberOfLines={1}>
                                          {tile.content}
                                        </Text>
                                      </View>
                                    ))}
                                  </View>
                                ));
                              })()
                            ) : (
                              // 빈 5x5 그리드 표시
                              Array.from({ length: 5 }, (_, y) => (
                                <View key={y} style={styles.previewGridRow}>
                                  {Array.from({ length: 5 }, (_, x) => (
                                    <View
                                      key={`${x}-${y}`}
                                      style={styles.previewGridTile}
                                    />
                                  ))}
                                </View>
                              ))
                            )}
                          </View>
                        ))}
                      </View>
                      
                      {/* 두 번째 행: 패널 3, 4 */}
                      <View style={styles.panelRow}>
                        {[2, 3].map((panelIndex: number) => (
                          <View key={panelIndex} style={styles.panelPreview}>
                            {comic.panels[panelIndex]?.grid && comic.panels[panelIndex].grid.length > 0 ? (
                              // 5x5 그리드 (원본 크기)
                              (() => {
                                const panel = comic.panels[panelIndex];
                                const grid = Array.from({ length: 5 }, () => 
                                  Array.from({ length: 5 }, () => ({
                                    type: 'empty',
                                    content: '',
                                    position: [0, 0]
                                  }))
                                );
                                
                                // layout 데이터를 5x5로 배치 (원본 그대로)
                                panel.grid.forEach((item: any) => {
                                  const [x, y] = item.position || [0, 0];
                                  const safeX = Math.max(0, Math.min(4, Math.floor(x)));
                                  const safeY = Math.max(0, Math.min(4, Math.floor(y)));
                                  
                                  grid[safeY][safeX] = {
                                    type: item.type || 'empty',
                                    content: item.content || '',
                                    position: [safeX, safeY]
                                  };
                                });
                                
                                return grid.map((row: any[], y: number) => (
                                  <View key={y} style={styles.previewGridRow}>
                                    {row.map((tile: any, x: number) => (
                                      <View
                                        key={`${x}-${y}`}
                                        style={[styles.previewGridTile, { backgroundColor: getTileColor(tile.type) }]}
                                      >
                                        <Text style={[styles.previewGridTileText, styleTemplates.withSemiboldFont]} numberOfLines={1}>
                                          {tile.content}
                                        </Text>
                                      </View>
                                    ))}
                                  </View>
                                ));
                              })()
                            ) : (
                              // 빈 5x5 그리드 표시
                              Array.from({ length: 5 }, (_, y) => (
                                <View key={y} style={styles.previewGridRow}>
                                  {Array.from({ length: 5 }, (_, x) => (
                                    <View
                                      key={`${x}-${y}`}
                                      style={styles.previewGridTile}
                                    />
                                  ))}
                                </View>
                              ))
                            )}
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : (
                    <View style={styles.emptyPreview}>
                      <Text style={[styles.emptyPreviewText, styleTemplates.withBoldFont]}>만화 없음</Text>
                    </View>
                  )}
                </View>
                
                {/* Title - 하단 */}
                <Text style={[styles.comicTitle, styleTemplates.withSemiboldFont]} numberOfLines={2}>
                  {comic.created_at ? (() => {
                    const date = new Date(comic.created_at);
                    const month = date.getMonth() + 1;
                    const day = date.getDate();
                    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
                    return `[${month}/${day} (${dayOfWeek})]`;
                  })() : ''} {comic.title && comic.title.trim() !== '' ? comic.title : `${comic.child_name || '친구'}${getKoreanParticle(comic.child_name || '친구')} ${comic.agent_name || '친구'}${getKoreanSubjectParticle(comic.agent_name || '친구')} 함께 쓴 그림일기`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  backButton: {
    padding: 5,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#212529',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#6C757D',
    textAlign: 'center',
  },
  comicsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
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
  loadingText: {
    fontSize: 16,
    color: '#6C757D',
    textAlign: 'center',
    marginTop: 100,
  },
  errorText: {
    fontSize: 16,
    color: '#DC3545',
    textAlign: 'center',
    marginTop: 100,
  },
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
}); 