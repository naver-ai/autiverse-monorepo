import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { styleTemplates } from '../../../styles';
import { useSession } from '../hooks/useSession';

export const Revision1TextView = ({
  className,
  sessionId,
}: {
  className?: string;
  sessionId: string;
}) => {
  const { t } = useTranslation();
  const { sessionInfo } = useSession({ sessionId });

  // revision-1 데이터에서 채워진 패널만 추출
  const getRevision1TextContent = () => {
    
    if (!sessionInfo?.panels) {
      console.log('[DEBUG] Revision1TextView - No panels data');
      return [];
    }

    const panels = sessionInfo.panels;
    const textContents: string[] = [];

    // panel1부터 panel4까지 순서대로 확인
    for (let i = 1; i <= 4; i++) {
      const panelKey = `panel${i}` as keyof typeof panels;
      const panelData = panels[panelKey];
      
      if (panelData) {
        // panelData가 문자열인 경우
        if (typeof panelData === 'string' && panelData.trim() !== '' && !panelData.toLowerCase().includes('null')) {
          textContents.push(panelData);
        }
        // panelData가 객체이고 content가 있는 경우
        else if (typeof panelData === 'object' && panelData.content && panelData.content.trim() !== '' && !panelData.content.toLowerCase().includes('null')) {
          textContents.push(panelData.content);
        }
      }
    }

    return textContents;
  };

  const textContents = getRevision1TextContent();

  if (textContents.length === 0) {
    return (
      <View className={`flex-1 justify-center items-center ${className}`}>
        <Text className="text-lg text-gray-600 text-center px-8" style={styleTemplates.withSemiboldFont}>
          {t('ChatStage.DefaultComicMessage')}
        </Text>
      </View>
    );
  }

  return (
    <View className={`flex-1 justify-center ${className}`}>
      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ 
          flexGrow: 1, 
          justifyContent: 'center',
          paddingVertical: 30
        }}
      >
        <View className="px-8">
          {textContents.map((content, index) => (
            <View 
              key={index} 
              className="bg-white rounded-2xl shadow-lg shadow-gray-400/30 border border-gray-200 mb-5"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 8,
              }}
            >
              {/* 스토리 텍스트 - 깔끔한 흰색 배경 */}
              <View className="p-8 pt-10 py-12 justify-center">
                <View className="flex-row items-center">
                  <View className="bg-blue-500 rounded-full w-8 h-8 items-center justify-center flex-shrink-0">
                    <Text className="text-white text-sm font-bold" style={styleTemplates.withBoldFont}>
                      {index + 1}
                    </Text>
                  </View>
                  <View className="w-3" />
                  <Text className="text-xl text-gray-800 leading-relaxed flex-1" style={{...styleTemplates.withSemiboldFont, ...styleTemplates.englishTextWrap}}>
                    {content}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}; 