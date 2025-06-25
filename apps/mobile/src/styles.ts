import { StyleSheet } from "react-native";

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
    withHandwritingFont: {"fontFamily": "KyoboHandwriting2019"},

    itemsCenter: {alignItems: 'center'}
})