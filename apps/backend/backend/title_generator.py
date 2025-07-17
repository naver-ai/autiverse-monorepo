from typing import Dict, Any, Optional
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
from backend.utils.environment import get_env_variable, EnvironmentVariables
import json
import openai

class TitleGenerator:
    def __init__(self):
        self.client = openai.OpenAI()
    
    def generate_title(self, journal_data: Dict[str, Any], child_name: str) -> str:
        """만화 내용을 바탕으로 제목 생성"""
        try:
            # journal_data가 비어있으면 기본 제목 반환
            if not journal_data:
                return f"{child_name}의 그림 일기"
            
            # 제목 생성 프롬프트
            system_prompt = """You are an expert at generating titles for children's picture diaries.

Title Generation Rules:
1. Simple and fun titles that children can easily understand
2. Concise within 10 characters
3. Emojis can be used (1-2)
4. Can include the child's name
5. Reflect the core content of the comic
6. Focus on emotions or actions

Examples:
- "민수랑 학교에서 게임한 날 🏫"
- "우리 강아지와 산책한 날 🐕"
- "친구와 숨바꼭질 재미있게 한 날 😊"
- "엄마와 요리한 날 👩‍🍳"

Respond in JSON format:
{"title": "generated title"}"""

            user_prompt = f"""The following is the content of {child_name}'s picture diary:

{journal_data}

Based on the above content, please generate a korean title that {child_name} would like."""

            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
                max_tokens=100
            )

            result = response.choices[0].message.content
            try:
                parsed_result = json.loads(result)
                return parsed_result.get("title", f"{child_name}의 그림 일기")
            except json.JSONDecodeError:
                # JSON 파싱 실패 시 직접 반환
                return result.strip() if result else f"{child_name}의 그림 일기"
                
        except Exception as e:
            print(f"Error generating title: {e}")
            return f"{child_name}의 그림 일기"
    
    def process_title_feedback(self, user_feedback: str, current_title: str, child_name: str) -> str:
        """사용자 피드백에 따른 응답 생성"""
        if user_feedback in ["좋아", "좋아요", "좋다", "괜찮아"]:
            return f"유후~ {child_name}이 마음에 드는 제목이라 너무 좋다! 완성된 일기 다 확인했으면 다음 버튼을 눌러줘!"
        else:
            return "그럼 어떤 제목으로 하고 싶어?"
    
    def confirm_custom_title(self, custom_title: str, child_name: str) -> str:
        """사용자가 제안한 제목 확인"""
        return f"'{custom_title}' 이걸로 할까??"
    
    def process_custom_title_feedback(self, user_feedback: str, custom_title: str, child_name: str) -> str:
        """사용자 제안 제목에 대한 피드백 처리"""
        if user_feedback in ["응, 좋아!"]:
            return f"제목 너무 멋지다~ 완성된 일기 다 확인했으면 다음 버튼을 눌러줘!"
        else:
            return "그럼 어떤 제목으로 하고 싶어?" 