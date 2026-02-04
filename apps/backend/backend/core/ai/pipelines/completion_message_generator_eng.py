from typing import Dict, Any
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain.output_parsers import PydanticOutputParser
from langchain.schema import HumanMessage, SystemMessage
from backend.utils.environment import get_env_variable, EnvironmentVariables
import openai
import asyncio


class CompletionMessageEng(BaseModel):
    """Completion message result (English)"""
    message: str = Field(description="Personalized completion message for the child in English")


class CompletionMessageGeneratorEng:
    """Generates completion messages in English for the comic strip."""

    def __init__(self):
        self.client = openai.OpenAI()
        self.llm = ChatOpenAI(
            model="gpt-4.1-mini-2025-04-14",
            temperature=0.7,
            api_key=get_env_variable(EnvironmentVariables.OPENAI_API_KEY)
        )
        self.message_parser = PydanticOutputParser(pydantic_object=CompletionMessageEng)

    async def generate_completion_message(self, comic_data: Dict[str, Any], child_name: str) -> str:
        """Generate a personalized completion message in English based on the completed journal."""
        try:
            # Extract panel content
            panels_content = []
            for i in range(1, 5):
                panel_key = f"panel{i}"
                if panel_key in comic_data:
                    panel = comic_data[panel_key]
                    if isinstance(panel, dict):
                        content = panel.get("content", "")
                    else:
                        content = str(panel)
                    panels_content.append(f"Panel {i}: {content}")

            panels_text = "\n".join(panels_content)

            # System prompt for English completion message
            system_prompt = f"""You are an expert at generating personalized completion messages for children's journal.

IMPORTANT: You must return a JSON object with a "message" field containing the completion message.

Completion Message Rules:
1. Create warm, encouraging, and personalized messages based on the comic content
2. Include the child's name naturally in the message
3. Reference specific events or emotions from the comic panels
4. Express genuine interest and appreciation for the child's sharing
5. Keep the tone friendly and supportive, like a friend talking to the child
6. Make it feel like a real conversation between friends
7. Length should be 2-3 sentences
8. Use English only. Do not use formal titles; speak as a peer/friend to the child.

OUTPUT FORMAT:
Return a JSON object with a "message" field containing the completion message in English.

Examples:
- {{"message": "Wow, {child_name}! It looks like you and your friends had so much fun playing games at school! Seeing you smile in the comic made me happy too. Thanks for sharing what happened today!"}}
- {{"message": "What a cool comic strip! {child_name}, you look so happy walking with the dog. I'm glad I got to learn about the things you like!"}}

Generate a structured completion message in JSON format."""

            user_prompt = f"""The following is the content of {child_name}'s completed comic strip:

{panels_text}

Based on the above comic content, please generate a personalized completion message in English for {child_name}."""

            # Retry logic for structured output
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    messages = [
                        SystemMessage(content=system_prompt),
                        HumanMessage(content=user_prompt)
                    ]

                    response = await self.llm.ainvoke(messages)
                    result = self.message_parser.parse(response.content)

                    completion_message = result.message.strip()

                    # Fallback if result is empty or too short
                    if not completion_message or len(completion_message) < 20:
                        completion_message = f"Wow, what an awesome comic strip, {child_name}! I had so many questions because I was curious, and thanks for answering them. I'm really glad I got to hear about your day!"

                    # Append call-to-action for title step
                    completion_message = completion_message + " Now let's press the 'Next' button and go choose a title for the journal!"

                    return completion_message

                except Exception as e:
                    print(f"Attempt {attempt + 1} failed: {e}")
                    if attempt == max_retries - 1:
                        print("All retries failed for completion message generation (Eng)")
                        default_message = f"Wow, what an awesome comic strip, {child_name}! I had so many questions because I was curious, and thanks for answering them. I'm really glad I got to hear about your day!"
                        return default_message + " Now let's press the 'Next' button and go choose a title for the journal!"
                    await asyncio.sleep(1)  # Brief delay before retry

        except Exception as e:
            print(f"Error generating completion message (Eng): {e}")
            default_message = f"Wow, what an awesome comic strip, {child_name}! I had so many questions because I was curious, and thanks for answering them. I'm really glad I got to hear about your day!"
            return default_message + " Now let's press the 'Next' button and go choose a title for the journal!"
