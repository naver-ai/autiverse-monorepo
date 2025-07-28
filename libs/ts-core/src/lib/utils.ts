export function endsWithJongsung(text: string) {
    for (let i = text.length - 1; i >= 0; i--) {
      const code = text.charCodeAt(i);
      // Check if it's within Korean syllable range
      if (code >= 0xAC00 && code <= 0xD7A3) {
        const jong = (code - 0xAC00) % 28;
        return jong !== 0; // If jong is 0, there's no final consonant
      }
    }
    return false; // Return false if no Korean characters
  }

export function escapeLastJongsungFromKoreanName(name: string): string  {
  let childName = name
  if(endsWithJongsung(name)) {
    childName = childName + "이"
  }
  return childName
}

/**
 * Check if the last character of the text ends with a Korean final consonant (jongseong)
 * @param text - The text to check
 * @returns true if the last character has a final consonant, false otherwise
 */
export function endsWithJongseong(text: string): boolean {
  if (!text || text.length === 0) return false;
  
  const lastChar = text.charAt(text.length - 1);
  const lastCharCode = lastChar.charCodeAt(0);
  
  // Check if it's within Korean syllable range (가-힣: 44032-55203)
  if (lastCharCode >= 44032 && lastCharCode <= 55203) {
    const jongseong = (lastCharCode - 44032) % 28;
    return jongseong !== 0; // If jongseong is 0, there's no final consonant
  }
  
  return false; // Return false if not a Korean character
}

/**
 * Append appropriate Korean particle (josa) based on whether the text ends with a final consonant
 * @param text - The base text
 * @param josaWithJongseong - The particle to use when text ends with a final consonant
 * @param josaWithoutJongseong - The particle to use when text doesn't end with a final consonant
 * @returns The text with the appropriate particle appended
 */
export function appendJosa(text: string, josaWithJongseong: string, josaWithoutJongseong: string): string {
  if (!text) return text;
  
  const hasJongseong = endsWithJongseong(text);
  return text + (hasJongseong ? josaWithJongseong : josaWithoutJongseong);
}

export function escapeJongseong(text: string): string {
  if (!text) return text;
  if(endsWithJongseong(text)) {
    return text + "이";
  }
  return text;
}