import { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, Avatar, Input, Button, ColorPicker, Space, message } from 'antd';
import { UserAddOutlined, UserOutlined } from '@ant-design/icons';
import { profilesApi, Profile } from '../api';

const { Title, Text } = Typography;

const DEFAULT_COLORS = ['#1890ff', '#f5222d', '#52c41a', '#faad14', '#722ed1', '#13c2c2'];

interface Props {
  onSelect: (profile: Profile) => void;
}

export default function ProfileSetup({ onSelect }: Props) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(DEFAULT_COLORS[0]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    profilesApi.list().then(setProfiles);
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) {
      message.warning('请输入用户名');
      return;
    }
    setCreating(true);
    try {
      const profile = await profilesApi.create({ name: newName.trim(), color: newColor });
      message.success(`用户 "${profile.name}" 创建成功！`);
      onSelect(profile);
    } catch (err: any) {
      const detail = err.response?.data?.name?.[0] || '创建失败';
      message.error(detail);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: 24,
    }}>
      <Card style={{ maxWidth: 700, width: '100%' }}>
        <Title level={2} style={{ textAlign: 'center', marginBottom: 32 }}>
          Hot 100 刷题训练
        </Title>

        {/* 创建新用户 */}
        <Card type="inner" title={<><UserAddOutlined /> 创建新用户</>} style={{ marginBottom: 24 }}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Input
              placeholder="输入你的名字"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onPressEnter={handleCreate}
              size="large"
              maxLength={20}
            />
            <Space>
              <Text>选择颜色：</Text>
              {DEFAULT_COLORS.map(c => (
                <div
                  key={c}
                  onClick={() => setNewColor(c)}
                  style={{
                    width: 32, height: 32, borderRadius: '50%', backgroundColor: c,
                    cursor: 'pointer', border: newColor === c ? '3px solid #333' : '3px solid transparent',
                    transition: 'border 0.2s',
                  }}
                />
              ))}
              <ColorPicker value={newColor} onChange={(_, hex) => setNewColor(hex)} size="small" />
            </Space>
            <Button
              type="primary"
              size="large"
              block
              onClick={handleCreate}
              loading={creating}
            >
              创建并开始刷题
            </Button>
          </Space>
        </Card>

        {/* 选择已有用户 */}
        {profiles.length > 0 && (
          <Card type="inner" title={<><UserOutlined /> 选择已有用户</>}>
            <Row gutter={[16, 16]}>
              {profiles.map(p => (
                <Col key={p.id} xs={12} sm={8} md={6}>
                  <Card
                    hoverable
                    onClick={() => onSelect(p)}
                    style={{ textAlign: 'center' }}
                    bodyStyle={{ padding: 16 }}
                  >
                    <Avatar size={48} style={{ backgroundColor: p.color, marginBottom: 8 }}>
                      {p.name[0]}
                    </Avatar>
                    <div style={{ fontWeight: 500 }}>{p.name}</div>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        )}
      </Card>
    </div>
  );
}
