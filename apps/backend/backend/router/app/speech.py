import os
import json
import base64
import asyncio
import aiohttp
import hashlib
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from pydantic import BaseModel
from typing import Optional, List, Annotated
from backend.utils.environment import get_env_variable, EnvironmentVariables
from backend.utils.speech import transcribe_audio
from backend.database.models import Dyad, UserLocale
from .common import get_signed_in_dyad

# TTS 캐시 (메모리 기반)
tts_cache = {}

router = APIRouter()

class TTSRequest(BaseModel):
    text: str
    voice: str = "nara"
    speed: float = 0.9
    pitch: float = 0.9

class SpeechRecognitionRequest(BaseModel):
    people_names: Optional[List[str]] = []
    place_names: Optional[List[str]] = []

@router.post("/clova")
async def clova_tts(request: TTSRequest, dyad: Annotated[Dyad, Depends(get_signed_in_dyad)]):
    import time
    start_time = time.time()
    request_id = f"tts_{int(start_time * 1000)}"
    
    # agent_config에서 TTS 설정 가져오기
    agent_config = dyad.agents[0].agent_config if dyad.agents else {}
    
    # agent_config의 설정을 우선 사용, 없으면 요청의 기본값 사용
    voice = agent_config.get('voice', request.voice)
    speed = agent_config.get('speed', request.speed)
    pitch = agent_config.get('pitch', request.pitch)
    
    print(f"[TTS] [{request_id}] 요청 수신: text_length={len(request.text)}, voice={voice}, speed={speed}, pitch={pitch}")
    print(f"[TTS] [{request_id}] agent_config: {agent_config}")
    
    try:
        # 캐시 키 생성 (텍스트 + 설정의 해시)
        cache_key = hashlib.md5(
            f"{request.text}:{voice}:{speed}:{pitch}".encode()
        ).hexdigest()
        
        # 캐시에서 확인
        if cache_key in tts_cache:
            print(f"[TTS] [{request_id}] 캐시에서 반환됨: {cache_key}")
            return tts_cache[cache_key]
        
        print(f"[TTS] [{request_id}] 캐시 미스, CLOVA API 호출 시작: {cache_key}")
        
        # CLOVA TTS API 설정
        client_id = get_env_variable(EnvironmentVariables.CLOVA_CLIENT_ID)
        client_secret = get_env_variable(EnvironmentVariables.CLOVA_CLIENT_SECRET)
        
        if not client_id or not client_secret:
            print(f"[TTS] [{request_id}] CLOVA API credentials not configured")
            raise HTTPException(status_code=500, detail="CLOVA API credentials not configured")
        
        # CLOVA TTS API 호출 (비동기 HTTP 클라이언트 사용)
        url = "https://naveropenapi.apigw.ntruss.com/tts-premium/v1/tts"
        headers = {
            "X-NCP-APIGW-API-KEY-ID": client_id,
            "X-NCP-APIGW-API-KEY": client_secret,
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        data = {
            "speaker": voice,
            "volume": "0",
            "speed": str(speed),
            "pitch": str(pitch),
            "emotion": "0",
            "format": "mp3",
            "text": request.text
        }
        
        print(f"[TTS] [{request_id}] CLOVA API 호출 시작: url={url}")
        clova_start_time = time.time()
        
        # 비동기 HTTP 클라이언트 사용으로 성능 향상
        timeout = aiohttp.ClientTimeout(total=4)  # 4초 타임아웃으로 단축
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(url, headers=headers, data=data) as response:
                clova_duration = time.time() - clova_start_time
                if response.status != 200:
                    print(f"[TTS] [{request_id}] CLOVA API 호출 실패: status={response.status}, duration={clova_duration:.2f}s")
                    raise HTTPException(status_code=response.status, detail="CLOVA TTS API error")
                
                audio_content = await response.read()
                print(f"[TTS] [{request_id}] CLOVA API 호출 성공: audio_size={len(audio_content)} bytes, duration={clova_duration:.2f}s")
        
        # 오디오 데이터를 base64로 인코딩하여 반환
        audio_base64 = base64.b64encode(audio_content).decode('utf-8')
        
        result = {
            "audio": audio_base64,
            "format": "mp3"
        }
        
        # 캐시에 저장 (최대 100개 항목 유지)
        if len(tts_cache) >= 50:
            # 가장 오래된 항목 제거
            oldest_key = next(iter(tts_cache))
            del tts_cache[oldest_key]
        
        tts_cache[cache_key] = result
        total_duration = time.time() - start_time
        print(f"[TTS] [{request_id}] 요청 완료: cache_key={cache_key}, total_duration={total_duration:.2f}s")
        
        return result
        
    except Exception as e:
        total_duration = time.time() - start_time
        print(f"[TTS] [{request_id}] TTS 에러 발생: {str(e)}, total_duration={total_duration:.2f}s")
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