import { Avatar, Dropdown, Space } from 'antd';
import { UserOutlined, SwapOutlined } from '@ant-design/icons';
import type { Profile } from '../api';

interface Props {
  users: Profile[];
  current: Profile | null;
  onChange: (user: Profile) => void;
}

export default function UserSwitcher({ users, current, onChange }: Props) {
  if (!current) return null;

  const items = users.map(u => ({
    key: String(u.id),
    label: (
      <Space>
        <Avatar size="small" style={{ backgroundColor: u.color }}>{u.name[0]}</Avatar>
        {u.name}
      </Space>
    ),
    onClick: () => onChange(u),
  }));

  return (
    <Dropdown menu={{ items }} trigger={['click']}>
      <Space style={{ cursor: 'pointer' }}>
        <Avatar style={{ backgroundColor: current.color }}>{current.name[0]}</Avatar>
        <span style={{ fontWeight: 500 }}>{current.name}</span>
        <SwapOutlined />
      </Space>
    </Dropdown>
  );
}
