import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../features/auth/store';
import { getGalleryAPI } from '../../api/dyad';
import { useQuery } from '@tanstack/react-query';
import { getTileColor } from '../../features/tablet-comic-chatbot/utils';

export default function GalleryScreen() {
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
        createdAt: comic.created_at
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
        <Text style={styles.loadingText}>갤러리를 불러오는 중...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>갤러리를 불러오는데 실패했습니다.</Text>
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
          <Text style={styles.backButtonText}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.title}>갤러리</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {comics.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>아직 완성된 만화일기가 없어요</Text>
          </View>
        ) : (
          <View style={styles.comicsGrid}>
            {comics.map((comic: any) => (
              <TouchableOpacity
                key={comic.id}
                style={styles.comicCard}
                onPress={() => handleComicPress(comic)}
              >
                {/* Badge */}
                {renderBadge(comic.stage)}
                
                <View style={styles.comicPreview}>
                  {comic.panels && comic.panels.length > 0 ? (
                    // 4개 패널을 가로 1열로 배치한 미리보기
                    <View style={styles.panelsPreview}>
                      {comic.panels.slice(0, 4).map((panel: any, panelIndex: number) => (
                        <View key={panelIndex} style={styles.panelPreview}>
                          {panel?.grid && panel.grid.length > 0 ? (
                            // 5x5 그리드 (원본 크기)
                            (() => {
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
                                      <Text style={styles.previewGridTileText} numberOfLines={1}>
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
                  ) : (
                    <View style={styles.emptyPreview}>
                      <Text style={styles.emptyPreviewText}>만화 없음</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.comicDate}>
                  {comic.created_at ? new Date(comic.created_at).toLocaleDateString('ko-KR') : '날짜 없음'}
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
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
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
    height: 120,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  panelsPreview: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 1,
  },
  panelPreview: {
    width: '23%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewGridRow: {
    flexDirection: 'row',
    height: 20,
  },
  previewGridTile: {
    width: 20,
    height: 20,
    borderWidth: 0.5,
    borderColor: '#DDD',
    borderRadius: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 1,
  },
  previewGridTileText: {
    fontSize: 6,
    textAlign: 'center',
    lineHeight: 10,
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
  comicDate: {
    fontSize: 14,
    color: '#6C757D',
    textAlign: 'center',
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
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
}); 