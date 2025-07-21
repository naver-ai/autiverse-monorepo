import os
import openai
from typing import List, Optional
from backend.utils.environment import get_env_variable, EnvironmentVariables


def generate_whisper_prompt(people_names: List[str] = None, place_names: List[str] = None, user_locale: str = "ko") -> str:
    """Generate a prompt for Whisper API to improve transcription accuracy for autistic teenagers."""
    if people_names is None:
        people_names = []
    if place_names is None:
        place_names = []
    
    people_list = ', '.join(people_names) if people_names else 'none'
    places_list = ', '.join(place_names) if place_names else 'none'
    
    # Determine language and specific instructions based on locale
    if user_locale == "ko":
        language_name = "Korean"
        language_code = "ko"
        specific_instructions = """
- Convert unclear pronunciation of autistic teenagers to standard Korean accurately
- Convert to natural Korean grammar
- This is Korean speech, so output in Korean text
"""
    elif user_locale == "en":
        language_name = "English"
        language_code = "en"
        specific_instructions = """
- Convert unclear pronunciation of autistic teenagers to standard English accurately
- Convert to natural English grammar
- This is English speech, so output in English text
"""
    else:
        # Default to Korean
        language_name = "Korean"
        language_code = "ko"
        specific_instructions = """
- Convert unclear pronunciation of autistic teenagers to standard Korean accurately
- Convert to natural Korean grammar
- This is Korean speech, so output in Korean text
"""
    
    return f"""CRITICAL: This is a {language_name} conversation by an autistic teenager. ONLY transcribe what you actually hear - do not make up or guess any words.

ANTI-HALLUCINATION RULES (MOST IMPORTANT):
- If you only hear background noise, ambient sounds, or silence, return an empty string ""
- If you cannot clearly identify any {language_name} speech, return an empty string ""
- If the audio is unclear, muffled, or contains only noise, return empty string ""
- When in doubt, return an empty string ""
- NEVER generate text that you did not actually hear
- Only transcribe what you are 100% certain was spoken in {language_name}
- Do NOT return placeholder text like "음성 인식 실패" or "들리지 않음"
- Do NOT complete sentences or add words that were not spoken

Key Guidelines:
- Ignore meaningless sounds or noise and only transcribe actual spoken content
- Only recognize the user's actual speech content{specific_instructions}

Context Information (for pronunciation help only):
- People: {people_list}
- Places: {places_list}

Important Notes:
- The context information above is ONLY for helping with pronunciation conversion
- Do NOT include these names in your response unless they are actually spoken
- Consider the pronunciation characteristics of autistic teenagers and convert to standard {language_name}
- REMEMBER: No speech detected = return empty string """""


async def transcribe_audio(
    audio_file_path: str, 
    people_names: List[str] = None, 
    place_names: List[str] = None,
    user_locale: str = "ko"
) -> str:
    """
    Transcribe audio using OpenAI Whisper API.
    
    Args:
        audio_file_path: Path to the audio file
        people_names: List of people names for context
        place_names: List of place names for context
        user_locale: User locale for language detection (e.g., "ko", "en")
    
    Returns:
        Transcribed text as string
    """
    try:
        # Get OpenAI API key
        api_key = get_env_variable(EnvironmentVariables.OPENAI_API_KEY)
        if not api_key:
            raise ValueError("OpenAI API key not configured")
        
        # Set up OpenAI client
        client = openai.OpenAI(api_key=api_key)
        
        # Check if file exists
        if not os.path.exists(audio_file_path):
            raise FileNotFoundError(f"Audio file not found: {audio_file_path}")
        
        # Determine language code based on locale
        language_code = "ko" if user_locale == "ko" else "en"
        
        # Generate prompt for better transcription
        prompt = generate_whisper_prompt(people_names, place_names, user_locale)
        
        # Call OpenAI Whisper API
        with open(audio_file_path, "rb") as audio_file:
            response = client.audio.transcriptions.create(
                model="gpt-4o-transcribe",
                file=audio_file,
                language=language_code,
                temperature=0,
                prompt=prompt
            )
        
        transcribed_text = response.text or ""
        print(f"음성 변환 결과: {transcribed_text}")
        
        return transcribed_text
        
    except Exception as error:
        print(f"음성 변환 실패: {error}")
        raise error 