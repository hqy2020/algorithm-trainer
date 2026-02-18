import { useEffect, useState } from 'react';
import { Row, Col, Card, Typography, Statistic, Space, Avatar } from 'antd';
import { TrophyOutlined } from '@ant-design/icons';
import { submissionsApi, CompareItem } from '../api';
import { CompletionPieChart, DifficultyBarChart, PassRateChart, DifficultyPassChart } from '../components/StatsChart';

const { Title } = Typography;

export default function Statistics() {
  const [data, setData] = useState<CompareItem[]>([]);

  useEffect(() => {
    submissionsApi.compare().then(setData);
  }, []);

  if (data.length === 0) {
    return (
      <div>
        <Title level={3}>📊 统计对比</Title>
        <Card>暂无数据，先去做几道题吧！</Card>
      </div>
    );
  }

  return (
    <div>
      <Title level={3}>📊 双人统计对比</Title>

      {/* 概览卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {data.map(d => (
          <Col span={12} key={d.user_id}>
            <Card>
              <Space>
                <Avatar size="large" style={{ backgroundColor: d.user_color }}>
                  {d.user_name[0]}
                </Avatar>
                <div>
                  <Title level={4} style={{ margin: 0 }}>{d.user_name}</Title>
                </div>
              </Space>
              <Row gutter={16} style={{ marginTop: 16 }}>
                <Col span={8}>
                  <Statistic title="已解题目" value={d.unique_solved} />
                </Col>
                <Col span={8}>
                  <Statistic title="提交次数" value={d.total_submissions} />
                </Col>
                <Col span={8}>
                  <Statistic title="通过率" value={d.pass_rate} suffix="%" />
                </Col>
              </Row>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 图表 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card><CompletionPieChart data={data} /></Card>
        </Col>
        <Col span={12}>
          <Card><PassRateChart data={data} /></Card>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <Card><DifficultyBarChart data={data} /></Card>
        </Col>
        <Col span={12}>
          <Card><DifficultyPassChart data={data} /></Card>
        </Col>
      </Row>
    </div>
  );
}
