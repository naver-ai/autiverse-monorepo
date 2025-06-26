import { createFileRoute, Link } from '@tanstack/react-router';
import { ChatbotFlow } from '../../components/ChatbotFlow';

export const Route = createFileRoute('/_protected/comic-chatbot')({
  component: () => {
    return (
      <div>
        <div style={{ 
          position: 'fixed', 
          top: '20px', 
          right: '20px', 
          zIndex: 1000,
          background: 'white',
          padding: '10px 15px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          border: '1px solid #e0e0e0'
        }}>
          <Link 
            to="/tablet-comic-chatbot"
            style={{
              color: '#4A90E2',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            📱 태블릿 모드
          </Link>
        </div>
        <ChatbotFlow />
      </div>
    );
  },
}); 