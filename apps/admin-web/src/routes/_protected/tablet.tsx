import { createFileRoute, Link } from '@tanstack/react-router';
import styled from '@emotion/styled';

// Galaxy Tab S9 Landscape Layout (1600 x 2560 -> 2560 x 1600)
const TabletContainer = styled.div`
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  flex-direction: column;
  padding: 40px;
  box-sizing: border-box;
  overflow-y: auto;
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 60px;
`;

const Title = styled.h1`
  font-size: 48px;
  font-weight: bold;
  color: white;
  margin: 0;
  text-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
`;

const Subtitle = styled.p`
  font-size: 24px;
  color: rgba(255, 255, 255, 0.9);
  margin: 20px 0 0 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
`;

const AppGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 30px;
  flex: 1;
  align-items: center;
  justify-content: center;
  max-width: 1000px;
  margin: 0 auto;
  width: 100%;
`;

const AppCard = styled(Link)`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: 20px;
  padding: 30px;
  text-decoration: none;
  color: #333;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  min-height: 250px;
  
  &:hover {
    transform: translateY(-8px);
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2);
  }
  
  &:active {
    transform: translateY(-4px);
  }
`;

const AppIcon = styled.div`
  font-size: 60px;
  margin-bottom: 20px;
`;

const AppTitle = styled.h2`
  font-size: 24px;
  font-weight: bold;
  margin: 0 0 15px 0;
  text-align: center;
`;

const AppDescription = styled.p`
  font-size: 16px;
  color: #666;
  text-align: center;
  line-height: 1.5;
  margin: 0;
`;

const Footer = styled.div`
  text-align: center;
  margin-top: 40px;
`;

const FooterText = styled.p`
  font-size: 16px;
  color: rgba(255, 255, 255, 0.8);
  margin: 0;
`;

const DesktopModeLink = styled(Link)`
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.9);
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  border: 1px solid #e0e0e0;
  color: #4A90E2;
  text-decoration: none;
  font-size: 14px;
  font-weight: bold;
  transition: all 0.2s;
  
  &:hover {
    background: rgba(255, 255, 255, 1);
    transform: translateY(-1px);
  }
`;

export const Route = createFileRoute('/_protected/tablet')({
  component: () => {
    return (
      <TabletContainer>
        <DesktopModeLink to="/">
          💻 데스크톱 모드
        </DesktopModeLink>
        
        <Header>
          <Title>🎨 Autiverse</Title>
          <Subtitle>태블릿용 만화일기 앱</Subtitle>
        </Header>
        
        <AppGrid>
          <AppCard to="/tablet-comic-chatbot">
            <AppIcon>🎭</AppIcon>
            <AppTitle>만화일기 챗봇</AppTitle>
            <AppDescription>
              도도와 대화하면서 4컷 만화를 만들어보세요! 
              왼쪽에서 만화를 보고 오른쪽에서 대화할 수 있어요.
            </AppDescription>
          </AppCard>
          
          <AppCard to="/comic-chatbot">
            <AppIcon>💻</AppIcon>
            <AppTitle>데스크톱 모드</AppTitle>
            <AppDescription>
              기존 데스크톱 버전으로 이동합니다. 
              더 많은 기능을 사용할 수 있어요.
            </AppDescription>
          </AppCard>
          
          <AppCard to="/comic">
            <AppIcon>🎨</AppIcon>
            <AppTitle>만화 생성기</AppTitle>
            <AppDescription>
              4컷 만화를 직접 생성해보세요. 
              테스트용 만화 생성 기능입니다.
            </AppDescription>
          </AppCard>
          
          <AppCard to="/dyads">
            <AppIcon>👥</AppIcon>
            <AppTitle>관계 관리</AppTitle>
            <AppDescription>
              사람들과 장소를 관리하고 
              관계를 기록해보세요.
            </AppDescription>
          </AppCard>
        </AppGrid>
        
        <Footer>
          <FooterText>
            Galaxy Tab S9 최적화 • 가로 모드 권장
          </FooterText>
        </Footer>
      </TabletContainer>
    );
  },
}); 