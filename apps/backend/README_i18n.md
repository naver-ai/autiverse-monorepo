# Backend i18n (Internationalization) 설정 가이드

## 개요

백엔드에서 `data/i18n` 폴더의 언어 파일을 활용하여 다국어 지원을 제공합니다. `Dyad.locale` 필드를 사용하여 사용자의 언어 설정을 관리합니다.

## 설치된 패키지

- `i18next`: Python용 i18n 라이브러리 (이미 설치됨)

## 파일 구조

```
backend/
├── backend/
│   └── utils/
│       ├── __init__.py
│       └── i18n.py          # i18n 유틸리티 모듈
├── test_i18n.py             # 테스트 스크립트
└── README_i18n.md           # 이 파일

data/
└── i18n/
    ├── en.json              # 영어 번역
    └── kr.json              # 한국어 번역
```

## 사용법

### 1. 기본 사용법

```python
from backend.utils.i18n import t, get_translation, has_translation
from backend.database.models import UserLocale

# 기본 번역
message = t('Home.WriteDiary', UserLocale.English)
# 결과: "Write Diary"

message = t('Home.WriteDiary', UserLocale.Korean)
# 결과: "일기 쓰기"
```

### 2. 변수가 포함된 번역

```python
# 변수가 포함된 번역
child_name = "Alice"
agent_name = "Buddy"

greeting = t('Journaling.AgentIntro.FirstVisitGreetingTemplate', 
             UserLocale.English, 
             child_name=child_name, 
             agent_name=agent_name)
# 결과: "Hello, Alice. I'm Buddy, and I'll be writing comic diaries with you for 2 weeks. Nice to meet you!"

greeting = t('Journaling.AgentIntro.FirstVisitGreetingTemplate', 
             UserLocale.Korean, 
             child_name=child_name, 
             agent_name=agent_name)
# 결과: "안녕, Alice야. 나는 2주간 너와 함께 그림 일기를 쓸 Buddy야. 만나서 반가워!"
```

### 3. 번역 존재 여부 확인

```python
# 번역 키가 존재하는지 확인
exists = has_translation('Home.WriteDiary', UserLocale.English)
# 결과: True

exists = has_translation('NonExistent.Key', UserLocale.English)
# 결과: False
```

### 4. Chatbot Controller에서 사용 예시

```python
from backend.utils.i18n import t
from backend.database.models import UserLocale

class ChatbotController:
    def _handle_revision_1_stage(self, journal_entry_id: str, message: str, audio_filename: str = None, locale: str = "Korean") -> Dict[str, Any]:
        # ... 기존 코드 ...
        
        if response == "COMIC_GENERATION_START":
            # 하드코딩된 메시지 대신 i18n 사용
            confirmation_message = t('Journaling.Messages.Revision1Confirmation', locale)
            
            return {
                "response": confirmation_message,
                "stage": "revision_1",
                "auto_comic_generation": True
            }
```

### 5. Dyad.locale 활용

```python
from backend.database.crud.chatbot import get_dyad_by_id
from backend.utils.i18n import t

def get_localized_message(dyad_id: str, key: str, **kwargs):
    """Dyad의 locale을 사용하여 번역된 메시지 반환"""
    dyad = get_dyad_by_id(db, dyad_id)
    locale = dyad.locale if dyad else UserLocale.Korean
    return t(key, locale, **kwargs)

# 사용 예시
message = get_localized_message(dyad_id, 'Journaling.Messages.NextButton')
```

## 번역 파일 구조

### 영어 (en.json)
```json
{
    "Home": {
        "WriteDiary": "Write Diary",
        "ViewPastDiaries": "View Past Diaries"
    },
    "Journaling": {
        "Messages": {
            "NextButton": "Next",
            "Revision1Confirmation": "Great!:) Then I'll draw what you confirmed for me! Please wait a moment~"
        },
        "AgentIntro": {
            "FirstVisitGreetingTemplate": "Hello, {child_name}. I'm {agent_name}, and I'll be writing comic diaries with you for 2 weeks. Nice to meet you!"
        }
    }
}
```

### 한국어 (kr.json)
```json
{
    "Home": {
        "WriteDiary": "일기 쓰기",
        "ViewPastDiaries": "지난 일기 보기"
    },
    "Journaling": {
        "Messages": {
            "NextButton": "다음",
            "Revision1Confirmation": "다행이다:) 그럼 네가 확인해준 내용을 내가 그림으로 그려볼게! 잠깐만 기다려줘~"
        },
        "AgentIntro": {
            "FirstVisitGreetingTemplate": "안녕, {child_name}{child_josa}. 나는 2주간 너와 함께 그림 일기를 쓸 {agent_name}{agent_josa}. 만나서 반가워!"
        }
    }
}
```

## 테스트

테스트 스크립트를 실행하여 i18n 기능을 확인할 수 있습니다:

```bash
cd backend
python test_i18n.py
```

## 주의사항

1. **UserLocale enum 값**: `UserLocale.Korean`과 `UserLocale.English`를 사용합니다.
2. **파일 매핑**: `kr.json` → `UserLocale.Korean`, `en.json` → `UserLocale.English`
3. **변수 보간**: `{variable_name}` 형식으로 변수를 사용할 수 있습니다.
4. **에러 처리**: 번역이 실패하면 키 자체를 반환합니다.
5. **경로**: `data/i18n` 폴더는 프로젝트 루트에 있어야 합니다.

## 기존 코드 마이그레이션

하드코딩된 메시지를 i18n으로 변경하는 방법:

### Before
```python
return {
    "response": "다행이다:) 그럼 네가 확인해준 내용을 내가 그림으로 그려볼게! 잠깐만 기다려줘~",
    "stage": "revision_1"
}
```

### After
```python
confirmation_message = t('Journaling.Messages.Revision1Confirmation', locale)
return {
    "response": confirmation_message,
    "stage": "revision_1"
}
```

이렇게 하면 `Dyad.locale`을 활용하여 사용자의 언어 설정에 따라 적절한 메시지가 표시됩니다. 