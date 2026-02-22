import { Avatar, Button, Select, Space } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import type { Profile } from '../api';

interface Props {
  current: Profile;
  users: Profile[];
  onChangeUser: (userId: number) => void;
}

export default function UserSwitcher({ current, users, onChangeUser }: Props) {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const adminUrl = `http://${hostname}:10001/admin/`;

  return (
    <Space>
      <Avatar style={{ backgroundColor: current.color }}>{current.name[0]}</Avatar>
      <Select
        value={current.id}
        style={{ width: 180 }}
        onChange={(value) => onChangeUser(value)}
        options={users.map(user => ({
          value: user.id,
          label: user.name,
        }))}
      />
      <Button size="small" icon={<SettingOutlined />} href={adminUrl} target="_blank" rel="noopener noreferrer">
        Django 后台
      </Button>
    </Space>
  );
}
