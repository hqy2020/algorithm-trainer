import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Tag, List, Typography } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  FireOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { submissionsApi, problemsApi, Stats, Problem } from '../api';

const { Title } = Typography;

interface Props {
  userId: number;
}

export default function Dashboard({ userId }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [totalProblems, setTotalProblems] = useState(0);
  const [recentSubmissions, setRecentSubmissions] = useState<any[]>([]);

  useEffect(() => {
    submissionsApi.stats(userId).then(setStats);
    problemsApi.list().then(p => setTotalProblems(p.length));
    submissionsApi.list({ user: userId }).then(s => setRecentSubmissions(s.slice(0, 5)));
  }, [userId]);

  if (!stats) return null;

  return (
    <div>
      <Title level={3}>📊 刷题概览</Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总提交次数"
              value={stats.total_submissions}
              prefix={<FireOutlined style={{ color: '#f5222d' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="通过次数"
              value={stats.total_passed}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="通过率"
              value={stats.pass_rate}
              suffix="%"
              prefix={<TrophyOutlined style={{ color: '#faad14' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均用时"
              value={Math.round(stats.avg_time_seconds / 60)}
              suffix="分钟"
              prefix={<ClockCircleOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title="按难度统计">
            {stats.by_difficulty.map(item => (
              <div key={item.problem__difficulty} style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <Tag color={
                  item.problem__difficulty === 'Easy' ? 'green' :
                  item.problem__difficulty === 'Medium' ? 'orange' : 'red'
                }>
                  {item.problem__difficulty}
                </Tag>
                <span>
                  {item.passed_count}/{item.count} 通过，
                  平均 {Math.round((item.avg_time || 0) / 60)} 分钟
                </span>
              </div>
            ))}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="最近提交">
            <List
              size="small"
              dataSource={recentSubmissions}
              renderItem={(item: any) => (
                <List.Item>
                  <span>{item.problem_title}</span>
                  <span>
                    {item.is_passed
                      ? <Tag color="success">通过</Tag>
                      : <Tag color="error">未通过</Tag>
                    }
                    {Math.round(item.time_spent / 60)}分钟
                  </span>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
