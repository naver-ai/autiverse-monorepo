import { NetworkHelper } from '@autiverse-monorepo/ts-core';
import { isAndroidEmulator } from '../../../core/device';

const getBackendUrl = () => {
  const protocol = process.env.EXPO_PUBLIC_USE_HTTPS === '1' && (!__DEV__ || process.env.EXPO_PUBLIC_USE_HTTPS_IN_DEV === '1') ? 'https' : 'http';
  return __DEV__ ? (isAndroidEmulator() ? `${protocol}://10.0.2.2:3000` : `${protocol}://${process.env.EXPO_PUBLIC_BACKEND_HOSTNAME_DEV || 'localhost'}:3000`) : `${protocol}://${process.env.EXPO_PUBLIC_BACKEND_HOSTNAME}:${process.env.EXPO_PUBLIC_BACKEND_PORT}`;
};

export const getImageSource = (imageName: string) => {
  switch (imageName) {
    case 'robot':
      return require('../../../../assets/robot.png');
    case 'doll':
      return require('../../../../assets/doll.png');
    default:
      // 업로드된 이미지인 경우 서버에서 가져오기
      if (imageName && imageName.includes('.')) {
        const baseUrl = getBackendUrl();
        return { uri: `${baseUrl}/uploads/images/${imageName}` };
      }
      return require('../../../../assets/icon.png');
  }
}; 