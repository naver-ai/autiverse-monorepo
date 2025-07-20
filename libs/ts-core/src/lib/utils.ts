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