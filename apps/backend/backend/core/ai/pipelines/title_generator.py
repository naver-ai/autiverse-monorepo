from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain.output_parsers import PydanticOutputParser
from langchain.schema import HumanMessage, SystemMessage
from backend.database.models import MessageIntent
from backend.utils.environment import get_env_variable, EnvironmentVariables
import json
import openai
import asyncio
from backend.utils.korean import escape_jongseong, append_josa

class TitleResult(BaseModel):
    """Title generation result"""
    title1: str = Field(description="First title option for the comic")
    title2: str = Field(description="Second title option for the comic")
    title3: str = Field(description="Third title option for the comic")

class TitleGenerator:
    def __init__(self):
        self.client = openai.OpenAI()
        self.llm = ChatOpenAI(
            model="gpt-4.1-mini-2025-04-14",
            temperature=0.1,
            api_key=get_env_variable(EnvironmentVariables.OPENAI_API_KEY)
        )
        self.title_parser = PydanticOutputParser(pydantic_object=TitleResult)
    
    async def generate_title(self, journal_data: Dict[str, Any], child_name: str) -> Dict[str, str]:
        child_name_escaped = escape_jongseong(child_name)

        """만화 내용을 바탕으로 제목 3개 생성 - Structured Output 사용"""
        try:
            # journal_data가 비어있으면 기본 제목 3개 반환
            if not journal_data:
                return {
                    "title1": f"{child_name_escaped}의 그림 일기",
                    "title2": f"{child_name_escaped}의 하루",
                    "title3": f"{child_name_escaped}의 이야기"
                }
            
            # 제목 생성 프롬프트
            system_prompt = """You are an expert at generating titles for children's picture diaries.

IMPORTANT: You must return a JSON object with "title1", "title2", and "title3" fields containing three different title options.

Title Generation Rules:
1. Generate exactly 3 different title options
2. Simple and fun titles that children can easily understand
3. Concise within 10 characters each
4. Emojis can be used (1-2 per title)
5. Include figure's name in the title except for the child's name as the diary is written by the child. When the only figure is the child, do not include the child's name in the title.
6. Reflect the core content of the comic
7. Focus on emotions or actions
8. Make each title unique and appealing
9. Do not contain punctuation marks

OUTPUT FORMAT:
Return a JSON object with "title1", "title2", and "title3" fields containing three different title options.

Examples:
- {{"title1": "민수랑 학교에서 게임한 날🏫", "title2": "민수랑 재미있게 논 날😊", "title3": "학교에서 민수랑 즐거운 시간🎮"}}
- {{"title1": "우리 강아지와 산책한 날🐕", "title2": "강아지랑 공원에서 논 날🌳", "title3": "강아지랑 산책🦮"}}
- {{"title1": "진영이랑 숨바꼭질 재미있게 한 날😊", "title2": "진영이랑 신나는 숨바꼭질🎯", "title3": "진영이랑 숨바꼭질 대박 재밌었던 날😄"}}
- {{"title1": "인사이드 아웃 또 본 날😊", "title2": "슬픔이에 빠진 날💙", "title3": "인사이드 아웃 집중해서 본 날😄"}} (When the only figure is the child, do not include the child's name in the title.)

Generate three structured title options in JSON format."""

            user_prompt = f"""The following is the content of {child_name}'s picture diary:

{journal_data}

Based on the above content, please generate a korean title that {child_name} would like."""

            # Retry logic for structured output
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    messages = [
                        SystemMessage(content=system_prompt),
                        HumanMessage(content=user_prompt)
                    ]
                    
                    response = await self.llm.ainvoke(messages)
                    result = self.title_parser.parse(response.content)
                    
                    return {
                        "title1": result.title1,
                        "title2": result.title2,
                        "title3": result.title3
                    }
                    
                except Exception as e:
                    print(f"Attempt {attempt + 1} failed: {e}")
                    if attempt == max_retries - 1:
                        print("All retries failed for title generation")
                        return {
                            "title1": f"{child_name_escaped}의 그림 일기",
                            "title2": f"{child_name_escaped}의 하루",
                            "title3": f"{child_name_escaped}의 이야기"
                        }
                    await asyncio.sleep(1)  # Brief delay before retry
                
        except Exception as e:
            print(f"Error generating title: {e}")
            return {
                "title1": f"{child_name_escaped}의 그림 일기",
                "title2": f"{child_name_escaped}의 하루",
                "title3": f"{child_name_escaped}의 이야기"
            }
    
    def process_title_feedback(self, user_feedback: str, current_title: str, child_name: str) -> tuple[str, MessageIntent | None]:
        child_name_escaped = escape_jongseong(child_name)
        """사용자 피드백에 따른 응답 생성"""
        
        # 1, 2, 3 선택 시 (제목 선택 완료)
        if user_feedback in ["1", "2", "3"]:
            current_title_with_josa = append_josa(current_title, "이", "가")
            return f"{current_title_with_josa} {child_name_escaped} 마음에 들었구나! 다행이다:) 왼쪽에 완성된 일기 천천히 보고 다 확인했으면 다음 버튼을 눌러줘!", MessageIntent.PromptNext
        
        # "다 별로야" 선택 시 (다른 제목 요청)
        elif user_feedback in ["다 별로야", "ChatInput.ButtonLabels.NotGoodAtAll"]:
            return "그럼 어떤 제목으로 하고 싶어?", MessageIntent.PromptOpenEndedAnswer

        else:
            return "그럼 어떤 제목으로 하고 싶어?", MessageIntent.PromptOpenEndedAnswer
    
    def confirm_custom_title(self, custom_title: str, child_name: str) -> tuple[str, MessageIntent | None, dict | None]:
        """사용자가 제안한 제목 확인"""
        return f"'{custom_title}' 이걸로 할까?", MessageIntent.CustomTitleConfirm, {"title": custom_title}
    
    def process_custom_title_feedback(self, user_feedback: str, custom_title: str, child_name: str, reject_count: int = 0) -> tuple[str, MessageIntent | None]:
        """사용자 제안 제목에 대한 피드백 처리"""
        if user_feedback in ["응, 좋아!"]:
            return f"제목 너무 멋지다! 완성된 일기 다 확인했으면 다음 버튼을 눌러줘!", MessageIntent.PromptNext
        else:
            # 2번 이상 클릭했을 때 다른 응답
            if reject_count >= 2:
                return "내가 잘 못 들어서 미안해.. 어떤 제목으로 하고 싶은지 채팅으로 쳐서 정확하게 알려줘! 😢", MessageIntent.PromptTextInput
            else:
                return "그럼 어떤 제목으로 하고 싶어?", MessageIntent.PromptOpenEndedAnswer
