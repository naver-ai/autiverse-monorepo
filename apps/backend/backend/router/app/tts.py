import os
import json
import base64
import requests
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

class TTSRequest(BaseModel):
    text: str
    voice: str = "nara"
    speed: float = 0.6
    pitch: float = 0.9

@router.post("/clova")
async def clova_tts(request: TTSRequest):
    try:
        # CLOVA TTS API 설정
        client_id = os.getenv("CLOVA_CLIENT_ID")
        client_secret = os.getenv("CLOVA_CLIENT_SECRET")
        
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