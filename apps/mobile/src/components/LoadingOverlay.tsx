import React from 'react';
import { View, Text, ActivityIndicator, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { styleTemplates } from '../styles';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
  visible, 
  message 
}) => {
  const { t } = useTranslation();
  const defaultMessage = message || t('Loading.DefaultMessage');

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
    >
      <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
        <View className="bg-white p-6 rounded-xl shadow-lg max-w-sm w-4/5">
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text className="text-center mt-4 text-lg font-semibold text-gray-800" style={styleTemplates.withBoldFont}>
            {defaultMessage}
          </Text>
          <Text className="text-center mt-2 text-sm text-gray-600" style={styleTemplates.withSemiboldFont}>
            {t('Loading.WaitMessage')}
          </Text>
        </View>
      </View>
    </Modal>
  );
}; 