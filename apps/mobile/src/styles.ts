import { StyleSheet, Platform } from "react-native";

export const fontFamilyByWeight = {
    light: "NanumSquareNeo-aLt",
    regular: "NanumSquareNeo-bRg",
    semibold: "NanumSquareNeo-cBd",
    bold: "NanumSquareNeo-dEb",
    extrabold: "NanumSquareNeo-eHv",
  };

  export const styleTemplates = StyleSheet.create({
    withLightFont: {"fontFamily": fontFamilyByWeight.light},
    withRegularFont: {"fontFamily": fontFamilyByWeight.regular},
    withSemiboldFont: {"fontFamily": fontFamilyByWeight.semibold},
    withBoldFont: {"fontFamily": fontFamilyByWeight.bold},
    withExtraboldFont: {"fontFamily": fontFamilyByWeight.extrabold},

    itemsCenter: {alignItems: 'center'},
    
    // 영어 텍스트 줄바꿈을 위한 스타일
    englishTextWrap: {
      // Android에서 단어 단위 줄바꿈
      ...(Platform.OS === 'android' && { textBreakStrategy: 'highQuality' as any }),
      // iOS에서 자동 하이픈
      ...(Platform.OS === 'ios' && { hyphens: 'auto' as any }),
    } as any
})