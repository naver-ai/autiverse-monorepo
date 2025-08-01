import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ComicPanelView } from '../../comic/components/ComicPanelView';
import { GridView } from '../../../components/GridView';
import { styleTemplates } from '../../../styles';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ComicElementSize } from '../../comic/styles';

const { width } = Dimensions.get('window');

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

export default function ComicDetailScreen() {
  const router = useRouter();
  const { comicId, panels, revision2, childName, agentName, createdAt, title } = useLocalSearchParams();
  
  const panelsData = panels ? JSON.parse(panels as string) : [];
  const revision2Data = revision2 ? JSON.parse(revision2 as string) : null;
  const childNameStr = childName as string || '친구';
  const agentNameStr = agentName as string || '친구';
  const titleStr = title as string || '';
  
  // 만화 생성 날짜
  const comicDate = createdAt ? new Date(createdAt as string) : new Date();
  const month = comicDate.getMonth() + 1;
  const day = comicDate.getDate();
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][comicDate.getDay()];
  
  // 제목 결정: title이 있으면 사용, 없으면 기본 형식 사용
  const baseTitle = titleStr && titleStr.trim() !== '' 
    ? titleStr 
    : `${childNameStr}${getKoreanParticle(childNameStr)} ${agentNameStr}${getKoreanSubjectParticle(agentNameStr)} 함께 쓴 그림일기`;
  
  // 헤더에 표시할 제목: 날짜 + 제목
  const displayTitle = `[${month}/${day} (${dayOfWeek})] ${baseTitle}`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={[styles.backButtonText, styleTemplates.withBoldFont]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.title, styleTemplates.withBoldFont]}>
          {displayTitle}
        </Text>
      </View>

        {/* GridView를 사용하여 2x2 패널 배치 */}
        <GridView
          numColumns={2}
          numRows={2}
          gapX={8}
          gapY={8}
          className="flex-1"
        >
          {panelsData.map((panel: any, index: number) => {
            // revision_2에서 해당 패널의 스토리 가져오기
            const panelKey = `panel${index + 1}`;
            const storyContent = revision2Data && typeof revision2Data === 'object' 
              ? revision2Data[panelKey] 
              : null;
            
            // ComicPanelView에 전달할 패널 데이터 생성
            const panelData = {
              content: storyContent && !storyContent.startsWith('null') ? storyContent : '',
              grid: panel?.grid || []
            };
            
            return (
              <View key={index} style={styles.panelContainer}>
                <ComicPanelView
                  panelIndex={index}
                  panel={panelData}
                  panelSize={undefined}
                  showStory={true}
                  elementSize={ComicElementSize.medium}
                />
              </View>
            );
          })}
        </GridView>
    </SafeAreaView>
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
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  backButton: {
    padding: 5,
  },
  backButtonText: {
    fontSize: 24,
    color: '#495057',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#212529',
    flex: 1,
    textAlign: 'center',
    lineHeight: 24,
    paddingVertical: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  panelContainer: {
    width: '100%',
    height: '100%',
    maxHeight: 320,
  },
}); 