import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Path,
  G,
  SvgProps,
  Ellipse,
  Circle,
  Mask,
  RadialGradient,
} from 'react-native-svg';
import { Text, View } from 'react-native';
import { styleTemplates } from '../../../styles';
import Color from 'color';
import { COMIC_STYLE_MAP, ComicContext, useComicStyle, useGetFigureColor } from '../styles';
import { useContext } from 'react';
import { ComicGridItem } from '@autiverse-monorepo/ts-core';

const PAWN_SVG_PIVOT_X = 55.13 / 2;
const PAWN_SVG_PIVOT_Y = 53;
const PAWN_SVG_PIVOT_WIDTH = 33;
const PAWN_SVG_FIGURE_HEIGHT = 53;

export function Pawn({
  bodyWidth = PAWN_SVG_PIVOT_WIDTH,
  item
}: {
  bodyWidth?: number;
  item: ComicGridItem;
}) {

  const {comicStyle, comicGridSize} = useComicStyle();

  const getFigureColor = useGetFigureColor();

  // Calculate scale factor based on bodyWidth relative to pivot width
  const scale = bodyWidth / PAWN_SVG_PIVOT_WIDTH;

  const emotions = item.action?.filter((action) => action.type === 'emotion');

  const bandColor = getFigureColor(item);

  const label = item.content;

  const bodyPositionX = comicGridSize /2;
  const bodyPositionY = comicGridSize /2;

  // Calculate new SVG dimensions
  const scaledWidth = 55.13 * scale;
  const scaledHeight = 67.3 * scale;

  return (
    <View
      style={{
        opacity: 0.75,
        position: 'absolute',
        left: bodyPositionX - PAWN_SVG_PIVOT_X * scale,
        top: bodyPositionY - PAWN_SVG_PIVOT_Y * scale,
      }}
    >
      <PawnSVG
        width={scaledWidth}
        height={scaledHeight}
        bandColor={bandColor}
      />
      {/* Label 표시 */}
      {label && (
        <View
          style={{
            position: 'absolute',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            left: bodyPositionX - bodyWidth / 2,
            right: bodyPositionX - bodyWidth / 2,
            bottom: scaledHeight + 2, // 피규어 머리 위에 위치 (bottom 기준)
          }}
        >
          {emotions &&
            emotions.length > 0 &&
            emotions.map((action, index) => (
              <Text
                key={index}
                style={{
                  backgroundColor: Color(bandColor).alpha(0.5).rgb().string(),
                  padding: 4,
                  borderRadius: 8,
                  marginBottom: 2,
                  fontSize: comicStyle.emotionFontSize,
                  textAlign: 'center',
                  color: 'black',
                  ...styleTemplates.withSemiboldFont,
                }}
              >
                {action.content}
              </Text>
            ))}
          <Text
            className="p-1 rounded-md text-center"
            style={{
              fontSize: comicStyle.pawnNameFontSize,
              backgroundColor: bandColor,
              color: bandColor !== 'transparent' ? 'white' : 'black',
              ...styleTemplates.withBoldFont,
            }}
          >
            {label}
          </Text>
        </View>
      )}
    </View>
  );
}

export function PawnSVG(
  props: SvgProps & {
    bandColor?: string;
  },
) {
  return (
    <Svg id="Layer_1" viewBox="0 0 55.13 67.3" {...props}>
      <Defs>
        <RadialGradient
          id="radial-gradient"
          cx={-617.78}
          cy={444.72}
          fx={-617.78}
          fy={444.72}
          r={1}
          gradientTransform="translate(-10088.56 6280.64) rotate(89.79) scale(10.01 -22.8)"
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset={0} stopColor="#000" />
          <Stop offset={0.59} stopColor="#000" stopOpacity={0.81} />
          <Stop offset={1} stopColor="#000" stopOpacity={0} />
        </RadialGradient>
        <LinearGradient
          id="linear-gradient"
          x1={14.03}
          y1={22.63}
          x2={42.53}
          y2={24.63}
          gradientTransform="translate(0 63.84) scale(1 -1)"
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset={0} stopColor="#ebddc8" />
          <Stop offset={0.32} stopColor="#efe3d2" />
          <Stop offset={0.79} stopColor="#dbbe94" />
          <Stop offset={1} stopColor="#e2cbaa" />
        </LinearGradient>
        <LinearGradient
          id="linear-gradient1"
          x1={14.95}
          y1={9.42}
          x2={43.45}
          y2={11.42}
          gradientTransform="translate(0 63.84) scale(1 -1)"
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset={0} stopColor="#000" stopOpacity={0.09} />
          <Stop offset={0.32} stopColor="#000" stopOpacity={0} />
          <Stop offset={0.79} stopColor="#000" stopOpacity={0.23} />
          <Stop offset={1} stopColor="#000" stopOpacity={0.15} />
        </LinearGradient>
        <Mask
          id="mask"
          x={10.83}
          y={17.9}
          width={34.5}
          height={45}
          maskUnits="userSpaceOnUse"
        >
          <G id="path-5-inside-1_2236_164">
            <Path
              d="M44.33,52.96c0,4.5-7.56,9-16.67,9s-16.33-4.5-16.33-9c0-9.11,7.89-34.5,17-34.5s16,25.39,16,34.5Z"
              fill="#fff"
            />
          </G>
        </Mask>
        <RadialGradient
          id="radial-gradient1"
          cx={-616.85}
          cy={429.18}
          fx={-616.85}
          fy={429.18}
          r={1}
          gradientTransform="translate(1819.69 14532.1) rotate(48.12) scale(19.47 -19.47)"
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset={0} stopColor="#f1efe9" />
          <Stop offset={0.73} stopColor="#e2c7a4" />
          <Stop offset={1} stopColor="#ebd4b5" />
        </RadialGradient>
        <Mask
          id="mask-1"
          x={13.96}
          y={0}
          width={27.93}
          height={27.98}
          maskUnits="userSpaceOnUse"
        >
          <G id="path-7-inside-2_2236_164">
            <Circle cx={27.83} cy={13.97} r={13.5} fill="#fff" />
          </G>
        </Mask>
      </Defs>
      <Ellipse
        cx={29.83}
        cy={54.97}
        rx={24.5}
        ry={11.5}
        fill="url(#radial-gradient)"
        fillOpacity={0.22}
      />
      <Path
        d="M44.33,52.96c0,4.5-7.56,9-16.67,9s-16.33-4.5-16.33-9c0-9.11,7.89-34.5,17-34.5s16,25.39,16,34.5Z"
        fill="url(#linear-gradient)"
      />
      <Path
        d="M43.55,45.95c.5,2.76.78,5.2.78,7.01,0,4.5-7.56,9-16.67,9s-16.33-4.5-16.33-9c0-1.77.3-4.15.84-6.84,2.16,3.44,8.22,6.3,15.49,6.3s13.74-2.95,15.89-6.47Z"
        fill={props.bandColor || '#97d065'}
      />
      <Path
        d="M43.55,45.95c.5,2.76.78,5.2.78,7.01,0,4.5-7.56,9-16.67,9s-16.33-4.5-16.33-9c0-1.77.3-4.15.84-6.84,2.16,3.44,8.22,6.3,15.49,6.3s13.74-2.95,15.89-6.47Z"
        fill="url(#linear-gradient1)"
      />
      <G mask="url(#mask)">
        <Path
          d="M45.33,52.96h-2c0,.34-.06.68-.17,1.02-.39,1.2-1.38,2.29-2.52,3.17-2.08,1.58-4.67,2.59-7.3,3.19-1.86.42-3.77.65-5.69.69-6.07.07-14.61-1.67-15.83-8.04,0,0,0-.02,0-.02.25-6.5,2.18-13.01,4.51-19.16,2.55-5.92,5.56-13.79,11.99-14.79,5.31.62,7.98,6.98,10.11,11.85,2.08,5.21,3.54,10.69,4.4,16.22.29,1.96.52,3.97.49,5.87h2c-.05-2.1-.35-4.15-.71-6.17-1.06-5.65-2.67-11.17-4.91-16.45-2.39-4.92-4.75-11.54-11.38-12.44-7.81,1.5-10.18,9.54-12.92,15.54-2.36,6.26-4.31,12.73-4.58,19.52,0,.01,0,.02,0,.03,1.6,7.71,10.28,9.56,16.83,9.9,2.05.04,4.11-.15,6.12-.6,2.85-.65,5.65-1.72,8.08-3.55,1.32-1.03,2.6-2.33,3.2-4.14.17-.52.26-1.07.26-1.64ZM43.33,52.96h2-2Z"
          fill="#593c2d"
          fillOpacity={0.46}
        />
      </G>
      <Circle cx={27.83} cy={13.97} r={13.5} fill="url(#radial-gradient1)" />
      <G mask="url(#mask-1)">
        <Path
          d="M18.76,3.5c.15.18.31.35.46.53.11-.1.23-.2.35-.29.95-.77,2.02-1.4,3.16-1.86,4.51-1.87,9.91-.85,13.49,2.28.49.42.94.87,1.36,1.36,4.63,5.08,4,13.82-1.3,18.2h0c-5.07,4.62-13.82,4.09-18.29-1.22-3.7-4.06-4.32-10.59-1.42-15.32.63-1.06,1.42-2.03,2.33-2.86.1-.1.21-.19.32-.28,0,0,.14.16.43.49-.44-.5-.87-1.01-1.31-1.51.28.33.42.49.42.49-.11.1-.22.2-.33.3-.95.88-1.79,1.9-2.46,3.01-3.09,4.96-2.58,11.87,1.31,16.31,4.68,5.79,14.23,6.57,19.79,1.5h0c5.8-4.78,6.48-14.33,1.42-19.89-.46-.53-.96-1.03-1.49-1.48C33.04-.2,27.1-.92,22.43,1.18c-1.19.52-2.3,1.2-3.3,2.01-.12.1-.24.2-.36.31ZM19.22,4.03l-.46-.53-.43-.49,1.31,1.51-.43-.49Z"
          fill="#593c2d"
          fillOpacity={0.46}
        />
      </G>
    </Svg>
  );
}
