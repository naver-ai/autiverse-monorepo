import { Text, View } from "react-native"
import { ComicGridItem, ComicGridItemAction } from "@autiverse-monorepo/ts-core"
import { useComicStyle, useGetFigureColor } from "../styles"
import { styleTemplates } from "../../../styles"
import Color from "color"

export const Callout = ({item, action, bounds}: {
    item: ComicGridItem,
    action: ComicGridItemAction,
    bounds: {x: number, y: number, x2: number, y2: number}
}) => {

    const {comicStyle, comicGridSize} = useComicStyle();
    const getFigureColor = useGetFigureColor();
    const color = getFigureColor(item)
    return <View style={{
      position: 'absolute',
      left: bounds.x * comicGridSize,
      right: comicGridSize * 5 - (bounds.x2+1) * comicGridSize,
      top: bounds.y * comicGridSize,
      bottom: comicGridSize * 5 - (bounds.y2+1) * comicGridSize,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>

      <Text className="text-black text-center" style={{
        paddingVertical: comicStyle.calloutPaddingVertical,
        paddingHorizontal: comicStyle.calloutPaddingHorizontal,
        backgroundColor: Color(color).alpha(0.3).rgb().string(),
        borderWidth: comicStyle.calloutBorderWidth,
        borderStyle: action.type === 'think' ? 'dashed' : 'solid',
        borderColor: Color(color).darken(0.2).desaturate(0.2).alpha(0.5).rgb().string(),
        borderRadius: 12,
        ...styleTemplates.withSemiboldFont,
        fontSize: comicStyle.calloutFontSize
        }}>{action.type === 'think' ? '💭' : '💬'} {action.content}</Text>
    </View>
}       