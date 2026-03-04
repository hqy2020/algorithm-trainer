import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Layout, Menu, theme, Spin, Empty, Button, Space } from 'antd';
import {
  DashboardOutlined,
  UnorderedListOutlined,
  BarChartOutlined,
  ReloadOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import zhCN from 'antd/locale/zh_CN';
import Dashboard from './pages/Dashboard';
import ProblemList from './pages/ProblemList';
import ProblemDetail from './pages/ProblemDetail';
import Statistics from './pages/Statistics';
import { profilesApi, Profile } from './api';

const { Header, Content, Sider } = Layout;

type BattleMode = 'single' | 'room';

const LEGACY_SELECTED_PROFILE_KEY = 'selectedProfileId';
const BATTLE_MODE_KEY = 'battle_mode';
const BATTLE_USER_A_KEY = 'battle_user_a_id';
const BATTLE_USER_B_KEY = 'battle_user_b_id';
const VIEW_USER_KEY = 'view_user_id';

const MENU_ITEMS = [
  { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/problems', icon: <UnorderedListOutlined />, label: '题目列表' },
  { key: '/statistics', icon: <BarChartOutlined />, label: '统计对比' },
];

const parseStoredNumber = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveExistingUserId = (profiles: Profile[], candidates: Array<number | null>) => {
  for (const id of candidates) {
    if (id && profiles.some(p => p.id === id)) return id;
  }
  return profiles[0]?.id ?? null;
};

const resolveSecondUserId = (profiles: Profile[], userAId: number, preferredId: number | null) => {
  if (profiles.length < 2) return null;
  if (preferredId && preferredId !== userAId && profiles.some(p => p.id === preferredId)) {
    return preferredId;
  }
  const fallback = profiles.find(p => p.id !== userAId);
  return fallback?.id ?? null;
};

const getMenuKey = (pathname: string) => (
  pathname.startsWith('/problems')
    ? '/problems'
    : pathname.startsWith('/statistics')
    ? '/statistics'
    : '/'
);

interface AppSiderProps {
  menuKey: string;
  adminUrl: string;
  onNavigate: (path: string) => void;
}

function AppSider({ menuKey, adminUrl, onNavigate }: AppSiderProps) {
  return (
    <Sider breakpoint="lg" collapsedWidth={60}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '16px', textAlign: 'center', color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
          Hot 100
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[menuKey]}
          onClick={({ key }) => onNavigate(String(key))}
          style={{ flex: 1, minHeight: 0 }}
          items={MENU_ITEMS}
        />
        <div style={{ padding: '12px', marginTop: 'auto' }}>
          <Button
            icon={<SettingOutlined />}
            href={adminUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ width: '100%' }}
          >
            Django 后台
          </Button>
        </div>
      </div>
    </Sider>
  );
}

interface AppLayoutProps {
  profiles: Profile[];
  viewUserId: number;
  onChangeViewUser: (userId: number) => void;
  battleMode: BattleMode;
  onChangeBattleMode: (mode: BattleMode) => void;
  battleUserAId: number;
  battleUserBId: number | null;
  onChangeBattleUserA: (userId: number) => void;
  onChangeBattleUserB: (userId: number) => void;
}

function AppLayout({
  profiles,
  viewUserId,
  onChangeViewUser,
  battleMode,
  onChangeBattleMode,
  battleUserAId,
  battleUserBId,
  onChangeBattleUserA,
  onChangeBattleUserB,
}: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const adminUrl = `http://${hostname}:10001/admin/`;
  const menuKey = getMenuKey(location.pathname);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <AppSider menuKey={menuKey} adminUrl={adminUrl} onNavigate={navigate} />
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center' }}>
          LeetCode Hot100 对战训练
        </Header>
        <Content style={{ margin: '24px', minHeight: 280 }}>
          <Routes>
            <Route
              path="/"
              element={(
                <Dashboard
                  profiles={profiles}
                  viewUserId={viewUserId}
                  onChangeViewUser={onChangeViewUser}
                />
              )}
            />
            <Route
              path="/problems"
              element={(
                <ProblemList
                  profiles={profiles}
                  viewUserId={viewUserId}
                  onChangeViewUser={onChangeViewUser}
                />
              )}
            />
            <Route
              path="/problems/:id"
              element={(
                <ProblemDetail
                  profiles={profiles}
                  battleMode={battleMode}
                  onChangeBattleMode={onChangeBattleMode}
                  battleUserAId={battleUserAId}
                  battleUserBId={battleUserBId}
                  onChangeBattleUserA={onChangeBattleUserA}
                  onChangeBattleUserB={onChangeBattleUserB}
                />
              )}
            />
            <Route
              path="/statistics"
              element={(
                <Statistics
                  profiles={profiles}
                  viewUserId={viewUserId}
                  onChangeViewUser={onChangeViewUser}
                  battleUserAId={battleUserAId}
                  battleUserBId={battleUserBId}
                  onChangeBattleUserA={onChangeBattleUserA}
                  onChangeBattleUserB={onChangeBattleUserB}
                />
              )}
            />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

function NoProfilesLayout({ onRefresh }: { onRefresh: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const adminUrl = `http://${hostname}:10001/admin/`;
  const menuKey = getMenuKey(location.pathname);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <AppSider menuKey={menuKey} adminUrl={adminUrl} onNavigate={navigate} />
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center' }}>
          LeetCode Hot100 对战训练
        </Header>
        <Content style={{ margin: '24px', minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Space direction="vertical" align="center" size="large">
            <Empty description="后台还没有用户，请先在 Django 后台创建用户" />
            <Space>
              <Button icon={<SettingOutlined />} href={adminUrl} target="_blank" rel="noopener noreferrer">
                打开 Django 后台
              </Button>
              <Button icon={<ReloadOutlined />} onClick={onRefresh}>
                刷新用户列表
              </Button>
            </Space>
          </Space>
        </Content>
      </Layout>
    </Layout>
  );
}

function AppRoot() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [viewUserId, setViewUserId] = useState<number | null>(null);
  const [battleMode, setBattleMode] = useState<BattleMode>('single');
  const [battleUserAId, setBattleUserAId] = useState<number | null>(null);
  const [battleUserBId, setBattleUserBId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfiles = () => {
    const storedLegacyUserId = parseStoredNumber(localStorage.getItem(LEGACY_SELECTED_PROFILE_KEY));
    const storedUserAId = parseStoredNumber(localStorage.getItem(BATTLE_USER_A_KEY));
    const storedUserBId = parseStoredNumber(localStorage.getItem(BATTLE_USER_B_KEY));
    const storedViewUserId = parseStoredNumber(localStorage.getItem(VIEW_USER_KEY));
    const storedMode = localStorage.getItem(BATTLE_MODE_KEY);

    setLoading(true);
    profilesApi.list()
      .then((list) => {
        setProfiles(list);

        if (list.length === 0) {
          setViewUserId(null);
          setBattleUserAId(null);
          setBattleUserBId(null);
          setBattleMode('single');
          return;
        }

        const initialA = resolveExistingUserId(list, [storedUserAId, storedLegacyUserId]);
        if (!initialA) return;

        const initialB = resolveSecondUserId(list, initialA, storedUserBId);
        const initialView = resolveExistingUserId(list, [storedViewUserId, initialA]) || initialA;

        const initialMode: BattleMode = list.length < 2
          ? 'single'
          : (storedMode === 'single' ? 'single' : 'room');

        setBattleUserAId(initialA);
        setBattleUserBId(initialB);
        setViewUserId(initialView);
        setBattleMode(initialMode);

        localStorage.setItem(BATTLE_USER_A_KEY, String(initialA));
        if (initialB) localStorage.setItem(BATTLE_USER_B_KEY, String(initialB));
        localStorage.setItem(VIEW_USER_KEY, String(initialView));
        localStorage.setItem(BATTLE_MODE_KEY, initialMode);
        localStorage.removeItem(LEGACY_SELECTED_PROFILE_KEY);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleChangeViewUser = (userId: number) => {
    setViewUserId(userId);
    localStorage.setItem(VIEW_USER_KEY, String(userId));
  };

  const handleChangeBattleMode = (mode: BattleMode) => {
    const nextMode = profiles.length < 2 ? 'single' : mode;
    setBattleMode(nextMode);
    localStorage.setItem(BATTLE_MODE_KEY, nextMode);
  };

  const handleChangeBattleUserA = (userId: number) => {
    setBattleUserAId(userId);
    setViewUserId(userId);
    localStorage.setItem(BATTLE_USER_A_KEY, String(userId));
    localStorage.setItem(VIEW_USER_KEY, String(userId));

    if (battleUserBId === userId) {
      const nextB = resolveSecondUserId(profiles, userId, null);
      setBattleUserBId(nextB);
      if (nextB) localStorage.setItem(BATTLE_USER_B_KEY, String(nextB));
      else localStorage.removeItem(BATTLE_USER_B_KEY);
    }
  };

  const handleChangeBattleUserB = (userId: number) => {
    if (!battleUserAId || userId === battleUserAId) return;
    setBattleUserBId(userId);
    localStorage.setItem(BATTLE_USER_B_KEY, String(userId));
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (profiles.length === 0) {
    return <NoProfilesLayout onRefresh={loadProfiles} />;
  }

  if (!viewUserId || !battleUserAId) {
    return null;
  }

  return (
    <AppLayout
      profiles={profiles}
      viewUserId={viewUserId}
      onChangeViewUser={handleChangeViewUser}
      battleMode={battleMode}
      onChangeBattleMode={handleChangeBattleMode}
      battleUserAId={battleUserAId}
      battleUserBId={battleUserBId}
      onChangeBattleUserA={handleChangeBattleUserA}
      onChangeBattleUserB={handleChangeBattleUserB}
    />
  );
}

export default function App() {
  return (
    <ConfigProvider locale={zhCN} theme={{ algorithm: theme.defaultAlgorithm }}>
      <BrowserRouter>
        <AppRoot />
      </BrowserRouter>
    </ConfigProvider>
  );
}
