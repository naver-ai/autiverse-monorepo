import { disassemble } from 'es-hangul';
import Fuse from 'fuse.js';


const EMOTION_EMOJIS = [
    { text: ['즐거웠다', '즐거움', '즐겁다', 'happy'], emoji: '😊' },
    { text: ['기뻤다', '기분좋다', '기분좋음'], emoji: '😄' },
    { text: ['행복했다', '행복함', '행복'], emoji: '🥰' },
    { text: ['신났다', '신남', '신난다'], emoji: '🤩' },
    { text: ['슬펐다', '슬픔', '슬프다'], emoji: '😢' },
    { text: ['화났다', '화남', '화난다', '화나다'], emoji: '😠' },
    { text: ['속상했다', '속상함', '속상한', '속상하다'], emoji: '😞' },
    { text: ['무서웠다', '무서움', '무서운', '무섭다'], emoji: '😨' },
    { text: ['두려웠다', '두려움', '두렵다'], emoji: '😰' },
    { text: ['놀랬다', '놀람', '놀라움', '놀라다', '놀랍다', '놀랐다'], emoji: '😲' },
    { text: ['감탄했다', '감탄하다', '감탄'], emoji: '😍' },
    { text: ['지루했다', '지루함', '지루하다'], emoji: '😴' }
]

function disassembleToSequence(text: string): Array<string> {
    const result = disassemble(text);
    return result.split('');
}

const EMOTION_EMOJI_MAP_ESCAPED: Array<{sequence: Array<string>, emoji: string}> = EMOTION_EMOJIS.map((emotion) => {
    return emotion.text.map((text) => ({
        sequence: disassembleToSequence(text),
        emoji: emotion.emoji
    }));
}).flat();

export const getEmojiFromEmotion = (emotion: string): string | undefined => {
    const emotionSequence = disassembleToSequence(emotion);
    
    // Create a searchable array from EMOTION_EMOJI_MAP_ESCAPED
    const searchableSequences = EMOTION_EMOJI_MAP_ESCAPED.map(mapping => ({
        sequence: mapping.sequence.join(''),
        emoji: mapping.emoji
    }));
    
    // Configure Fuse.js for fuzzy matching on sequences
    const fuse = new Fuse(searchableSequences, {
        keys: ['sequence'],
        threshold: 0.3, // Lower threshold = more strict matching
        includeScore: true,
        minMatchCharLength: 2
    });
    
    // Search for the best match using the emotion sequence
    const results = fuse.search(emotionSequence.join(''));
    
    // Return the emoji of the best match, or default emoji if no good match found
    if (results.length > 0 && results[0].score && results[0].score < 0.4) {
        return results[0].item.emoji;
    }
    
    return undefined; // Default emoji if no good match found
}