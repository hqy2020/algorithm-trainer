import { useEffect, useMemo, useState } from 'react';
import { Row, Col, Card, Typography, Statistic, Space, Avatar, Select, Segmented, Empty, List, Tag } from 'antd';
import { submissionsApi, CompareItem, Profile, Stats } from '../api';
import { CompletionPieChart, DifficultyBarChart, PassRateChart, DifficultyPassChart } from '../components/StatsChart';

const { Title, Text } = Typography;

type StatsMode = 'single' | 'duel';

interface Props {
  profiles: Profile[];
  viewUserId: number;
  onChangeViewUser: (userId: number) => void;
  battleUserAId: number;
  battleUserBId: number | null;
  onChangeBattleUserA: (userId: number) => void;
  onChangeBattleUserB: (userId: number) => void;
}

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;

function buildSingleCompareItem(profile: Profile, stats: Stats, solvedCount: number): CompareItem {
  const byDifficulty: CompareItem['by_difficulty'] = {
    Easy: { count: 0, passed: 0, avg_time: 0 },
    Medium: { count: 0, passed: 0, avg_time: 0 },
    Hard: { count: 0, passed: 0, avg_time: 0 },
  };

  stats.by_difficulty.forEach((item) => {
    const key = item.problem__difficulty as keyof CompareItem['by_difficulty'];
    if (!byDifficulty[key]) return;
    byDifficulty[key] = {
      count: item.count || 0,
      passed: item.passed_count || 0,
      avg_time: item.avg_time || 0,
    };
  });

  return {
    user_id: profile.id,
    user_name: profile.name,
    user_color: profile.color,
    total_submissions: stats.total_submissions,
    total_passed: stats.total_passed,
    pass_rate: stats.pass_rate,
    unique_solved: solvedCount,
    by_difficulty: byDifficulty,
  };
}

const difficultyColor: Record<string, string> = {
  Easy: 'green',
  Medium: 'orange',
  Hard: 'red',
};

export default function Statistics({
  profiles,
  viewUserId,
  onChangeViewUser,
  battleUserAId,
  battleUserBId,
  onChangeBattleUserA,
  onChangeBattleUserB,
}: Props) {
  const [mode, setMode] = useState<StatsMode>('single');
  const [singleStats, setSingleStats] = useState<Stats | null>(null);
  const [singleSolvedCount, setSingleSolvedCount] = useState(0);
  const [compareData, setCompareData] = useState<CompareItem[]>([]);

  useEffect(() => {
    Promise.all([
      submissionsApi.stats(viewUserId),
      submissionsApi.personalBests(viewUserId),
    ]).then(([stats, bests]) => {
      setSingleStats(stats);
      setSingleSolvedCount(bests.records.length);
    });
  }, [viewUserId]);

  useEffect(() => {
    submissionsApi.compare().then(setCompareData);
  }, []);

  const currentUser = profiles.find(p => p.id === viewUserId) || null;

  const singleCompareData = useMemo(() => {
    if (!currentUser || !singleStats) return [];
    return [buildSingleCompareItem(currentUser, singleStats, singleSolvedCount)];
  }, [currentUser, singleSolvedCount, singleStats]);

  const duelData = useMemo(() => {
    if (!battleUserBId) return [];
    const order = new Map<number, number>([
      [battleUserAId, 0],
      [battleUserBId, 1],
    ]);
    return compareData
      .filter(d => d.user_id === battleUserAId || d.user_id === battleUserBId)
      .sort((a, b) => (order.get(a.user_id) ?? 99) - (order.get(b.user_id) ?? 99));
  }, [battleUserAId, battleUserBId, compareData]);

  const battleUserBOptions = profiles
    .filter(p => p.id !== battleUserAId)
    .map(p => ({ value: p.id, label: p.name }));

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <Title level={3} style={{ margin: 0 }}>
          {mode === 'single' ? '📊 单人统计' : '📊 对战统计对比'}
        </Title>
        <Space wrap>
          <Segmented
            value={mode}
            onChange={value => setMode(value as StatsMode)}
            options={[
              { label: '单人', value: 'single' },
              { label: '对战', value: 'duel', disabled: profiles.length < 2 },
            ]}
          />
          {mode === 'single' ? (
            <>
              <Text type="secondary">视角用户</Text>
              <Select
                style={{ width: 180 }}
                value={viewUserId}
                onChange={onChangeViewUser}
                options={profiles.map(p => ({ value: p.id, label: p.name }))}
              />
            </>
          ) : (
            <>
              <Text type="secondary">用户A</Text>
              <Select
                style={{ width: 150 }}
                value={battleUserAId}
                onChange={onChangeBattleUserA}
                options={profiles.map(p => ({ value: p.id, label: p.name }))}
              />
              <Text type="secondary">用户B</Text>
              <Select
                style={{ width: 150 }}
                value={battleUserBId ?? undefined}
                onChange={onChangeBattleUserB}
                options={battleUserBOptions}
              />
            </>
          )}
        </Space>
      </Space>

      {mode === 'single' ? (
        <>
          {singleStats && currentUser ? (
            <>
              <Card style={{ marginBottom: 24 }}>
                <Space>
                  <Avatar size="large" style={{ backgroundColor: currentUser.color }}>
                    {currentUser.name[0]}
                  </Avatar>
                  <div>
                    <Title level={4} style={{ margin: 0 }}>{currentUser.name}</Title>
                    <Text type="secondary">当前视角统计</Text>
                  </div>
                </Space>
                <Row gutter={16} style={{ marginTop: 16 }}>
                  <Col xs={12} md={6}>
                    <Statistic title="已解题目" value={singleSolvedCount} />
                  </Col>
                  <Col xs={12} md={6}>
                    <Statistic title="提交次数" value={singleStats.total_submissions} />
                  </Col>
                  <Col xs={12} md={6}>
                    <Statistic title="通过次数" value={singleStats.total_passed} />
                  </Col>
                  <Col xs={12} md={6}>
                    <Statistic title="通过率" value={singleStats.pass_rate} suffix="%" />
                  </Col>
                </Row>
              </Card>

              <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col xs={24} xl={12}>
                  <Card title="按难度统计">
                    <List
                      dataSource={DIFFICULTIES.map((difficulty) => {
                        const item = singleStats.by_difficulty.find(i => i.problem__difficulty === difficulty);
                        return {
                          difficulty,
                          count: item?.count || 0,
                          passed: item?.passed_count || 0,
                          avgTime: item?.avg_time || 0,
                        };
                      })}
                      renderItem={(item) => (
                        <List.Item>
                          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                            <Tag color={difficultyColor[item.difficulty]}>{item.difficulty}</Tag>
                            <Text>{item.passed}/{item.count} 通过，平均 {Math.round(item.avgTime / 60)} 分钟</Text>
                          </Space>
                        </List.Item>
                      )}
                    />
                  </Card>
                </Col>
                <Col xs={24} xl={12}>
                  <Card title="按分类统计">
                    <List
                      dataSource={singleStats.by_category}
                      locale={{ emptyText: '暂无分类数据' }}
                      renderItem={(item) => (
                        <List.Item>
                          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                            <Tag>{item.problem__category}</Tag>
                            <Text>{item.passed_count}/{item.count} 通过，平均 {Math.round((item.avg_time || 0) / 60)} 分钟</Text>
                          </Space>
                        </List.Item>
                      )}
                    />
                  </Card>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} xl={12}>
                  <Card><DifficultyBarChart data={singleCompareData} /></Card>
                </Col>
                <Col xs={24} xl={12}>
                  <Card><DifficultyPassChart data={singleCompareData} /></Card>
                </Col>
              </Row>
            </>
          ) : (
            <Card><Empty description="暂无统计数据，先去提交几道题吧" /></Card>
          )}
        </>
      ) : (
        <>
          {duelData.length < 2 ? (
            <Card><Empty description="请选择两个不同用户后查看对战统计" /></Card>
          ) : (
            <>
              <Row gutter={16} style={{ marginBottom: 24 }}>
                {duelData.map(d => (
                  <Col xs={24} xl={12} key={d.user_id}>
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

              <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col xs={24} xl={12}>
                  <Card><CompletionPieChart data={duelData} /></Card>
                </Col>
                <Col xs={24} xl={12}>
                  <Card><PassRateChart data={duelData} /></Card>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col xs={24} xl={12}>
                  <Card><DifficultyBarChart data={duelData} /></Card>
                </Col>
                <Col xs={24} xl={12}>
                  <Card><DifficultyPassChart data={duelData} /></Card>
                </Col>
              </Row>
            </>
          )}
        </>
      )}
    </div>
  );
}
