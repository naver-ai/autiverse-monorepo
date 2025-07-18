from typing import Dict, Any
import openai

class CompletionMessageGenerator:
    def __init__(self):
        self.client = openai.OpenAI()
    
    def _get_vocative_particle(self, name: str) -> str:
        """한국어 종성에 따른 호격 조사 처리 함수"""
        if not name or len(name) == 0:
            return ''
        
        last_char = name[-1]
        code = ord(last_char)
        
        # 한글 범위 체크 (가-힣: 44032-55203)
        if code < 44032 or code > 55203:
            return ''
        
        # 종성 계산: (유니코드 - 44032) % 28
        unicode_val = code - 44032
        jong = unicode_val % 28
        
        # 종성이 있으면 '이', 없으면 ''
        return '이' if jong != 0 else ''
    
    def _fix_korean_particles(self, text: str, child_name: str) -> str:
        """생성된 메시지에서 한국어 조사를 올바르게 처리"""
        # GPT가 생성한 메시지에서 조사가 잘못된 경우를 수정
        # 예: "민수이" -> "민수이", "지우이" -> "지우"
        
        # 올바른 조사 계산
        correct_particle = self._get_vocative_particle(child_name)
        
        # 잘못된 조사 패턴들을 수정
        import re
        
        # "이야" 패턴 수정
        text = re.sub(f'{child_name}이야', f'{child_name}{correct_particle}야', text)
        
        # "이랑" 패턴 수정 (받침이 없으면 "랑", 있으면 "이랑")
        if correct_particle == '이':
            text = re.sub(f'{child_name}랑', f'{child_name}이랑', text)
        else:
            text = re.sub(f'{child_name}이랑', f'{child_name}랑', text)
        
        # "이의" 패턴 수정 (받침이 없으면 "의", 있으면 "이의")
        if correct_particle == '이':
            text = re.sub(f'{child_name}의', f'{child_name}이의', text)
        else:
            text = re.sub(f'{child_name}이의', f'{child_name}의', text)
        
        return text
    
    def generate_completion_message(self, comic_data: Dict[str, Any], child_name: str) -> str:
        """완성된 그림 일기 내용을 바탕으로 개인화된 마무리 멘트 생성"""
        try:
            # 패널 내용 추출
            panels_content = []
            for i in range(1, 5):
                panel_key = f"panel{i}"
                if panel_key in comic_data:
                    panel = comic_data[panel_key]
                    if isinstance(panel, dict):
                        content = panel.get("content", "")
                    else:
                        content = str(panel)
                    panels_content.append(f"패널{i}: {content}")
            
            panels_text = "\n".join(panels_content)
            
            # 마무리 메시지 생성 프롬프트
            system_prompt = """You are an expert at generating personalized completion messages for children's picture diaries.

Completion Message Rules:
1. Create warm, encouraging, and personalized messages based on the comic content
2. Include the child's name naturally in the message with proper Korean particles
3. Reference specific events or emotions from the comic panels
4. Express genuine interest and appreciation for the child's sharing
5. Keep the tone friendly and supportive
6. Make it feel like a real conversation between friends
7. Length should be similar to the original message (2-3 sentences)
8. Use Korean language with appropriate honorifics for children
9. IMPORTANT: Use proper Korean particles after the child's name:
   - If the name ends with a consonant (받침), use "이" (e.g., "민수이")
   - If the name ends without a consonant, use "" (no particle) (e.g., "지우")

Examples:
- "우와~ {child_name}이랑 친구들이 학교에서 게임한 모습이 정말 재미있어 보여! {child_name}이 웃는 모습을 보니 나도 기뻐졌어. 오늘 있었던 일을 이렇게 자세히 들려줘서 고마워!"
- "정말 멋진 그림 일기네! {child_name}이 강아지와 산책하는 모습이 너무 행복해 보여. {child_name}이 좋아하는 것들을 알 수 있어서 나도 기뻐!"

Respond with just the completion message in Korean."""

            user_prompt = f"""The following is the content of {child_name}'s completed picture diary:

{panels_text}

Based on the above comic content, please generate a personalized completion message for {child_name}."""

            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
                max_tokens=200
            )

            result = response.choices[0].message.content.strip()
            
            # 결과가 비어있거나 너무 짧으면 기본 메시지 반환
            if not result or len(result) < 20:
                result = "우와~ 이렇게 멋진 그림 일기 완성이라니! 역시 {child_name}{self._get_vocative_particle(child_name)}야. 내가 너한테 관심이 많다보니 질문이 많았는데 잘 답변해줘서 고마워. 덕분에 {child_name}{self._get_vocative_particle(child_name)}에게 오늘 어떤 일이 있었는지 잘 알 수 있어 정말 너무나 기뻤어!!"
            
            # 생성된 메시지에서 조사 처리
            result = self._fix_korean_particles(result, child_name)
            
            # completion message 뒤에 "그럼 이제 일기 제목을 정하러 가볼까?" 메시지 추가
            result = result + " 그럼 이제 일기 제목을 정하러 가볼까?"
            
            return result
                
        except Exception as e:
            print(f"Error generating completion message: {e}")
            default_message = f"우와~ 이렇게 멋진 그림 일기 완성이라니! 역시 {child_name}{self._get_vocative_particle(child_name)}야. 내가 너한테 관심이 많다보니 질문이 많았는데 잘 답변해줘서 고마워. 덕분에 {child_name}{self._get_vocative_particle(child_name)}에게 오늘 어떤 일이 있었는지 잘 알 수 있어 정말 너무나 기뻤어!!"
            return default_message + " 그럼 이제 일기 제목을 정하러 가볼까?" 