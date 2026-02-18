import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Layout, Menu, theme } from 'antd';
import {
  DashboardOutlined,
  UnorderedListOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import zhCN from 'antd/locale/zh_CN';
import Dashboard from './pages/Dashboard';
import ProblemList from './pages/ProblemList';
import ProblemDetail from './pages/ProblemDetail';
import Statistics from './pages/Statistics';
import UserSwitcher from './components/UserSwitcher';
import { profilesApi, Profile } from './api';

const { Header, Content, Sider } = Layout;

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);

  useEffect(() => {
    profilesApi.list().then(data => {
      setUsers(data);
      if (data.length > 0 && !currentUser) {
        setCurrentUser(data[0]);
      }
    });
  }, []);

  const menuKey = location.pathname.startsWith('/problems')
    ? '/problems'
    : location.pathname.startsWith('/statistics')
    ? '/statistics'
    : '/';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth={60}>
        <div style={{ padding: '16px', textAlign: 'center', color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
          🔥 Hot 100
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[menuKey]}
          onClick={({ key }) => navigate(key)}
          items={[
            { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
            { key: '/problems', icon: <UnorderedListOutlined />, label: '题目列表' },
            { key: '/statistics', icon: <BarChartOutlined />, label: '统计对比' },
          ]}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <UserSwitcher users={users} current={currentUser} onChange={setCurrentUser} />
        </Header>
        <Content style={{ margin: '24px', minHeight: 280 }}>
          {currentUser && (
            <Routes>
              <Route path="/" element={<Dashboard userId={currentUser.id} />} />
              <Route path="/problems" element={<ProblemList userId={currentUser.id} />} />
              <Route path="/problems/:id" element={<ProblemDetail userId={currentUser.id} userName={currentUser.name} />} />
              <Route path="/statistics" element={<Statistics />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          )}
        </Content>
      </Layout>
    </Layout>
  );
}

export default function App() {
  return (
    <ConfigProvider locale={zhCN} theme={{ algorithm: theme.defaultAlgorithm }}>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </ConfigProvider>
  );
}
