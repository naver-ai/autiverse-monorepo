from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
from langchain.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field
from backend.utils.environment import get_env_variable, EnvironmentVariables
from backend.database.crud.chatbot import *
from backend.database.crud.chatbot import update_journal_entry_stage, update_comic_panels, update_comic_data, update_comic_status
from backend.database.crud.chatbot import get_messages_by_journal_entry_and_stage
from backend.database.models import JournalEntryStage, MessageRole
from backend.utils.i18n import t
from backend.utils.korean import append_josa
from backend.core.ai.pipelines.revision_2_stage import Revision2Stage
from sqlmodel import Session
import json
import openai
import os
import asyncio
from sqlmodel.ext.asyncio.session import AsyncSession

# LLM 인스턴스 캐시 (전역)
_llm_cache = {}
_parser_cache = {}

class PanelAnalysis(BaseModel):
    """Panel analysis result"""
    A: List[str] = Field(description="Panel 1 (Antecedent) issues")
    B: List[str] = Field(description="Panel 2 (Behavior) issues")
    C: List[str] = Field(description="Panel 3 (Consequence) issues")
    D: List[str] = Field(description="Panel 4 (Emotion) issues")

class StoryFlowAnalysis(BaseModel):
    """Complete story flow analysis"""
    content: PanelAnalysis = Field(description="Content analysis for each panel")
    order: List[str] = Field(description="Order issues that need to be resolved")

class PanelReconstruction(BaseModel):
    """Panel reconstruction result"""
    panel1: Optional[str] = Field(description="Panel 1 content")
    panel2: Optional[str] = Field(description="Panel 2 content")
    panel3: Optional[str] = Field(description="Panel 3 content")
    panel4: Optional[str] = Field(description="Panel 4 content")

class QuestionData(BaseModel):
    """Question generation data"""
    question: str = Field(description="Generated question")
    intent: str = Field(description="Question intent")
    focus_panel: Optional[str] = Field(description="Panel to focus on")

class NextQuestionData(BaseModel):
    """Next question generation data"""
    question: str = Field(description="Generated follow-up question")
    focused_panel: Optional[str] = Field(description="Panel to focus on")

@dataclass
class ComicPanel:
    """Comic panel data structure"""
    content: Optional[str]
    missing_content: Optional[str] = None

class ComicContextStage:
    def __init__(self, db: AsyncSession, journal_entry_id: str):
        self.db = db
        self.journal_entry_id = journal_entry_id
        self.child_name = None
        self.child_age = None
        self.child_gender = None
        self.agent_name = None
        self.agent_interests = None
        self.story_analysis = None
        self.final_comic_generation_started = False
        self.current_panels = None  # 메모리상의 최신 패널 상태
        
        # LangChain setup (캐시된 인스턴스 사용)
        model_key = "gpt-4.1-mini-2025-04-14"
        if model_key not in _llm_cache:
            _llm_cache[model_key] = ChatOpenAI(
                model=model_key,
                temperature=0.1,
                api_key=get_env_variable(EnvironmentVariables.OPENAI_API_KEY),
                timeout=20  # 20초 타임아웃 (단축)
            )
        self.llm = _llm_cache[model_key]
        
        # Parser 캐싱
        if "flow_parser" not in _parser_cache:
            _parser_cache["flow_parser"] = PydanticOutputParser(pydantic_object=StoryFlowAnalysis)
        if "reconstruction_parser" not in _parser_cache:
            _parser_cache["reconstruction_parser"] = PydanticOutputParser(pydantic_object=PanelReconstruction)
        if "question_parser" not in _parser_cache:
            _parser_cache["question_parser"] = PydanticOutputParser(pydantic_object=QuestionData)
        if "next_question_parser" not in _parser_cache:
            _parser_cache["next_question_parser"] = PydanticOutputParser(pydantic_object=NextQuestionData)
        
        self.flow_parser = _parser_cache["flow_parser"]
        self.reconstruction_parser = _parser_cache["reconstruction_parser"]
        self.question_parser = _parser_cache["question_parser"]
        self.next_question_parser = _parser_cache["next_question_parser"]
    
    @classmethod
    async def create(cls, db: AsyncSession, journal_entry_id: str) -> 'ComicContextStage':
        """비동기 팩토리 메서드 (최적화된 DB 쿼리)"""
        instance = cls(db, journal_entry_id)
        
        # 한 번의 DB 쿼리로 모든 정보 가져오기
        dyad_info = await instance._get_dyad_info()
        instance.child_name = dyad_info[0]
        instance.child_age = dyad_info[1]
        instance.child_gender = dyad_info[2]
        instance.agent_name = dyad_info[3]
        instance.agent_interests = dyad_info[4]
        
        # 기존 comic_context가 있으면 메모리에 로드
        journal = await get_journal(db, journal_entry_id)
        if journal and journal.comic_context:
            instance.current_panels = journal.comic_context
        
        return instance
    
    async def _get_dyad(self) -> Dyad:
        """dyad 정보를 가져오기"""
        from backend.database.crud.chatbot import get_journal_entry
        journal_entry = await get_journal_entry(self.db, self.journal_entry_id)
        return journal_entry.dyad if journal_entry and journal_entry.dyad else None

    async def _get_dyad_info(self) -> tuple[str, int, str, str, list[str]]:
        """dyad 정보를 한 번에 가져오기 (child_name, child_age, child_gender, agent_name, agent_interests)"""
        dyad = await self._get_dyad()
        if not dyad:
            return "사용자", 15, "male", "도도", ["Dinosaurs", "Counting things", "Talking to himself"]
        
        child_name = dyad.child_name or "사용자"
        child_age = dyad.child_age or 15
        child_gender = dyad.child_gender or "male"
        # agent 정보 가져오기
        agent_name = "도도"  # fallback
        agent_interests = ["Dinosaurs", "Counting things", "Talking to himself"]  # fallback
        
        if dyad.agents:
            agent_name = dyad.agents[0].agent_name or "도도"
            interests = []
            for agent in dyad.agents:
                if agent.interest:
                    interests.append(agent.interest)
            if interests:
                agent_interests = interests
        
        return child_name, child_age, child_gender, agent_name, agent_interests
    
    async def _get_child_name(self) -> str:
        """dyad의 child_name을 가져오기"""
        return (await self._get_dyad_info())[0]
    
    async def _get_child_age(self) -> int:
        """dyad의 child_age를 가져오기"""
        return (await self._get_dyad_info())[1]
    
    async def _get_agent_name(self) -> str:
        """agent의 agent_name을 가져오기"""
        return (await self._get_dyad_info())[3]
    
    async def _get_agent_interests(self) -> list[str]:
        """agent의 interest 목록을 가져오기"""
        return (await self._get_dyad_info())[4]
    
    async def _get_child_gender(self) -> str:
        """dyad의 child_gender를 가져오기"""
        return (await self._get_dyad_info())[2]
    
    def _check_issues(self, story_analysis: Dict[str, Any]) -> tuple[bool, bool]:
        """Content와 Order issue 확인"""
        content_issues = story_analysis.get("content", {})
        order_issues = story_analysis.get("order", [])
        
        # Content 이슈 확인
        content_has_issues = [
            content_issues.get("A", []),
            content_issues.get("B", []),
            content_issues.get("C", []),
            content_issues.get("D", [])
        ]
        
        has_content_issues = any(
            any(issue.strip() for issue in issues if issue.strip())
            for issues in content_has_issues
        )
        
        # Order 이슈 확인
        has_order_issues = any(
            order.strip() for order in order_issues if order.strip()
        )
        
        return has_content_issues, has_order_issues
    
    def get_character_background(self) -> str:
        """동적으로 character background 생성"""
        return f"""[Character Background]
You are a {self.child_age}-year-old Korean middle school student named {self.agent_name}.
You're having a friendly conversation with your autistic best friend, {self.child_name} (also {self.child_gender}).

{self.child_name}'s special interests:
{chr(10).join([f"- {interest}" for interest in self.agent_interests])}

[General Speaking Rules]
1. Use informal Korean like talking to a peer friend. Do not use honorifics.
2. Keep responses short and simple - one or two sentences maximum.
3. Use emojis appropriately.
4. Ask only one question per turn.
5. Never apologize or say sorry.
6. Cover only one topic or question in a message if possible, and move to the next upon the user's reaction.
7. If the user brings up special interests, show interest but gently guide back to the main topic.
8. If the user asks a question that should be asked to adults or unrelated to the conversation topic, then you can say, "I don't know," and go back to the conversation topic.
"""
        
    async def start_context_analysis(self) -> Message:
        """만화 컨텍스트 분석 시작 - 하드코딩된 첫 메시지"""
        try:
            # Journal entry stage 업데이트
            await update_journal_entry_stage(self.db, self.journal_entry_id, JournalEntryStage.ComicContext)
            
            # 고정된 comic panels 설정 (comic generation과 같은 grid 형태)
            # fixed_comic_panels = {
            #     "panel1": {
            #         "content": "I played with Oliver at school today.",
            #         "place": "School",
            #         "grid": [
            #             {"type": "figure", "content": "Me", "position": [1, 2]},
            #             {"type": "figure", "content": "Oliver", "position": [2, 2]}
            #         ]
            #     },
            #     "panel2": {
            #         "content": "",
            #         "place": "",
            #         "grid": []
            #     },
            #     "panel3": {
            #         "content": "Oliver was in a bad mood.",
            #         "place": "",
            #         "grid": [
            #             {"type": "figure", "content": "Oliver", "position": [2, 2], "action": [{"type": "emotion", "content": "bad mood"}]}
            #         ]
            #     },
            #     "panel4": {
            #         "content": "",
            #         "place": "",
            #         "grid": []
            #     }
            # } #- English

            fixed_comic_panels = {
                "panel1": {
                    "content": "나는 오늘 충호랑 학교에서 놀았다.",
                    "place": "학교",
                    "grid": [
                        {"type": "figure", "content": "나", "position": [1, 2]},
                        {"type": "figure", "content": "충호", "position": [2, 2]}
                    ]
                },
                "panel2": {
                    "content": "",
                    "place": "",
                    "grid": []
                },
                "panel3": {
                    "content": "충호는 기분이 안 좋았다.",
                    "place": "",
                    "grid": [
                        {"type": "figure", "content": "충호", "position": [2, 2], "action": [{"type": "emotion", "content": "기분 안 좋음"}]}
                    ]
                },
                "panel4": {
                    "content": "",
                    "place": "",
                    "grid": []
                }
            } #- Korean
            
            # comic_context에 고정된 panels 저장 (grid 정보 포함)
            await update_journal_data(
                self.db, self.journal_entry_id,
                comic_context=fixed_comic_panels
            )
            
            # 새로운 interaction turn 생성
            interaction_turn = await create_interaction_turn(
                self.db, self.journal_entry_id, JournalEntryStage.ComicContext
            )
            
            # 하드코딩된 대화 순서와 각 메시지별 설정
            # hardcoded_messages = [
            #     {
            #         "message": "I turned what you told me into a four-panel comic! But I couldn't draw everything with the information I had. Could you help me fill in the missing parts? When you're ready, press the 'Next' button!",
            #         "focused_panel": None,
            #         "panel_updates": {}
            #     },
            #     {
            #         "message": "It must have been fun playing with Oliver at school! 😄 What did you do with him?",
            #         "focused_panel": "panel2",
            #         "panel_updates": {}
            #     },
            #     {
            #         "message": "Playing with the eraser sounds like fun! 😄 But then, what happened to Oliver that made him feel bad? Was it because of the eraser, or did something else happen?",
            #         "focused_panel": "panel2",
            #         "panel_updates": {
            #             "panel2": "Oliver and I played with an eraser."
            #         }
            #     },
            #     {
            #         "message": "What did you do with Oliver’s eraser? Did you just erase something quickly, or did you do something else too?",
            #         "focused_panel": "panel2",
            #         "panel_updates": {
            #             "panel1": "I played with Oliver at school today with an eraser.",
            #             "panel2": "I used his eraser without asking."
            #         }
            #     },
            #     {
            #         "message": "Oh, I see. What was Oliver's reaction when he saw you throwing the eraser? Did he get angry, or did he say something?",
            #         "focused_panel": "panel3",
            #         "panel_updates": {
            #             "panel2": "I threw his eraser without asking."
            #         }
            #     },
            #     {
            #         "message": "Oh, Oliver got mad.. 😥 How did you feel when he got angry and told the teacher?",
            #         "focused_panel": "panel4",
            #         "panel_updates": {
            #             "panel3": "Oliver got angry and told the teacher."
            #         }
            #     }
            # ] #- English
            hardcoded_messages = [
                {
                    "message": "짜잔~ 네가 말해준 내용을 4컷 만화로 그려봤어! 그런데 네가 말해준 내용 만으로는 그림을 충분히 그릴 수 없었어.. 그림 일기를 완성할 수 있도록 몇가지 확인해줄래?? 준비되면 '다음' 버튼을 눌러줘!",
                    "focused_panel": None,
                    "panel_updates": {}
                },
                {
                    "message": "학교에서 충호랑 놀았다니 재미있었겠다! 😄 충호랑 뭐하고 놀았어?",
                    "focused_panel": "panel2",
                    "panel_updates": {}
                },
                {
                    "message": "지우개 가지고 노는 거 진짜 재밌었겠다! 😄 그런데 무슨 일이 있었길래 충호 기분이 안 좋아졌어? 지우개 때문이었어? 아니면 다른 일이 있었어?",
                    "focused_panel": "panel2",
                    "panel_updates": {
                        "panel2": "나는 충호랑 지우개를 가지고 놀았다."
                    }
                },
                {
                    "message": "충호 지우개를 뭐 하는 데 썼어? 그냥 잠깐 뭐를 지운거야? 아니면 다른 것도 했어?",
                    "focused_panel": "panel2",
                    "panel_updates": {
                        "panel1": "나는 충호랑 학교에서 지우개를 가지고 놀았다.",
                        "panel2": "나는 충호한테 물어보지도 않고 충호 지우개를 썼다."
                    }
                },
                {
                    "message": "아, 그랬구나! 네가 지우개 던지는 걸 보고 충호는 어떤 반응을 보였어? 화를 냈어? 아니면 어떤 말을 했어?",
                    "focused_panel": "panel3",
                    "panel_updates": {
                        "panel2": "나는 충호한테 물어보지도 않고 충호 지우개를 던졌다."
                    }
                },
                {
                    "message": "아, 충호가 화났구나.. 😥 충호가 화를 내고 선생님께 말씀드렸을 때 네 기분은 어땠어?",
                    "focused_panel": "panel4",
                    "panel_updates": {
                        "panel3": "충호가 화를 내고 선생님께 말씀드렸다."
                    }
                }
            ]
            
            # 첫 번째 메시지 (comic 소개)
            initial_question = hardcoded_messages[0]["message"]
            initial_focused_panel = hardcoded_messages[0]["focused_panel"]
            initial_panel_updates = hardcoded_messages[0]["panel_updates"]
            intent = MessageIntent.PromptNext
            
            # 첫 번째 메시지이므로 카운터는 0
            
            # 첫 번째 메시지에도 panel_updates는 UI에서만 적용 (DB 저장 안 함)
            if initial_panel_updates:
                print(f"[DEBUG] comic_context: initial_panel_updates: {initial_panel_updates}")
            
            # 첫 번째 메시지에도 focused_panel과 panel_updates 정보 포함
            metadata_json = {}
            if initial_focused_panel:
                metadata_json["focused_panel"] = initial_focused_panel
            if initial_panel_updates:
                metadata_json["panel_updates"] = initial_panel_updates
            metadata_json = metadata_json if metadata_json else None
            print(f"[DEBUG] comic_context: Creating initial message with focused_panel={initial_focused_panel}, panel_updates={initial_panel_updates}, metadata_json={metadata_json}")
            
            message = await create_message(
                self.db, self.journal_entry_id, interaction_turn.id,
                initial_question, MessageRole.Assistant, JournalEntryStage.ComicContext,
                intent=intent,
                metadata_json=metadata_json
            )
            
            return message
        except Exception as e:
            print(f"[DEBUG] comic_context: Error in start_context_analysis: {e}")
            raise
    
    async def process_message(self, user_message: str, intent: MessageIntent | None = None, audio_filename: str = None) -> Message:
        """사용자 메시지 처리 - 완전히 하드코딩된 대화"""
        print(f"[DEBUG] comic_context: process_message called with user_message='{user_message}', intent={intent}")
        print(f"[DEBUG] comic_context: current conversation_count before: {getattr(self, '_conversation_count', 'NOT_SET')}")
        try:
            # 현재 interaction turn 가져오기
            interaction_turn = await self._get_or_create_interaction_turn(JournalEntryStage.ComicContext)
            
            # 사용자 메시지 저장 (audio_filename 포함)
            await create_message(
                self.db, self.journal_entry_id, interaction_turn.id,
                user_message, MessageRole.User, JournalEntryStage.ComicContext,
                audio_filename=audio_filename,
                intent=intent
            )
            
            # 감정 선택이 완료된 경우 comic_generation 시작
            if intent == MessageIntent.AnswerEmotion:
                print(f"[DEBUG] comic_context: Emotion selected, starting comic generation")
                
                # comic_generation 시작 신호 반환
                # response_message = "Thanks for answering my questions. Now I can draw in the rest of the panel! Just wait a little bit!" #- English
                response_message = "내가 물어보는 질문에 잘 답해줘서 고마워. 네 덕분에 비어있던 부분을 채울 수 있을 것 같아! 조금만 기다려줘~" #- Korean
                response_intent = MessageIntent.StartComicGeneration

                message = await create_message(
                    self.db, self.journal_entry_id, interaction_turn.id,
                    response_message, MessageRole.Assistant, JournalEntryStage.ComicContext,
                    intent=response_intent
                )
                
                return message
            
            # 하드코딩된 대화 순서와 각 메시지별 설정
            # hardcoded_messages = [
            #     {
            #         "message": "I turned what you told me into a four-panel comic! But I couldn't draw everything with the information I had. Could you help me fill in the missing parts? When you're ready, press the 'Next' button!",
            #         "focused_panel": None,
            #         "panel_updates": {}
            #     },
            #     {
            #         "message": "It must have been fun playing with Oliver at school! 😄 What did you do with Oliver?",
            #         "focused_panel": "panel2",
            #         "panel_updates": {}
            #     },
            #     {
            #         "message": "Playing with the eraser sounds like fun! But then, what happened to Oliver that made him feel bad? Was it because of the eraser, or did something else happen?",
            #         "focused_panel": "panel2",
            #         "panel_updates": {
            #             "panel2": "Oliver and I played with an eraser."
            #         }
            #     },
            #     {
            #         "message": "How did you use the Oliver's eraser? Did you just erase it quickly, or did you do something else too?",
            #         "focused_panel": "panel2",
            #         "panel_updates": {
            #             "panel1": "I played with Oliver at school today with an eraser.",
            #             "panel2": "I used his eraser without asking."
            #         }
            #     },
            #     {
            #         "message": "Oh, I see. What was Oliver's reaction when he saw you throwing the eraser? Did he get angry, or did he say something?",
            #         "focused_panel": "panel3",
            #         "panel_updates": {
            #             "panel2": "I threw his eraser without asking."
            #         }
            #     },
            #     {
            #         "message": "Oh, Oliver got mad.. 😥 How did you feel when he got angry and told the teacher?",
            #         "focused_panel": "panel4",
            #         "panel_updates": {
            #             "panel3": "Oliver got angry and told the teacher."
            #         }
            #     }
            # ] #-English

            hardcoded_messages = [
                {
                    "message": "짜잔~ 네가 말해준 내용을 4컷 만화로 그려봤어! 그런데 네가 말해준 내용 만으로는 그림을 충분히 그릴 수 없었어.. 그림 일기를 완성할 수 있도록 몇가지 확인해줄래?? 준비되면 '다음' 버튼을 눌러줘!",
                    "focused_panel": None,
                    "panel_updates": {}
                },
                {
                    "message": "학교에서 충호랑 놀았다니 재미있었겠다! 😄 충호랑 뭐하고 놀았어?",
                    "focused_panel": "panel2",
                    "panel_updates": {}
                },
                {
                    "message": "지우개 가지고 노는 거 진짜 재밌었겠다! 😄 그런데 무슨 일이 있었길래 충호 기분이 안 좋아졌어? 지우개 때문이었어? 아니면 다른 일이 있었어?",
                    "focused_panel": "panel2",
                    "panel_updates": {
                        "panel2": "나는 충호랑 지우개를 가지고 놀았다."
                    }
                },
                {
                    "message": "충호 지우개를 뭐 하는 데 썼어? 그냥 잠깐 뭐를 지운거야? 아니면 다른 것도 했어?",
                    "focused_panel": "panel2",
                    "panel_updates": {
                        "panel1": "나는 충호랑 학교에서 지우개를 가지고 놀았다.",
                        "panel2": "나는 충호한테 물어보지도 않고 충호 지우개를 썼다."
                    }
                },
                {
                    "message": "아, 그랬구나! 네가 지우개 던지는 걸 보고 충호는 어떤 반응을 보였어? 화를 냈어? 아니면 어떤 말을 했어?",
                    "focused_panel": "panel3",
                    "panel_updates": {
                        "panel2": "나는 충호한테 물어보지도 않고 충호 지우개를 던졌다."
                    }
                },
                {
                    "message": "아, 충호가 화났구나.. 😥 충호가 화를 내고 선생님께 말씀드렸을 때 네 기분은 어땠어?",
                    "focused_panel": "panel4",
                    "panel_updates": {
                        "panel3": "충호가 화를 내고 선생님께 말씀드렸다."
                    }
                }
            ]
            
            # 현재 comic_context stage의 Assistant 메시지 개수를 세어서 카운터 계산
            messages = await get_messages_by_journal_entry_and_stage(self.db, self.journal_entry_id, JournalEntryStage.ComicContext)
            assistant_messages = [msg for msg in messages if msg.role == MessageRole.Assistant]
            current_count = len(assistant_messages)  # 첫 번째 메시지 포함해서 계산
            
            print(f"[DEBUG] comic_context: Total messages: {len(messages)}")
            print(f"[DEBUG] comic_context: Assistant messages: {len(assistant_messages)}")
            print(f"[DEBUG] comic_context: Current count: {current_count}")
            print(f"[DEBUG] comic_context: Hardcoded messages length: {len(hardcoded_messages)}")
            
            # 카운터가 범위를 벗어나지 않도록 제한
            if current_count < 0:
                current_count = 0
            elif current_count >= len(hardcoded_messages):
                current_count = len(hardcoded_messages) - 1
                
            print(f"[DEBUG] comic_context: Adjusted count: {current_count}")
            print(f"[DEBUG] comic_context: Will return: {hardcoded_messages[current_count]['message'] if current_count < len(hardcoded_messages) else 'END'}")
            
            # 마지막 메시지인 경우 만화 생성으로 전환
            if current_count >= len(hardcoded_messages):
                # 하드코딩된 대화가 끝났으므로 _generate_final_comic_panels 호출
                await self._generate_final_comic_panels()
                
                # 만화 생성 시작 신호 반환
                response_message = "Thanks for answering my questions. Now I can draw in the rest of the panel! "
                response_intent = MessageIntent.StartComicGeneration

                message = await create_message(
                    self.db, self.journal_entry_id, interaction_turn.id,
                    response_message, MessageRole.Assistant, JournalEntryStage.ComicContext,
                    intent=response_intent
                )
                
                return message
            else:
                # 현재 메시지 설정 가져오기
                current_message_config = hardcoded_messages[current_count]
                response_message = current_message_config["message"]
                focused_panel = current_message_config["focused_panel"]
                panel_updates = current_message_config["panel_updates"]
                
                # 첫 번째 메시지는 Next 버튼, 마지막 메시지는 감정 입력, 나머지는 텍스트 입력
                if current_count == 0:
                    response_intent = MessageIntent.PromptNext
                elif current_count == len(hardcoded_messages) - 1:
                    response_intent = MessageIntent.PromptEmotion
                else:
                    response_intent = MessageIntent.PromptOpenEndedAnswer
                print(f"[DEBUG] comic_context: Returning message {current_count}: {response_message}")

                # panel_updates는 UI에서만 적용 (DB 저장 안 함)
                print(f"[DEBUG] comic_context: panel_updates: {panel_updates}")

                # 메시지 생성 (focused_panel과 panel_updates 정보 포함)
                metadata_json = {}
                if focused_panel:
                    metadata_json["focused_panel"] = focused_panel
                if panel_updates:
                    metadata_json["panel_updates"] = panel_updates
                metadata_json = metadata_json if metadata_json else None
                print(f"[DEBUG] comic_context: Creating message with focused_panel={focused_panel}, panel_updates={panel_updates}, metadata_json={metadata_json}")
                message = await create_message(
                    self.db, self.journal_entry_id, interaction_turn.id,
                    response_message, MessageRole.Assistant, JournalEntryStage.ComicContext,
                    intent=response_intent,
                    metadata_json=metadata_json
                )
                
                return message
                
        except Exception as e:
            print(f"[DEBUG] comic_context: Error in process_message: {e}")
            import traceback
            traceback.print_exc()
            raise
    
    async def _analyze_story_flow(self) -> Dict[str, Any]:
        """스토리 플로우 분석 - Structured Output 사용"""
        journal = await get_journal(self.db, self.journal_entry_id)
        if not journal:
            return {"content": {"A": [], "B": [], "C": [], "D": []}, "order": []}
        
        # 메모리상의 최신 패널 상태를 우선적으로 사용
        if self.current_panels:
            panels_content = self.current_panels
        else:
            # 메모리에 없으면 데이터베이스에서 가져오기
            panels_content = journal.comic_context if journal.comic_context else journal.revision_1
            
        if not panels_content:
            return {"content": {"A": [], "B": [], "C": [], "D": []}, "order": []}
        
        system_prompt = """You are "ABCD-Diary Reviewer."

────────────────────
INPUT (always 4 lines)
────────────────────
panel1  = A - Antecedent   // where, who, situation (time optional)
panel2  = B - Behavior     // observable action, how / how long / with what
panel3  = C - Consequence  // factual outcome or others' reaction right after B
panel4  = D - Emotion      // writer's own feeling only (emotion word) - NEVER others' emotions

────────────────────
YOUR TASK
────────────────────
1. Read the four lines EXACTLY as provided.
2. Determine if this is a PROBLEMATIC or NORMAL situation:
   - PROBLEMATIC: scolding, crying, fighting, getting hurt, being embarrassed, etc.
   - NORMAL: playing, eating, studying, visiting places, etc.

3. Analyze each category (A, B, C, D) and separate issues into TWO categories:

   **CONTENT ISSUES** (missing information):
   • Required info present?
     – If essential details are absent or null, specify what is missing and give a short example.  
       (For A, do not flag missing time unless the scene is confusing without it.)
   • **FLOW ANALYSIS:**
     – A→B Flow: Does panel A provide sufficient context for panel B to make sense?
     – B→C Flow: Does panel B provide sufficient action/behavior for panel C to be a logical consequence?
     – If flow is broken, specify what's missing to connect the panels logically

   **ORDER ISSUES** (content in wrong panel):
   • Category purity kept?
     – If the line contains data that belongs to another category, specify exactly which part should move:  
       "B content in C: '내가 숨었다' should move to B, keep '미경이가 나를 찾았다' in C"
     – **CRITICAL: Only flag content that is CLEARLY in the wrong category**
     – **CRITICAL: If content is already in the correct category, do NOT suggest moving it**
      - If content naturally fits in its current panel, do NOT suggest moving it
      - Behavior content (actions) belongs in B, even if it includes some context
      - Consequence content (results/reactions) belongs in C, even if it includes some context
      - Do NOT split content unnecessarily - if it flows naturally, keep it together
   • **CRITICAL TIMELINE RULE:**
     • Even if content describes behavior/action, if it happened AFTER the C panel events, it should be added to C panel, not B panel
     • C panel can contain multiple sequential events that happened after the main action in B panel
     • Example: If C panel is "My mom praised me" and then "I go to bed" happened after, "I go to bed" goes in C panel, not B panel
     • In this case, do not flag order issue.

   *Required sub-details*  
     A : place / people / background situation
     B : concrete action, method‧tools  
     C : immediate factual result or a near-future plan that was directly agreed as a result of B or existing character's response (avoid introducing new characters)
     D : pure emotion word (intensity optional)

   **CRITICAL: When asking about C (Consequence), focus on WHAT HAPPENED NEXT, not HOW the action was done**
   - If B already describes the result (e.g., "I didn't fall"), ask about the NEXT action or response
   - Examples:
     - B: "I didn't fall" → C: Ask "What did you do next?" (continue riding, stop and thank, etc.)
     - B: "I stopped the bike" → C: Ask "What happened after stopping?" (thanked, continued, etc.)
   - Do NOT ask "How did you do it?" when the result is already clear

   **FLOW REQUIREMENTS:**
     A→B Flow: A must provide context (where/who) that makes B's action logical
     B→C Flow: B must provide action that logically leads to C's result/reaction
     If flow is broken, identify what's missing to connect the panels

4. QUESTION FOCUS based on situation type:
   - PROBLEMATIC situations: Focus on "WHY" questions (causes, reasons)
   - NORMAL situations: Focus on "HOW" questions (methods, details)

────────────────────
OUTPUT (structured output)
────────────────────
Analyze the panels and provide structured output with content issues and order issues.

────────────────────
MANDATORY RULES
────────────────────
• **CRITICAL: Analyze ONLY the exact content provided in each panel**
• **CRITICAL: Do NOT invent or assume content that is not present**
• **CRITICAL: Do NOT flag content that is already present in the panel, even if phrased differently**
• **CRITICAL: Focus on truly missing information, not rephrasing of existing content**
• **CRITICAL: content array contains ONLY missing information issues**
• **CRITICAL: order array contains ONLY content separation instructions**
• **CRITICAL: When content needs to be separated, use exact format "X content in Y: 'text' should move to X, keep 'text' in Y"**
• **CRITICAL: Only suggest moving content when it is CLEARLY in the wrong category**
• **CRITICAL: If content fits naturally in its current panel, leave it there**
• **CRITICAL: Panel D should ONLY contain the writer's own emotions, not others' emotions**
• **CRITICAL: Do NOT suggest moving content that is already in the correct panel**
• **CRITICAL: Do NOT create order issues for content that is properly categorized**
• **CRITICAL: Before creating any order issue, verify that the content actually exists in the specified panel**
• **CRITICAL: If you cannot find the exact content mentioned in an order issue, do NOT create that order issue**
• **CRITICAL: Only create order issues for content that is CLEARLY misplaced**
• Produce nothing except the single JSON block.

────────────────────
EXAMPLES
────────────────────

# Example 1
Input  
"panel1": "민수와 나는 학교에서 고등어 해부 쇼를 했다.",  
"panel2": null,  
"panel3": "나는 머리를 자르고 배를 열어서 장기를 봉투에 넣었다.",  
"panel4": null

Output  
{
  "situation_type": "normal",
  "content": {
    "A": ["배경 상황 누락 — e.g. '쉬는 시간에'"],
    "B": [""],
    "C": ["결과 누락 — e.g. '민수가 웃으면서 대박이라고 했다'"],
    "D": ["감정 누락 — e.g. '나는 기뻤다'"]
  },
  "order": [
    "B content in C: '나는 머리를 자르고 배를 열어서 장기를 봉투에 넣었다' should move to B, keep '' in C"
  ]
}

# Example 2 
Input  
"panel1": "나는 어머니에게 놀이공원에 가고 싶다고 말했다.",  
"panel2": "어머니가 '그래, 가자'고 했다.",  
"panel3": "우리는 다음주 토요일에 가서 롤러코스터를 탈 것이다.",  
"panel4": "나는 떨렸다."

Output  
{
  "situation_type": "normal",
  "content": {
    "A": ["장소 누락 — e.g. '집에서'"],
    "B": [""],
    "C": [""],                    
    "D": [""]
  },
  "order": []
}

# Example 3 - Flow Analysis
Input  
"panel1": "나는 학교 복도에서 걸었다.",  
"panel2": "소현이가 갑자기 내 앞을 막고 울기 시작했다.",  
"panel3": null,  
"panel4": "나는 긴장되고 땀이 났다."

Output
{
  "situation_type": "problematic",
  "content": {
    "A": [""],
    "B": ["울게 된 이유 누락 — e.g. '내가 실수로 부딪혔기 때문'"],
    "C": ["C 누락 — e.g. '소현이가 계속 울면서 움직이지 않았다'"],
    "D": [""]
  },
  "order": []
}

# Example 4 - Content Separation
Input  
"panel1": "나는 친구들과 놀이터에서 숨바꼭질을 했다.",  
"panel2": "",  
"panel3": "나는 나무 뒤에 숨었지만 민수가 나를 찾았다.",  
"panel4": "나는 신났다."

Output
{
  "situation_type": "normal",
  "content": {
    "A": [""],
    "B": ["B 누락 - e.g. '나는 나무 뒤에 숨었다'"],
    "C": [""],
    "D": [""]
  },
  "order": [
    "B content in C: '나는 나무 뒤에 숨었다' should move to B, keep '하지만 민수가 나를 찾았다' in C"
  ]
}

# Example 5 - D Content in C Separation
Input  
"panel1": "나는 어머니와 피자를 만들었다.",  
"panel2": "나는 반죽을 치댔고 토핑을 올렸다.",  
"panel3": "어머니가 잘 만들었다고 칭찬해서 나는 기뻤고 신났다",  
"panel4": null

Output
{
  "situation_type": "normal",
  "content": {
    "A": [""],
    "B": [""],
    "C": [""],
    "D": ["감정 누락 — e.g. '나는 기뻤다'"]
  },
  "order": [
    "D content in C: '나는 기뻤고 신났다' should move to D, keep '어머니가 잘 만들었다고 칭찬했다' in C"
  ]
}"""

        user_prompt = f"""Analyze Below Panels:
"panel1": "{panels_content.get('panel1', 'null')}",
"panel2": "{panels_content.get('panel2', 'null')}",
"panel3": "{panels_content.get('panel3', 'null')}",
"panel4": "{panels_content.get('panel4', 'null')}"
"""

        # Retry logic for structured output
        max_retries = 3
        for attempt in range(max_retries):
            try:
                messages = [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_prompt)
                ]
                
                response = await self.llm.ainvoke(messages)
                result = self.flow_parser.parse(response.content)
                
                # Convert to dict format for compatibility
                analysis_result = {
                    "content": {
                        "A": result.content.A,
                        "B": result.content.B,
                        "C": result.content.C,
                        "D": result.content.D
                    },
                    "order": result.order
                }
                
                print(f"Story Flow Analysis Result: {json.dumps(analysis_result, ensure_ascii=False, indent=2)}")
                return analysis_result
                
            except Exception as e:
                print(f"Attempt {attempt + 1} failed: {e}")
                if attempt == max_retries - 1:
                    print("All retries failed, returning empty result")
                    return {"content": {"A": [], "B": [], "C": [], "D": []}, "order": []}
                await asyncio.sleep(1)  # Brief delay before retry
    
    async def _reconstruct_panel(self, answer: str, question: str, add_to_history: bool = True) -> None:
        """패널 재구성 - Structured Output 사용"""
        if not self.story_analysis:
            self.story_analysis = await self._analyze_story_flow()
        
        journal = await get_journal(self.db, self.journal_entry_id)
        if not journal:
            return
        
        system_prompt = """You are a rewriting engine that fixes 4-panel diary drafts written in first-person Korean past tense based on the user's answer and order instructions.

ABCD STRUCTURE:
- A (panel1): Antecedent - where, who, situation 
- B (panel2): Behavior - observable action, how/with what
- C (panel3): Consequence - immediate result or existing character's response (avoid new characters)
- D (panel4): Emotion - writer's own feeling only (emotion word)

**CRITICAL TIMELINE RULE:**
- Even if content describes behavior/action, if it happened AFTER the C panel events, it should be added to C panel, not B panel
- C panel can contain multiple sequential events that happened after the main action in B panel
- Example: If B panel is "I played soccer" and then "I went home" happened after, "I went home" goes in C panel, not B panel

**CRITICAL TASK ORDER - YOU MUST FOLLOW THIS SEQUENCE:**

**STEP 1: CONTENT REORGANIZATION (FIRST PRIORITY)**
1. **Process ALL order instructions FIRST before adding new information**
2. **Move content between panels according to order array:**
   • If order says "B content in C: 'I hid' should move to B, keep 'but Minsoo found me' in C"
   • Then: Move "I hid" to panel2 (B), keep "but Minsoo found me" in panel3 (C)
   • If order says "D content in C: 'I felt happy' should move to D, keep 'Mom praised me' in C"
   • Then: Move "I felt happy" to panel4 (D), keep "Mom praised me" in panel3 (C)
   • **CRITICAL: Extract the exact text mentioned in quotes from order array and move it**
   • **CRITICAL: When moving content, merge with existing content in the target panel**

**STEP 2: ADD NEW INFORMATION (SECOND PRIORITY)**
1. **After reorganization, add new information from user's answer:**
   • **CRITICAL: Interpret simple answers like "응", "그래" based on the question context:**
     - **YES/NO QUESTIONS: When question asks "~ 했어?" and answer is "응"/"그래" → interpret as "YES, that happened"**
     - **CHOICE QUESTIONS: When question provides choices and answer is "1"/"2"/"3" → interpret as the selected choice**
     - **CONTEXT-BASED INTERPRETATION: Extract the specific information from the question that the user is confirming**
     - **CRITICAL: For "응"/"그래" answers, extract the COMPLETE action from the question including the subject:**
     - **EXAMPLES:**
       - Q: "집에서 했어?" A: "응" → "집에서 했다" (집에서)
       - Q: "엄마가 칭찬했어?" A: "그래" → "엄마가 칭찬했다" (엄마가 칭찬)
       - Q: "철수한테 미안하다고 했어?" A: "응" → "나는 철수에게 미안하다고 했다" (나는 철수에게 미안하다고)
       - Q: "선생님이 뭐라고 했어?" A: "노래 잘한다고" → "선생님이 노래를 잘한다고 했다" (선생님이 노래를 잘한다고)
       - Q: "쉬는 시간에 했어? 점심시간에 했어?" A: "1" → "쉬는 시간에 했다" (쉬는 시간)
   
   • **CRITICAL: Analyze question-answer context to determine the correct panel placement:**
   • **CRITICAL: When question asks about someone's words, preserve the speaker in the answer:**
     - Q: "선생님께서 뭐라고 하셨어?" A: "노래 잘한다고 하셨어"
     - Result: "선생님께서 나에게 노래를 잘한다고 하셨다" (NOT "나는 노래를 잘한다고 생각했다")
   • **CRITICAL: D panel (emotion) should ONLY contain pure emotion words:**
   • **CRITICAL: When question asks about someone's action, preserve the actor:**
     - Q: "엄마가 뭐하셨어?" A: "요리하셨어"
     - Result: "엄마가 요리하셨다" (NOT "나는 요리를 했다")
   • **CRITICAL: When question asks about someone's action, the answer should maintain the same subject:**
     - Q: "민수가 슈퍼에 갔어?" A: "응"
     - Result: "민수가 슈퍼에 갔다" (NOT "나는 슈퍼에 갔다")
   • **CRITICAL: When question asks about the user's action with "응"/"그래", extract the complete action including subject:**
     - Q: "철수한테 미안하다고 했어?" A: "응"
     - Result: "나는 철수에게 미안하다고 했다" (extract complete action from question)
     - Q: "선생님이 칭찬했어?" A: "그래"
     - Result: "선생님이 칭찬했다" (preserve original subject from question)
   • Merge with existing content in the target panel, ONLY using information from user content (new_QA)
     - If user mentioned place/time → add to panel1 (A)
     - If user mentioned behavior → add to panel2 (B)
     - If user mentioned consequence → add to panel3 (C)
     - If user mentioned emotion words → add to panel4 (D)
   • If user didn't provide specific information → leave panel as null

2. **CRITICAL: When merging with existing content, consider context and flow:**
   • **CONTEXT ANALYSIS: Understand the relationship between existing and new information:**
     - Time relationship: "~할 때", "~하는 동안", "~한 후에"
     - Cause-effect relationship: "~해서", "~하자", "~하니까"
     - Method relationship: "~로", "~해서", "~하면서"
     - Location relationship: "~에서", "~에 가서"
     - Person relationship: "~와 함께", "~에게", "~가"
     - **Addition**: "~고", "~며", "~하면서", "~도"
     - **Method**: "~로", "~해서", "~가지고"
   
   • **SMART MERGING STRATEGY: Replace incorrect info and maintain time order:**
     - **REPLACE INCORRECT INFO**: If existing content is wrong, replace it completely
       - Q: "어디서 놀았어?" A: "공원에서" → "놀이터에서 놀았다" → "공원에서 놀았다" (놀이터 → 공원으로 교체)
       - Q: "뭐로 그렸어?" A: "크레파스로" → "연필로 그림을 그렸다" → "크레파스로 그림을 그렸다" (연필 → 크레파스로 교체)
       - Q: "언제 했어?" A: "오후에" → "아침에 놀았다" → "오후에 놀았다" (아침 → 오후로 교체)
     
     - **MAINTAIN TIME ORDER**: Arrange information in chronological order within panel
       - Q: "그 전에 뭐했어?" A: "먼저 숙제를 했어" → "숙제를 하고 놀았다" (시간순서: 숙제 → 놀기)
       - Q: "그 다음에 뭐했어?" A: "그 다음에 밥 먹었어" → "놀고 밥을 먹었다" (시간순서: 놀기 → 밥먹기)
       - Q: "왜 울었어?" A: "내가 실수해서" → "내가 실수해서 소현이가 울었다" (원인 → 결과 순서)
     
     - **NATURAL FLOW COMBINATION**: Combine related information naturally
       - Q: "누구랑 했어?" A: "엄마와" → "엄마와 그림을 그렸다" (사람 + 행동)
       - Q: "어떻게 했어?" A: "크레파스로" → "크레파스로 그림을 그렸다" (도구 + 행동)
       - Q: "언제 했어?" A: "쉬는 시간에" → "쉬는 시간에 놀았다" (시간 + 행동)
   
   • **CONTEXT-AWARE EXAMPLES:**
     - **Replace incorrect location**: Q: "어디서 놀았어?" A: "공원에서" → "놀이터에서 놀았다" → "공원에서 놀았다"
     - **Replace incorrect method**: Q: "뭐로 그렸어?" A: "크레파스로" → "연필로 그림을 그렸다" → "크레파스로 그림을 그렸다"
     - **Maintain time order**: Q: "그 전에 뭐했어?" A: "먼저 숙제를 했어" → "숙제를 하고 놀았다"
     - **Natural cause-effect**: Q: "왜 울었어?" A: "내가 실수해서" → "내가 실수해서 소현이가 울었다"
     - **Combine related info**: Q: "누구랑 했어?" A: "엄마와" → "엄마와 그림을 그렸다"

**STEP 3: SENTENCE COMPLETION AND CLEANUP (THIRD PRIORITY)**
1. **Complete incomplete sentences and ensure proper format:**
   • **CRITICAL: Convert all panels to complete first-person past-tense Korean sentences**
   • If a panel contains incomplete phrases like "~에", "~에서", "~와 함께" → complete the sentence
   • Examples of completion:
     - "학교에서" → "학교였다"
     - "수업 중에" → "수업 중이었다"
2. **CRITICAL: Each panel must be a complete, natural Korean sentence**
3. **CRITICAL: Use past tense ("~했다", "~였다", etc.)**

**CRITICAL RULES - YOU MUST FOLLOW THESE EXACTLY:**
1. **When add new information, ONLY use content from "panels_original" + "new_QA"**. NEVER copy example text like "e.g. 'I was happy'" into panels
2. **NEVER invent new events, lines, or feelings**
3. **KEEP ALL content from "panels_original" - NEVER delete or remove existing content**
4. **Each panel must contain only content appropriate for its category**
5. **CRITICAL: When merging content, PRESERVE ALL existing information**
6. **CRITICAL: Only add new information, NEVER replace or remove existing content unless explicitly instructed by order array**
7. **CRITICAL: If order array says to move content, ONLY move the exact text mentioned, keep everything else**
5. **Keep each panel to one complete Korean past-tense sentence, first-person diary style**
6. **CRITICAL: When separating content, maintain natural Korean flow**
7. **CRITICAL: Complete all incomplete sentences to proper Korean past-tense format**
8. **CRITICAL: Preserve the actor/subject from the question in the answer:**
    - If question asks "선생님이 뭐라고 했어?" → Answer should be "선생님이 [내용]했다"
    - If question asks "엄마가 뭐하셨어?" → Answer should be "엄마가 [내용]하셨다"
    - If question asks "친구가 뭐했어?" → Answer should be "친구가 [내용]했다"
    - **NEVER change the actor from the question to "나는" unless the question specifically asks about the user's own action**
9. **CRITICAL: When question asks about someone's words/reaction, put it in panel3 (C) as consequence**
10. **CRITICAL: When question asks about someone's action, put it in panel2 (B) as behavior**
11. **CRITICAL: D panel (emotion) content should ONLY contain pure emotion words**
12. **CRITICAL: When combining sentences, use proper Korean grammar and natural flow**
13. **CRITICAL: For simple agreement answers ("응", "네", "그래"), extract the COMPLETE action from the question including the subject:**
    - Q: "놀이터에서 놀았어?" A: "응" → Extract "나는 놀이터에서 놀았다" from question
    - Q: "친구가 울었어?" A: "그래" → Extract "친구가 울었다" from question  
14. **CRITICAL: For choice questions, interpret the selected choice:**
    - Q: "쉬는 시간에 했어? 점심시간에 했어?" A: "1" → "쉬는 시간에 했다"
    - Q: "아침에 했어? 오후에 했어?" A: "2" → "오후에 했다"


Output exactly this JSON (nothing else, no line breaks inside values):

{{
  "panel1": "...",
  "panel2": "...",
  "panel3": "...",
  "panel4": "..."
}}

Write items in natural Korean during real use. (The examples below stay English for clarity only.)  

Here are the examples:
### Example 1
<panels_original>
"panel1": "민수와 나는 학교에서 고등어 해부 쇼를 했다.",  
"panel2": null,  
"panel3": "나는 머리를 자르고 배를 열어서 장기를 봉투에 넣었다.",  
"panel4": null
<new_QA>
question: "와! 고등어 해부 쇼라니 대박이다! 🐟 학교에서 언제 했어? 1) 쉬는 시간? 2) 점심시간?"
answer: "1"
<order>
[
  "B content in C: '나는 머리를 자르고 배를 열어서 장기를 봉투에 넣었다' should move to B, keep '' in C"
]
<expected_output>
{{
  "panel1": "민수와 나는 학교에서 쉬는 시간에 고등어 해부 쇼를 했다.",  
  "panel2": "나는 머리를 자르고 배를 열어서 장기를 봉투에 넣었다.",  
  "panel3": null,  
  "panel4": null
}}

### Example 2 - Simple Agreement Answer with Subject Extraction
<panels_original>
"panel1": "나는 어머니에게 놀이공원에 가고 싶다고 말했다.",  
"panel2": "어머니가 '그래, 가자'고 했다.",  
"panel3": "우리는 다음주 토요일에 가서 롤러코스터를 탈 것이다.",  
"panel4": "나는 떨렸다."
<new_QA>
question: "롤러코스터라니 나도 떨린다! 😅 그럼 어머니랑 그 이야기는 집에서 했어?"
answer: "응"
<order>
[
  "B content in A: '나는 어머니에게 놀이공원에 가고 싶다고 말했다' should move to B, keep '' in A",
  "C content in B: '어머니가 그래 가자고 했다' should move to C, keep '' in B"
]
<expected_output>
{{
  "panel1": "나는 집에서 어머니와 함께 있었다.",  
  "panel2": "나는 어머니에게 놀이공원에 가고 싶다고 말했다.",  
  "panel3": "어머니가 '그래, 가자'고 해서 우리는 다음주 토요일에 가서 롤러코스터를 탈 것이다.",  
  "panel4": "나는 떨렸다."
}}

### Example 2b - Subject Extraction from Question
<panels_original>
"panel1": "나는 학교에서 친구와 다퉜다.",  
"panel2": "나는 화가 나서 소리를 질렀다.",  
"panel3": null,  
"panel4": "나는 후회했다."
<new_QA>
question: "그래서 철수한테 미안하다고 했어?"
answer: "응"
<order>
[]
<expected_output>
{{
  "panel1": "나는 학교에서 친구와 다퉜다.",  
  "panel2": "나는 화가 나서 소리를 질렀다.",  
  "panel3": "나는 철수에게 미안하다고 했다.",  
  "panel4": "나는 후회했다."
}}

### Example 3 - Replace and Maintain Time Order
<panels_original>
"panel1": "나는 학교 복도에서 걸었다.",  
"panel2": "소현이가 갑자기 내 앞을 막고 울기 시작했다.",  
"panel3": null,  
"panel4": "나는 긴장되고 땀이 났다."
<new_QA>
question: "아이구.. 갑자기 나타나 울어서 당황스러웠겠다 😮 울기 전에 무슨 일이 있었어?"
answer: "내가 그냥 지나갔어."
<order>
[]
<expected_output>
{{
  "panel1": "나는 학교 복도에서 걸었다.",  
  "panel2": "내가 그냥 지나가자 소현이가 갑자기 내 앞을 막고 울기 시작했다.",  
  "panel3": null,  
  "panel4": "I felt nervous and sweaty."
}}

### Example 4 - Content Separation
<panels_original>
"panel1": "나는 친구들과 놀이터에서 숨바꼭질을 했다.",  
"panel2": "",  
"panel3": "나는 숨었지만 민수가 나를 찾고는 놀란 표정으로 나를 쳐다봤다.",  
"panel4": "나는 신났다."
<new_QA>
question: "어디서 숨었어?"
answer: "나무 뒤에"
<order>
[
  "B content in C: '나는 숨었다' should move to B, keep '하지만 민수가 나를 찾았다' in C"
]
<expected_output>
{{
  "panel1": "나는 친구들과 놀이터에서 숨바꼭질을 했다.",  
  "panel2": "나는 나무 뒤에 숨었다.",  
  "panel3": "하지만 민수가 나를 찾았다. 그리고 그는 놀란 표정으로 나를 쳐다봤다.",  
  "panel4": "나는 신났다."
}}

### Example 5 - D Content in C Separation
<panels_original>
"panel1": "나는 어머니와 피자를 만들었다.",  
"panel2": "나는 반죽을 치댔고 토핑을 올렸다.",  
"panel3": "어머니가 잘 만들었다고 칭찬해서 나는 기뻤고 신났다",  
"panel4": null
<new_QA>
question: "어머니가 칭찬했을 때 기분이 어땠어?"
answer: "나는 기뻤고 신났다"
<order>
[
  "D content in C: '나는 기뻤고 신났다' should move to D, keep '어머니가 잘 만들었다고 칭찬했다' in C"
]
<expected_output>
{{
  "panel1": "I made pizza with Mom.",  
  "panel2": "I kneaded the dough and put toppings on it.",  
  "panel3": "Mom praised me for making it well",  
  "panel4": "I felt happy and excited"
}}"""

        # comic_context가 있으면 그것을 사용, 없으면 revision_1 사용
        panels_original = journal.comic_context if journal.comic_context else journal.revision_1 or {}
        
        # order 배열만 추출
        order_instructions = self.story_analysis.get("order", [])
        
        user_prompt = f"""<panels_original>
"panel1": "{panels_original.get('panel1', 'null')}",
"panel2": "{panels_original.get('panel2', 'null')}",
"panel3": "{panels_original.get('panel3', 'null')}",
"panel4": "{panels_original.get('panel4', 'null')}"
<new_QA>
question: "{question}"
answer: "{answer}"
<order>
{json.dumps(order_instructions, indent=2, ensure_ascii=False)}

"""

        # Retry logic for structured output
        max_retries = 3
        for attempt in range(max_retries):
            try:
                messages = [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_prompt)
                ]
                
                response = await self.llm.ainvoke(messages)
                result = self.reconstruction_parser.parse(response.content)
                
                # Convert to dict format for compatibility
                reconstructed_panels = {
                    "panel1": result.panel1,
                    "panel2": result.panel2,
                    "panel3": result.panel3,
                    "panel4": result.panel4
                }
                
                # 메모리에 최신 패널 상태 저장
                self.current_panels = reconstructed_panels
                
                # Journal에 재구성된 데이터 저장
                await update_journal_data(
                    self.db, self.journal_entry_id,
                    comic_context=reconstructed_panels
                )
                
                # Order 처리 후 order 배열 완전히 비우기 (이미 처리된 order는 다시 나오지 않도록)
                if order_instructions:
                    self.story_analysis["order"] = []
                    # story_analysis를 다시 분석하여 order가 제거된 상태로 업데이트
                    self.story_analysis = await self._analyze_story_flow()
                
                print(f"Panel Reconstruction Result: {json.dumps(reconstructed_panels, ensure_ascii=False, indent=2)}")
                return
                
            except Exception as e:
                print(f"Attempt {attempt + 1} failed: {e}")
                if attempt == max_retries - 1:
                    print("All retries failed for panel reconstruction")
                    return
                await asyncio.sleep(1)  # Brief delay before retry
    
    async def _get_next_question(self) -> tuple[str, MessageIntent, str]:
        """다음 질문 생성 - focus panel 정보도 함께 반환"""
        try:
            if not self.story_analysis:
                return "I turned what you told me into a four-panel comic! But I couldn't draw everything with the information I had. Could you help me fill in the missing parts? When you’re ready, press the 'Next' button!", MessageIntent.PromptNext, None
            
            # Content와 Order issue 확인
            has_content_issues, has_order_issues = self._check_issues(self.story_analysis)
            has_real_issues = has_content_issues or has_order_issues
            
            if not has_real_issues:
                # comic_context 완료 시 다음 단계로 넘어감
                update_journal_entry_stage(self.db, self.journal_entry_id, JournalEntryStage.Revision2)
                return "완성! 이제 수정하거나 추가하고 싶은 부분 있어? 🤔", MessageIntent.PromptIssueExist, None
            
            # Order issue만 있고 content issue가 없는 경우
            if has_order_issues and not has_content_issues:
                print(f"[DEBUG] comic_context: Only order issues detected, continuing with reconstruction")
                
                # 최대 2번까지 자동 재구성 시도
                for reconstruction_attempt in range(2):
                    print(f"[DEBUG] comic_context: Auto reconstruction attempt {reconstruction_attempt + 1}")
                    await self._reconstruct_panel("", f"자동 재구성 {reconstruction_attempt + 1}차", False)
                    self.story_analysis = await self._analyze_story_flow()
                    print(f"[DEBUG] comic_context: story_analysis after auto reconstruction {reconstruction_attempt + 1}: {self.story_analysis}")
                    
                    # 여전히 order issue만 있는지 확인
                    content_has_issues_after, has_order_issues_after = self._check_issues(self.story_analysis)
                    
                    # Content issue가 생겼거나 order issue가 해결된 경우 루프 종료
                    if not has_order_issues_after or content_has_issues_after:
                        break
                
                # 2번 시도 후에도 order issue만 있으면 강제 완료
                if has_order_issues_after and not content_has_issues_after:
                    print(f"[DEBUG] comic_context: Still only order issues after 2 attempts, forcing completion")
                    # 만화 생성 시작 신호 반환 (실제 만화 생성은 controller에서 처리)
                    child_name = await self._get_child_name()
                    child_name_with_josa = append_josa(child_name, '이', '')
                    dyad = await self._get_dyad()
                    response_message = t('Journaling.Messages.ComicContextComplete', dyad.locale).format(
                        child_name=child_name_with_josa
                    )
                    response_intent = MessageIntent.StartComicGeneration
                    return response_message, response_intent, None
                # Content issue가 생겼거나 order issue가 해결된 경우 다음 질문 생성
                # (아래 로직으로 계속 진행)
            
            # Focus panel 결정 - 모든 패널을 확인하여 실제로 누락된 정보가 있는 패널 찾기
            panels = ["A", "B", "C", "D"]
            panel_mapping = {"A": "panel1", "B": "panel2", "C": "panel3", "D": "panel4"}
            focused_panel = None
            
            content_issues = self.story_analysis.get("content", {})
            
            # DB에서 journal 정보 가져오기
            journal = await get_journal(self.db, self.journal_entry_id)
            panels_content = journal.comic_context if journal and journal.comic_context else journal.revision_1 if journal and journal.revision_1 else {}
            
            # 각 패널의 실제 내용과 이슈를 비교하여 진짜 누락된 정보만 찾기
            for panel in panels:
                panel_issues = content_issues.get(panel, [])
                panel_content = panels_content.get(panel_mapping[panel], "")
                
                # 실제로 누락된 정보가 있는지 확인
                if panel_issues and any(issue for issue in panel_issues if issue and issue != ''):
                    # 다른 패널에 해당 정보가 이미 있는지 확인
                    info_already_exists = False
                    for other_panel in panels:
                        if other_panel != panel:
                            other_content = panels_content.get(panel_mapping[other_panel], "")
                            # 간단한 키워드 매칭으로 중복 확인
                            if panel_content and other_content and any(keyword in other_content for keyword in panel_content.split()):
                                info_already_exists = True
                                break
                    
                    if not info_already_exists:
                        focused_panel = panel_mapping[panel]
                        break
            
            # DB에서 ComicContext stage의 모든 메시지를 conversation_history로 가져오기
            messages = await get_messages_by_journal_entry_and_stage(self.db, self.journal_entry_id, JournalEntryStage.ComicContext)
            conversation_history = ""
            if messages:
                conversation_history = "\n".join([
                    f"{'Q' if msg.role == MessageRole.Assistant else 'A'}: {msg.content}"
                    for msg in messages
                ])
            
            # 연속된 "모르겠어" 답변 확인
            dont_know_keywords = ["모르겠어", "기억 안 나", "잘 모르겠어", "모르겠다", "기억이 안 나", "잘 모르겠다", "몰라", "모르겠다고"]
            recent_answers = [msg for msg in messages if msg.role == MessageRole.User][-3:][::-1]  # 최근 3개 답변
            consecutive_dont_know_count = sum(
                1 for msg in recent_answers
                if any(keyword in msg.content.lower() for keyword in dont_know_keywords)
            )
            
            client = openai.OpenAI()
            
            character_bg = self.get_character_background()
            system_prompt = f"""{character_bg}

**CRITICAL: You MUST follow the character background above in EVERY response!**

Your task: generate ONE follow-up question that fills the FIRST missing information gap listed in the analysis. The question MUST start with a friendly, enthusiastic reaction to the user's previous answer before asking the follow-up question.

ABCD STRUCTURE:
- A (panel1): Antecedent - where, who, situation (time optional)
- B (panel2): Behavior - observable action, how/how long/with what
- C (panel3): Consequence - immediate result or existing character's response (avoid new characters)
- D (panel4): Emotion - writer's own feeling only (emotion word)

=== Question-Generation Rules ===
1. **ALWAYS start with a friendly, sympathetic reaction to the user's previous answer:**
   - Show genuine interest and excitement about what they shared but no interjection.
   - Use appropriate emojis to match the mood
   - Reference specific details from their answer
2. **FIRST: Check situation_type from analysis_result:**
   - If "problematic": Focus on situational overview questions (context, timing, environment)
   - If "normal": Focus on "HOW" questions (methods, details)
3. **CRITICAL: Focus on the FIRST missing information in order: A → B → C → D**
   - **MANDATORY: Check story_analysis.content array and focus ONLY on the FIRST panel with missing information**
   - **MANDATORY: If A has missing info (non-empty array), ask about A ONLY. If A is complete (empty array) but B has missing info, ask about B ONLY.**
   - **CRITICAL: Before asking any question, verify that the information is NOT already present in ANY panel**
   - **CRITICAL: Cross-reference all panels to avoid asking about information that already exists**
      - **CRITICAL: Use the specific examples from story_analysis to create targeted questions**
   - **CRITICAL: NEVER ask generic questions like "그 다음에는 뭐했어?" or "뭐가 일어났어?"**
   - **CRITICAL: ALWAYS extract specific details from the analysis example and create precise questions**
   - **CRITICAL: Extract the specific action, result, or emotion from the example and create a choice-based question**
   - **CRITICAL: Make questions specific and actionable based on the analysis examples**
4. Ask exactly ONE question that can elicit the missing detail.
5. **CRITICAL: When asking about C (Consequence), focus on NEXT actions, not HOW:**
   - If B already describes the result, ask "What did you do next?" or "What happened after that?"
   - Examples: "자전거를 계속 탔어? 아니면 멈춰서 짱구한테 고맙다고 했어?"
   - Do NOT ask "어떻게 했어?" when the result is already clear
   - **CRITICAL: NEVER ask generic questions like "그 다음에는 뭐했어?" or "뭐가 일어났어?"**
   - **CRITICAL: ALWAYS extract specific details from the analysis example and create precise questions**
   - **CRITICAL: Extract the specific action, result, or emotion from the example and create a choice-based question**
6. **CRITICAL: Use proper character references - NEVER use "we" to refer to characters:**
   - **NEVER say "we" when referring to characters in the story**
   - **ALWAYS use specific character names**
   - **Examples:**
     - "민수랑 같이 놀았어?" (NOT "we played together")
     - "엄마랑 어디서 했어?" (NOT "where did we do it")
     - "선생님이랑 대화했어?" (NOT "did we talk to the teacher")
7. **CHOICE RULE: Only provide 2-3 choices when the question naturally limits to exactly 2-3 options:**
   - Examples that SHOULD have choices: "학교 안이었어? 밖이었어?" (2 choices), "오전이었어? 오후였어?" (2 choices)
   - Examples that should NOT have choices: "어디에 있었어?" (many possible places), "뭘 했어?" (many possible activities), "누가 있었어?" (many possible people)
   - Use open-ended questions when there are more than 3 natural options
6. Avoid figurative language; keep sentences ≤ 15 syllables.
7. If the child likes topics in "affinity", you may embed them lightly to grab attention.
8. Avoid vague words like "그런 것", "이런 식으로", "그 때".
9. Do NOT repeat questions already asked.
10. Consider the entire conversation history and current panels when generating questions.
11. **CRITICAL: Cross-panel information check**
    - Before asking any question, check ALL panels (A, B, C, D) for the information
    - DO NOT ask about information that is:
      - Already stated in ANY panel (even if it's in a different panel than expected)
      - Already confirmed in previous Q&A
      - Can be inferred from existing information
    - If information exists in any panel, skip that question and move to the next missing information
12. When asking about emotions (panel 4), ask for explicit emotion words:
    - 그 때 "기분이 어땠어?" (단순히 감정을 물어보기만 하고, 선택지는 프론트엔드에서 제공)
    - **CRITICAL: Only ask emotion questions when panel 4 is missing or null**
    - **CRITICAL: Keep emotion questions simple - just ask "기분이 어땠어?" without providing options**
13. **PROBLEMATIC situations - CRITICAL RULES:**
    - NEVER ask direct "why" questions initially
    - ALWAYS start with situational overview questions
    - Ask about context: "그 때 뭘 하고 있었어?"
    - Ask about environment: "주변에 누가 있었어?", "어떤 상황이었어?"
    - Only after gathering context, then ask about causes
14. **NORMAL situations:**
    - Use "어떻게", "뭐로", "언제" (how-focused)
    - Example: "어떻게 놀았어?", "뭐로 그림을 그렸어?"
15. **CRITICAL: Check ALL panels before asking questions**
    - Before generating any question, check if the information already exists in ANY panel
    - Do NOT ask about information that is already present in any panel
    - Cross-reference all panels to avoid duplicate questions

=== CRITICAL: Imagination Rule ===
16. **ONLY if EXACTLY 3+ consecutive "don't know" answers for the current category:**
    - **MUST** change approach to encourage imagination
    - Start with "그럼 상상해볼까?" or "아마도..." with emojis
    - Make it fun and creative rather than factual
    - Use phrases like "아마도", "상상해보면", "그랬을 것 같아"
    - Focus on what would be most likely or interesting
    - **ALWAYS** provide 2-3 imaginative choices
    - Example: "그럼 상상해보자! 😊 아마도 어떻게 됐을까? 1) ... 2) ... 3) ..."

17. **If LESS than 3 consecutive "don't know" answers:**
    - Continue with normal situational overview questions
    - Do NOT use imagination prompts
    - Focus on gathering more context and details

=== Output Format (JSON only) ===
{{
  "question": "question in Korean",
  "focused_panel": "panel1" or "panel2" or "panel3" or "panel4" or null
}}

- Write items in natural Korean during real use. (The examples below stay English for clarity only.)  
Here are the examples:
### Example 1
Input:
"panel1": "민수와 나는 학교에서 고등어 해부 쇼를 했다.",  
"panel2": null,  
"panel3": "나는 머리를 자르고 배를 열어서 장기를 봉투에 넣었다.",  
"panel4": null

analysis_result:
{{
  "situation_type": "normal",
  "content": {{
    "A": ["배경 상황 누락 — e.g. '쉬는 시간에'"],
    "B": ["B content in C: '나는 머리를 자르고 배를 열어서 장기를 봉투에 넣었다' should move to B"],
    "C": [
      "Non-C content in C (behavior described)",
      "결과 누락 — e.g. '민수가 웃으면서 대박이라고 했다'"
    ],
    "D": ["감정 누락 — e.g. '나는 기뻤다'"]
  }}
}}

conversation_summary:

Output:
{{
"question": "고등어 해부라니 너무 신기하다! 🐟 그런데 학교에서 언제 했던 거야? 쉬는 시간에? 점심시간에? 아니면 다른 시간에?",
"focused_panel": "panel1"
}}

### Example 1b - Emotion Question
Input:
"panel1": "민수와 나는 학교에서 쉬는 시간에 고등어 해부 쇼를 했다.",  
"panel2": "나는 머리를 자르고 배를 열어서 장기를 봉투에 넣었다.",  
"panel3": "민수가 웃으면서 '대박!'이라고 했다.",  
"panel4": null

analysis_result:
{{
  "situation_type": "normal",
  "content": {{
    "A": [""],
    "B": [""],
    "C": [""],
    "D": ["감정 누락 — e.g. '나는 기뻤다'"]
  }}
}}

conversation_summary:
Q: "고등어 해부라니 너무 신기하다! 🐟 그런데 학교에서 언제 했던 거야? 쉬는 시간에? 점심시간에? 아니면 다른 시간에?"
A: "쉬는 시간에"

Output:
{{
"question": "고등어 해부 쇼를 하고 민수가 대박이라고 했구나! 😊 그럼 그 때 기분이 어땠어?",
"focused_panel": "panel4"
}}

### Example 1c - Specific Consequence Question
Input:
"panel1": "나는 친구랑 선생님들이랑 블루베리 농장에 갔다 왔다.",
"panel2": "나는 블루베리 농장에서 피자를 만들었다.",
"panel3": null,
"panel4": null

analysis_result:
{{
  "situation_type": "normal",
  "content": {{
    "A": [""],
    "B": [""],
    "C": ["결과 누락 — e.g. '피자를 다 만들고 모두가 맛있게 먹었다'"],
    "D": ["감정 누락 — e.g. '나는 즐거웠다'"]
  }}
}}

Output:
{{
"question": "피자를 만들고는 다 같이 맛있게 먹었어? 아니면 다른 걸 했어?",
"focused_panel": "panel3"
}}

### Example 2
Input:
"panel1": "나는 어머니에게 놀이공원에 가고 싶다고 말했다.",  
"panel2": "어머니가 '그래, 가자'고 했다.",  
"panel3": "우리는 다음주 토요일에 가서 롤러코스터를 탈 것이다.",  
"panel4": "나는 떨렸다."

analysis_result:
{{
  "situation_type": "normal",
  "content": {{
    "A": [
      "장소 누락 — e.g. '집에서'",
      "Non-A content in A (telling Mom is a behavior, which is B)"
    ],
    "B": [
      "Non-B content in B (Mom's reaction belongs to C)",
      "B missing — actual behavior is in panel 1"
    ],
    "C": [""],                    
    "D": [""]
  }},
  "order": ["Behavior in panel 1 should move to panel 2",
    "Reaction in panel 2 should move to panel 3"]
}}

conversation_summary:
Q: "놀이공원 너무 재미있겠다~! 가자고 하니 어머니께서는 뭐라고 말씀하셨어?"
A: "가자고 해서 우리 다음주 토요일에 가가지고 롤러코스터 탈거야."
Q: "롤러코스터 타게 되어서 너무 좋겠다!! 기분이 어때?"
A: "완전 떨려"

Output:
{{
"question": "네가 떨린다니 나도 떨린다! 😅 롤러코스터라니 정말 대박이겠어! 그럼 어머니랑 그 이야기는 어디서 했어?",
"focused_panel": "panel1"
}}

### Example 3
Input:
"panel1": "나는 학교 복도에서 걸었다.",  
"panel2": "소현이가 갑자기 내 앞을 막고 울기 시작했다.",  
"panel3": null,  
"panel4": "나는 긴장되고 땀이 났다."

analysis_result:
{{
"situation_type": "problematic",
"content": {{
"A": [""],
"B": [
    "울게 된 이유 누락 — e.g. '내가 실수로 부딪혔기 때문'"
  ],
  "C": [
    "C 누락 — e.g. '소현이가 계속 울면서 움직이지 않았다'"
  ],
  "D": [""]
}},
"order": [""]
}}

conversation_summary:
Q: "갑자기 나타났다니 당황스러웠겠다 😮 소현이는 갑자기 왜 운거야? 그 때 상황 기억나면 말해줘."
A: "모르겠어"
Q: "소현이가 울면서 뭔가 말했어? 🤨"
A: "몰라"
Q: "소현이 주위에 다른 사람이 있었어? 👫"
A: "모른다고"

Output:
{{
"question": "아이구.. 진짜 기억이 안 나는구나 😅 그럼 상상해보자! 소현이는 왜 운걸까? 1) 갑자기 다른 친구가 괴롭혔을까? 2) 선생님께 혼났을까? 3) 슬픈 일이 생각났을까?",
"focused_panel": "panel2"
}}"""
            
            
            # Get current panel contents
            journal = await get_journal(self.db, self.journal_entry_id)
            # comic_context가 있으면 그것을 사용, 없으면 revision_1 사용
            panels_content = journal.comic_context if journal and journal.comic_context else journal.revision_1 if journal and journal.revision_1 else {}
            
            user_prompt = f"""Current comic panels:
"panel1": "{panels_content.get('panel1', 'null')}",
"panel2": "{panels_content.get('panel2', 'null')}",
"panel3": "{panels_content.get('panel3', 'null')}",
"panel4": "{panels_content.get('panel4', 'null')}"

analysis_result:
{{
  "situation_type": "{self.story_analysis.get('situation_type', 'normal')}",
  "content": {json.dumps(self.story_analysis.get("content", {}), indent=2, ensure_ascii=False)}
}}

conversation_history:
{conversation_history}

consecutive_dont_know_count: {consecutive_dont_know_count}

Please generate a question that addresses the FIRST missing information gap."""

            try:
                # Retry logic for robust parsing
                for attempt in range(3):
                    try:
                        messages = [
                            SystemMessage(content=system_prompt),
                            HumanMessage(content=user_prompt)
                        ]
                        response = await self.llm.ainvoke(messages)
                        result = self.next_question_parser.parse(response.content)
                        question = result.question
                        focused_panel_from_ai = result.focused_panel or focused_panel
                        break
                    except Exception as e:
                        print(f"Attempt {attempt + 1} failed: {e}")
                        if attempt == 2:  # Last attempt
                            print("All attempts failed, returning default question")
                            question = "다음에 대해 말해줘!"
                            focused_panel_from_ai = focused_panel
                        else:
                            await asyncio.sleep(1)  # Wait before retry
                
                # 기분을 물어보는 질문인지 확인
                if "기분이 어땠어" in question or "기분이었어" in question or "How did you feel" in question:
                    return question, MessageIntent.PromptEmotion, focused_panel_from_ai
                else:
                    return question, None, focused_panel_from_ai
                
            except Exception as e:
                print(f"[DEBUG] comic_context: Error generating question: {e}")
                return "다음에 대해 말해줘!", None, focused_panel
            
        except Exception as e:
            print(f"[DEBUG] comic_context: Error in _get_next_question: {e}")
            return "다음에 대해 말해줘!", None, None
    
    async def _generate_first_question(self) -> tuple[str, MessageIntent, str]:
        """첫 번째 질문 생성"""
        try:
            return await self._get_next_question()
        except Exception as e:
            print(f"[DEBUG] comic_context: Error in _generate_first_question: {e}")
            return "다음에 대해 말해줘!", None, None
    
    async def _get_or_create_interaction_turn(self, stage: JournalEntryStage) -> Any:
        """현재 단계의 interaction turn 가져오기 또는 생성"""
        from backend.database.crud.chatbot import get_latest_interaction_turn
        
        latest_turn = await get_latest_interaction_turn(self.db, self.journal_entry_id)
        if latest_turn and latest_turn.stage == stage:
            return latest_turn
        else:
            from backend.database.crud.chatbot import create_interaction_turn
            return await create_interaction_turn(self.db, self.journal_entry_id, stage)
    
    def is_complete(self) -> bool:
        """분석이 완료되었는지 확인"""
        if not self.story_analysis:
            print(f"[DEBUG] comic_context: is_complete - no story_analysis")
            return False
        
        # Content와 Order issue 확인
        has_content_issues, has_order_issues = self._check_issues(self.story_analysis)
        has_real_issues = has_content_issues or has_order_issues
        is_complete = not has_real_issues
        
        return is_complete
    
    async def _generate_final_comic_panels(self) -> dict | None:
        """comic_context 완료 시 최종 만화 패널 생성 및 Comic 테이블에 저장"""
        try:
            # comic_context 데이터 가져오기
            journal = await get_journal(self.db, self.journal_entry_id)
            if not journal or not journal.comic_context:
                return
            
            # 패널 내용 추출 (ComicPanelInfo 형식에서 content 필드만 추출)
            # 하드코딩된 패널 내용으로 설정
            # panel_contents = {
            #     "panel1": "I played with Oliver at school today with an eraser.",
            #     "panel2": "I threw his eraser without asking.",
            #     "panel3": "Oliver got angry and told the teacher.",
            #     "panel4": "I was sad and scared"
            # } #- English
            

            panel_contents = {
                "panel1": "나는 오늘 충호랑 학교에서 지우개를 가지고 놀았다.",
                "panel2": "나는 충호한테 물어보지도 않고 충호 지우개를 썼다.",
                "panel3": "충호가 화를 내고 선생님께 말씀드렸다.",
                "panel4": "나는 슬프고 무서웠다."
            } #- Korean 
            # 원래 로직 (주석 처리)
            # panel_contents = {}
            # for panel_key in ['panel1', 'panel2', 'panel3', 'panel4']:
            #     panel_data = journal.comic_context.get(panel_key, {})
            #     if isinstance(panel_data, dict) and 'content' in panel_data:
            #         panel_contents[panel_key] = panel_data['content']
            #     else:
            #         panel_contents[panel_key] = ""
            
            print(f"[DEBUG] comic_context panel_contents after conversion: {panel_contents}")
            
            # 직접 ComicGridGenerator 호출
            try:
                from backend.core.ai import ComicGridGenerator
                
                # 진행률 콜백 함수 정의
                async def progress_callback(progress: int, message: str):
                    """만화 생성 진행률에 따라 상태 업데이트"""
                    status = ComicStatus.Generating0
                    if progress <= 20:
                        status = ComicStatus.Generating1
                    elif progress <= 60:
                        status = ComicStatus.Generating2
                    elif progress <= 75:
                        status = ComicStatus.Generating3
                    elif progress <= 90:
                        status = ComicStatus.Generating4

                    await update_comic_status(self.db, self.journal_entry_id, status, None)
                    print(f"[DEBUG] Progress: {progress}% - {message}")
                
                # 초기 상태 설정
                await update_comic_status(self.db, self.journal_entry_id, ComicStatus.Generating0, None)
                
                # 만화 생성 시작
                generator = ComicGridGenerator()
                comic_data = await generator.generate_comic_grids(panel_contents, progress_callback)

                # 데이터베이스에 저장
                await update_comic_data(self.db, self.journal_entry_id, comic_data)
                
                #Auto comic generation에서 하던대로 새 메시지 업데이트

                # revision_2로 전환
                revision2_stage = await Revision2Stage.create(self.db, self.journal_entry_id)
                revision2_response, intent = await revision2_stage.start_revision()
                
                response = {
                    "response": revision2_response,
                    "intent": intent,
                    "stage": "revision_2"
                }
                
                # 완료 상태 설정
                await update_comic_status(self.db, self.journal_entry_id, ComicStatus.Completed, comic_data, response)
                
                
                print(f"[DEBUG] comic_context: Status updated to completed for {self.journal_entry_id}")
                
                return comic_data
                
            except Exception as e:
                print(f"[DEBUG] comic_context: Error in comic generation: {e}")
                await update_comic_status(self.db, self.journal_entry_id, ComicStatus.Error, None)
                import traceback
                traceback.print_exc()
            
        except Exception as e:
            print(f"[DEBUG] comic_context: Error generating final comic panels: {e}")
            import traceback
            traceback.print_exc() 

 