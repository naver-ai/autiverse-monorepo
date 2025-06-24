import { createFileRoute, Link } from '@tanstack/react-router';
import { FourSceneComic as ComicComponent } from '../../components/FourSceneComic';
import { useState } from 'react';
import { FourSceneComic } from '../../utils/comic';

export const Route = createFileRoute('/_protected/comic')({
  component: () => {
    const [comicData, setComicData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generateComic = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const comic = new FourSceneComic({
          // panel1: "나는 센터에서 선생님이랑 숨바꼭질을 하고 놀았다.",
          // panel2: "의자 밑에 잘 숨어서 선생님이 못 찾을거라 생각했다.",
          // panel3: "그런데 선생님에게 내가 잡히고 말았다.",
          // panel4: "조금은 속상했지만 재미있었다."

          // panel1: "나는 영호랑 줄넘기를 하고 놀았다.",
          // panel2: "점프도 하고 줄도 돌렸다.",
          // panel3: "그러자 선생님께서 교실에서는 그러면 안된다고 우리를 혼내셨다.",
          // panel4: "나는 속상했다."

          panel1: "나는 영호랑 줄넘기를 하고 놀았다.",
          panel2: "",
          panel3: "그러자 선생님께서 교실에서는 그러면 안된다고 우리를 혼내셨다.",
          panel4: "나는 속상했다."

          // panel1: "학교 점심시간이 되자마자 12시 34분 발 지하철 3호선 열차의 제조 연도와 차륜 직경을 설명하려고 민수 옆에 앉았는데, 민수는 이미 스마트폰 게임 중이었다.",
          // panel2: "내가 '2009년에 도입된 D 형 전동차는 회생 제동 효율이 7 퍼센트 향상…'이라고 얘기하자 민수가 눈을 피했고, 화장실로 가 버렸다.",
          // panel3: "혼자 남은 테이블에서 스트레칭 동작(손가락 관절 10번 눌러 펴기)을 하고 난 뒤, 메모앱에 남은 통계치를 빠짐없이 적어 두었다.",
          // panel4: "나는 고립감을 느꼈다."

          // panel1: "학교 도서관 2층 창가 자리에서 '멸종 위기 곤충의 야행성 행동 패턴' 논문을 읽었는데, 각주 번호가 APA 7판이 아니라 시카고 스타일이라 순간 집중이 깨졌다.",
          // panel2: "같은 페이지를 네 번 다시 읽으며 형식을 맞추고 싶어 손가락으로 줄간격을 재다가 사서 선생님이 '도움이 필요해?'라고 물었다.",
          // panel3: "내가 '참고문헌 형식이 혼합돼 있어요'라고 길게 설명하자 선생님은 고개를 끄덕이며 수정용 포스트잇을 건넸고, 나는 페이지 모서리에 색깔별로 스티커를 붙이며 다시 진도를 나갔다.",
          // panel4: "나는 안정감을 느꼈다."
        }, import.meta.env.OPENAI_API_KEY);

        const result = await comic.generate();
        setComicData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">4컷 만화 테스트</h1>
          <Link 
            to="/comic-chatbot"
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg"
          >
            🎨 만화일기 챗봇 시작하기
          </Link>
        </div>
        
        <button 
          onClick={generateComic}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-4"
          disabled={isLoading}
        >
          {isLoading ? '생성 중...' : '만화 생성하기'}
        </button>
        
        {error && (
          <div className="text-red-500 mb-4">
            에러: {error}
          </div>
        )}
        
        {comicData && <ComicComponent panels={comicData} />}
      </div>
    );
  },
}); 