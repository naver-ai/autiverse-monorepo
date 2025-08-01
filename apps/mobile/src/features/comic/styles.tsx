import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useDyad } from "../../api/dyad";
import { ComicGridItem, Person } from "@autiverse-monorepo/ts-core";


export enum ComicElementSize {
    small="small",
    medium="medium",
    large="large"
  }

export interface ComicStyle {
    emotionFontSize: number;
    emotionPadding: number;
    pawnNameFontSize: number;
    calloutFontSize: number;
    calloutPaddingHorizontal: number;
    calloutPaddingVertical: number;
    calloutBorderWidth: number;
    calloutBorderRadius: number;
    objectNameFontSize: number;
}

export const MEDIUM_COMIC_STYLE: ComicStyle = {
    emotionFontSize: 12,
    emotionPadding: 4,
    pawnNameFontSize: 12,
    calloutFontSize: 12.5,
    calloutPaddingHorizontal: 6,
    calloutPaddingVertical: 4,
    calloutBorderWidth: 2,
    calloutBorderRadius: 12,
    objectNameFontSize: 13,
}

export const SMALL_COMIC_STYLE: ComicStyle = {
    ...MEDIUM_COMIC_STYLE,
    emotionFontSize: 9,
    pawnNameFontSize: 9,
    calloutFontSize: 10,
    calloutPaddingHorizontal: 4,
    calloutPaddingVertical: 3,
    calloutBorderWidth: 1,
    calloutBorderRadius: 8,
    objectNameFontSize: 10,
}

export const LARGE_COMIC_STYLE: ComicStyle = {
    ...MEDIUM_COMIC_STYLE
}

export const COMIC_STYLE_MAP = {
    [ComicElementSize.small]: SMALL_COMIC_STYLE,
    [ComicElementSize.medium]: MEDIUM_COMIC_STYLE,
    [ComicElementSize.large]: LARGE_COMIC_STYLE,
}

export const ComicContext = createContext<{comicElementSize: ComicElementSize, comicGridSize: number}>({comicElementSize: ComicElementSize.medium, comicGridSize: 0});

export const ComicProvider = ({children, elementSize, gridSize}: {children: React.ReactNode, elementSize: ComicElementSize, gridSize: number}) => {
    const [comicElementSize, setComicElementSize] = useState<ComicElementSize>(elementSize);
    const [comicGridSize, setGridSize] = useState<number>(gridSize);

    useEffect(() => {
        setGridSize(gridSize);
    }, [gridSize])

    useEffect(() => {
        setComicElementSize(elementSize);
    }, [elementSize])

    return (
        <ComicContext.Provider value={{comicElementSize, comicGridSize}}>
            {children}
        </ComicContext.Provider>
    )
}

export const useComicStyle = () => {
    const {comicElementSize, comicGridSize} = useContext(ComicContext);

    return {
        comicElementSize,
        comicGridSize,
        comicStyle: COMIC_STYLE_MAP[comicElementSize]
    } 
}

export const useGetFigureColor = () => {
  const {dyad} = useDyad()
  const getFigureColor = useCallback((tile: ComicGridItem) => {
    if(tile.content === '나') {
      return dyad?.avatar_config?.color || 'transparent'
    }else{
      const person = dyad?.people.find((person: Person) => person.name === tile.content);
      return person?.avatar_config?.color || 'transparent'
    }
  }, [dyad])

  return getFigureColor;
}