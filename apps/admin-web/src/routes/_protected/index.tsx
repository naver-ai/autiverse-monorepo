import { createFileRoute, Outlet, redirect, Link } from '@tanstack/react-router';
import { verifyTokenApi } from '../../features/auth/api';

export const Route = createFileRoute('/_protected/')({
    beforeLoad: async () => {
        const isValid = await verifyTokenApi();
        if (!isValid) {
            throw redirect({
                to: '/signin',
            });
        }
        
        // Redirect to /users if user is on the index page
        throw redirect({
            to: '/dyads/list',
        });
    },
    component: () => {
        return (
            <div className="p-6">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-bold text-gray-900 mb-4">
                            🎨 Autiverse 만화일기
                        </h1>
                        <p className="text-xl text-gray-600">
                            AI와 함께 만드는 개인화된 만화일기
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                        <Link
                            to="/comic-chatbot"
                            className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200"
                        >
                            <div className="text-3xl mb-4">🎭</div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">만화일기 챗봇</h3>
                            <p className="text-gray-600">
                                도도와 대화하면서 4컷 만화를 만들어보세요!
                            </p>
                        </Link>

                        <Link
                            to="/tablet"
                            className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200"
                        >
                            <div className="text-3xl mb-4">📱</div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">태블릿 모드</h3>
                            <p className="text-gray-600">
                                Galaxy Tab S9에 최적화된 태블릿 인터페이스
                            </p>
                        </Link>

                        <Link
                            to="/comic"
                            className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200"
                        >
                            <div className="text-3xl mb-4">🎨</div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">만화 생성기</h3>
                            <p className="text-gray-600">
                                4컷 만화를 직접 생성해보세요
                            </p>
                        </Link>

                        <Link
                            to="/dyads"
                            className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200"
                        >
                            <div className="text-3xl mb-4">👥</div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">관계 관리</h3>
                            <p className="text-gray-600">
                                사람들과 장소를 관리하고 관계를 기록해보세요
                            </p>
                        </Link>

                        <Link
                            to="/journal"
                            className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200"
                        >
                            <div className="text-3xl mb-4">📝</div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">일기 목록</h3>
                            <p className="text-gray-600">
                                작성한 일기들을 확인해보세요
                            </p>
                        </Link>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                        <h3 className="text-lg font-semibold text-blue-900 mb-2">
                            💡 사용 팁
                        </h3>
                        <ul className="text-blue-800 space-y-1">
                            <li>• 태블릿을 사용하시는 경우 "태블릿 모드"를 이용해보세요</li>
                            <li>• 만화일기 챗봇에서 도도와 자연스럽게 대화해보세요</li>
                            <li>• 관계 관리에서 자주 등장하는 사람과 장소를 등록해보세요</li>
                        </ul>
                    </div>
                </div>
            </div>
        );
    },
}); 