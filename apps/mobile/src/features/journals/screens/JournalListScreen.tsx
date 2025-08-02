import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../../features/auth/store';
import { getGalleryAPI } from '../../../api/dyad';
import { useQuery } from '@tanstack/react-query';
import { styleTemplates } from '../../../styles';
import { JournalListElement } from '../components/JournalListElement';
import { FlashList } from '@shopify/flash-list';

export default function JournalListScreen() {
  const router = useRouter();
  const { jwt } = useAuthStore();

  const {
    data: galleryData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['gallery'],
    queryFn: () => getGalleryAPI(jwt!!),
    enabled: !!jwt,
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
        title: comic.title || '',
      },
    });
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-slate-50">
        <Text style={[styles.loadingText, styleTemplates.withBoldFont]}>
          지금까지 쓴 일기 불러오는 중...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-slate-50">
        <Text style={[styles.errorText, styleTemplates.withBoldFont]}>
          지금까지 쓴 일기를 불러오는데 실패했습니다.
        </Text>
      </View>
    );
  }

  const comics = galleryData?.comics || [];

  return (
    <View className="flex-1 bg-slate-50 flex">
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={[styles.backButtonText, styleTemplates.withBoldFont]}>
            ← 뒤로
          </Text>
        </TouchableOpacity>
        <Text style={[styles.title, styleTemplates.withBoldFont]}>
          지금까지 쓴 일기
        </Text>
        <View style={{ width: 60 }} />
      </View>
      <View style={{flex: 1}}>
        <FlashList
          contentContainerStyle={{
            paddingVertical: 30,
            paddingBottom: 100,
            paddingHorizontal: 50,
          }}
          ItemSeparatorComponent={() => <View style={{ width: 30 }} />}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, styleTemplates.withBoldFont]}>
                아직 완성된 만화일기가 없어요
              </Text>
            </View>
          )}
          data={comics}
          horizontal
          renderItem={({ item }) => (
            <JournalListElement
              key={item.id}
              comic={item}
              onPress={() => handleComicPress(item)}
            />
          )}
          keyExtractor={(item, index) => item.id || index.toString()}
          estimatedItemSize={20}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
