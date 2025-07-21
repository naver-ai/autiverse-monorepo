import os
import json
import base64
import requests
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from pydantic import BaseModel
from typing import Optional, List, Annotated
from backend.utils.environment import get_env_variable, EnvironmentVariables
from backend.utils.speech import transcribe_audio
from backend.database.models import Dyad, UserLocale
from .common import get_signed_in_dyad

router = APIRouter()

class TTSRequest(BaseModel):
    text: str
    voice: str = "nara"
    speed: float = 0.6
    pitch: float = 0.9

class SpeechRecognitionRequest(BaseModel):
    people_names: Optional[List[str]] = []
    place_names: Optional[List[str]] = []

@router.post("/clova")
async def clova_tts(request: TTSRequest):
    try:
        # CLOVA TTS API 설정
        client_id = get_env_variable(EnvironmentVariables.CLOVA_CLIENT_ID)
        client_secret = get_env_variable(EnvironmentVariables.CLOVA_CLIENT_SECRET)
        
        if not client_id or not client_secret:
            raise HTTPException(status_code=500, detail="CLOVA API credentials not configured")
        
        # CLOVA TTS API 호출
        url = "https://naveropenapi.apigw.ntruss.com/tts-premium/v1/tts"
        headers = {
            "X-NCP-APIGW-API-KEY-ID": client_id,
            "X-NCP-APIGW-API-KEY": client_secret,
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        data = {
            "speaker": request.voice,
            "volume": "0",
            "speed": str(request.speed),
            "pitch": str(request.pitch),
            "emotion": "0",
            "format": "mp3",
            "text": request.text
        }
        
        response = requests.post(url, headers=headers, data=data)
        
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="CLOVA TTS API error")
        
        # 오디오 데이터를 base64로 인코딩하여 반환
        audio_base64 = base64.b64encode(response.content).decode('utf-8')
        
        return {
            "audio": audio_base64,
            "format": "mp3"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS error: {str(e)}")

@router.post("/recognize")
async def recognize_speech(
    dyad: Annotated[Dyad, Depends(get_signed_in_dyad)],
    audio_file: UploadFile = File(...),
    people_names: str = Form("[]"),
    place_names: str = Form("[]")
):
    """
    Recognize speech from uploaded audio file using OpenAI Whisper API.
    
    Args:
        audio_file: Uploaded audio file
        people_names: JSON string of people names for context
        place_names: JSON string of place names for context
        dyad: Authenticated dyad information (includes locale)
    
    Returns:
        Transcribed text
    """
    try:
        # Parse context information
        try:
            people_list = json.loads(people_names) if people_names else []
            places_list = json.loads(place_names) if place_names else []
        except json.JSONDecodeError:
            people_list = []
            places_list = []
        
        # Get user locale from dyad
        user_locale = "ko" if dyad.locale is UserLocale.Korean else "en"
        
        # Validate file type
        if not audio_file.content_type or not audio_file.content_type.startswith('audio/'):
            raise HTTPException(status_code=400, detail="Invalid file type. Audio file required.")
        
        # Create temporary file path
        temp_dir = "/tmp"
        os.makedirs(temp_dir, exist_ok=True)
        temp_file_path = os.path.join(temp_dir, f"speech_{audio_file.filename}")
        
        try:
            # Save uploaded file temporarily
            with open(temp_file_path, "wb") as buffer:
                content = await audio_file.read()
                buffer.write(content)
            
            # Transcribe audio
            transcribed_text = await transcribe_audio(
                temp_file_path, 
                people_list, 
                places_list,
                user_locale
            )
            
            return {
                "text": transcribed_text,
                "success": True
            }
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Speech recognition error: {str(e)}") 