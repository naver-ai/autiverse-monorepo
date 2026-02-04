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


class TitleResultEng(BaseModel):
    """Title generation result (English)"""
    title1: str = Field(description="First title option for the comic")
    title2: str = Field(description="Second title option for the comic")
    title3: str = Field(description="Third title option for the comic")


class TitleGeneratorEng:
    """Generates and processes title options in English for the picture diary."""

    def __init__(self):
        self.client = openai.OpenAI()
        self.llm = ChatOpenAI(
            model="gpt-4.1-mini-2025-04-14",
            temperature=0.1,
            api_key=get_env_variable(EnvironmentVariables.OPENAI_API_KEY)
        )
        self.title_parser = PydanticOutputParser(pydantic_object=TitleResultEng)

    async def generate_title(self, journal_data: Dict[str, Any], child_name: str) -> Dict[str, str]:
        """Generate three English title options based on comic content."""
        try:
            if not journal_data:
                return {
                    "title1": f"{child_name}'s Journal",
                    "title2": f"{child_name}'s Day",
                    "title3": f"{child_name}'s Story"
                }

            system_prompt = """You are an expert at generating titles for children's picture diaries.

IMPORTANT: You must return a JSON object with "title1", "title2", and "title3" fields containing three different title options in English.

Title Generation Rules:
1. Generate exactly 3 different title options in English
2. Simple and fun titles that children can easily understand
3. Keep each title concise (roughly 5–8 words)
4. Emojis can be used (1–2 per title)
5. Include other figures' names in the title when relevant; when the only figure is the child, do not include the child's name in the title
6. Reflect the core content of the comic
7. Focus on emotions or actions
8. Make each title unique and appealing
9. Do not use punctuation at the end of titles

OUTPUT FORMAT:
Return a JSON object with "title1", "title2", and "title3" fields containing three different title options in English.

Examples:
- {"title1": "Playing Games with Oliver at School 🏫", "title2": "Fun Day with Oliver 😊", "title3": "A Great Time with Oliverat School 🎮"}
- {"title1": "Walking with My Dog 🐕", "title2": "At the Park with My Dog 🌳", "title3": "Dog Walk 🦮"}
- {"title1": "Playing Hide and Seek with James 😊", "title2": "Exciting Hide and Seek with James 🎯", "title3": "Hide and Seek Was So Fun with James 😄"}
- {"title1": "Watching Inside Out Again 😊", "title2": "Feeling Blue 💙", "title3": "Inside Out Movie Night 😄"}

Generate three structured title options in JSON format."""

            user_prompt = f"""The following is the content of {child_name}'s picture diary:

{journal_data}

Based on the above content, please generate three English title options that {child_name} would like."""

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
                    print(f"Attempt {attempt + 1} failed (title gen Eng): {e}")
                    if attempt == max_retries - 1:
                        print("All retries failed for title generation (Eng)")
                        return {
                            "title1": f"{child_name}'s Journal",
                            "title2": f"{child_name}'s Day",
                            "title3": f"{child_name}'s Story"
                        }
                    await asyncio.sleep(1)

        except Exception as e:
            print(f"Error generating title (Eng): {e}")
            return {
                "title1": f"{child_name}'s Journal",
                "title2": f"{child_name}'s Day",
                "title3": f"{child_name}'s Story"
            }

    def process_title_feedback(self, user_feedback: str, current_title: str, child_name: str) -> tuple[str, MessageIntent | None]:
        """Generate response based on user feedback (English)."""
        # User chose 1, 2, or 3 (title selected)
        if user_feedback in ["1", "2", "3"]:
            return f"I'm glad you liked the title, \"{current_title}\"! Once you review the completed journal on the left, let's wrap up!", MessageIntent.PromptNext

        # "All are bad" / want different titles
        if user_feedback in ["All are bad", "ChatInput.ButtonLabels.NotGoodAtAll"]:
            return "Then what title would you like?", MessageIntent.PromptOpenEndedAnswer

        return "Then what title would you like?", MessageIntent.PromptOpenEndedAnswer

    def confirm_custom_title(self, custom_title: str, child_name: str) -> tuple[str, MessageIntent | None, dict | None]:
        """Confirm the user's custom title (English)."""
        return f"Should we make \"{custom_title}\" as the title?", MessageIntent.CustomTitleConfirm, {"title": custom_title}

    def process_custom_title_feedback(self, user_feedback: str, custom_title: str, child_name: str, reject_count: int = 0) -> tuple[str, MessageIntent | None]:
        """Process feedback for the suggested custom title (English)."""
        if user_feedback in ["Yes, good!"]:
            return "That title is great! Once you review the completed journal on the left, let's wrap up!", MessageIntent.PromptNext

        if reject_count >= 2:
            return "Sorry, I didn't catch that. Please type the exact title you want in the chat! 😢", MessageIntent.PromptTextInput

        return "Then what title would you like?", MessageIntent.PromptOpenEndedAnswer
