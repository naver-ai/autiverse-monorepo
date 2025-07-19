import { getImageSource } from "../utils/imageUtils"
import {Image } from 'expo-image'
import { ImageStyle } from "react-native"

export const AgentImage = ({avatarImage, style}: {avatarImage: string, style: ImageStyle}) => {
    return <Image
    source={
      avatarImage
        ? avatarImage.startsWith('http')
          ? { uri: avatarImage }
          : getImageSource(avatarImage)
        : require('../../../../assets/robot.png')
    }
    style={style}
  />
}