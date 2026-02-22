import { useCallback, useEffect, useState } from 'react';
import { Table, Tag, Input, Select, Space, Typography, Button, Drawer, Card, Alert, List, Empty, Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import AiMarkdown from '../components/AiMarkdown';
import { problemsApi, submissionsApi, Problem, Submission, Profile, PersonalBest } from '../api';

const { Title, Text } = Typography;
const { Search } = Input;

interface Props {
  profiles: Profile[];
  viewUserId: number;
  onChangeViewUser: (userId: number) => void;
}

const difficultyColor: Record<string, string> = {
  Easy: 'green',
  Medium: 'orange',
  Hard: 'red',
};

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}分${secs}秒`;
}

export default function ProblemList({ profiles, viewUserId, onChangeViewUser }: Props) {
  const navigate = useNavigate();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [search, setSearch] = useState('');
  const [diffFilter, setDiffFilter] = useState<string>('');
  const [catFilter, setCatFilter] = useState<string>('');

  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyProblem, setHistoryProblem] = useState<Problem | null>(null);
  const [historyPersonalBest, setHistoryPersonalBest] = useState<PersonalBest | null>(null);
  const [historySubmissions, setHistorySubmissions] = useState<Submission[]>([]);

  useEffect(() => {
    Promise.all([
      problemsApi.list(),
      submissionsApi.list({ user: viewUserId }),
    ]).then(([problemList, userSubmissions]) => {
      setProblems(problemList);
      setSubmissions(userSubmissions);
    });
  }, [viewUserId]);

  const loadProblemHistory = useCallback(async (problemId: number, userId: number) => {
    setHistoryLoading(true);
    try {
      const [bestData, submissionData] = await Promise.all([
        submissionsApi.personalBest(userId, problemId),
        submissionsApi.list({ user: userId, problem: problemId }),
      ]);
      setHistoryPersonalBest(bestData);
      setHistorySubmissions(submissionData);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const openHistoryDrawer = (problem: Problem) => {
    setHistoryProblem(problem);
    setHistoryDrawerOpen(true);
    loadProblemHistory(problem.id, viewUserId);
  };

  useEffect(() => {
    if (!historyDrawerOpen || !historyProblem) return;
    loadProblemHistory(historyProblem.id, viewUserId);
  }, [historyDrawerOpen, historyProblem, loadProblemHistory, viewUserId]);

  // 每道题的状态：已通过 / 已尝试 / 未做
  const statusMap = new Map<number, 'passed' | 'attempted'>();
  submissions.forEach((s) => {
    const current = statusMap.get(s.problem);
    if (s.is_passed) statusMap.set(s.problem, 'passed');
    else if (current !== 'passed') statusMap.set(s.problem, 'attempted');
  });

  const categories = [...new Set(problems.map(p => p.category))].sort();

  const filtered = problems.filter(p => {
    if (search && !p.title.includes(search) && !String(p.number).includes(search)) return false;
    if (diffFilter && p.difficulty !== diffFilter) return false;
    if (catFilter && p.category !== catFilter) return false;
    return true;
  });

  const columns = [
    {
      title: '状态',
      key: 'status',
      width: 70,
      render: (_: unknown, p: Problem) => {
        const status = statusMap.get(p.id);
        if (status === 'passed') return <Tag color="success">✓</Tag>;
        if (status === 'attempted') return <Tag color="warning">○</Tag>;
        return <Tag>-</Tag>;
      },
    },
    {
      title: '顺序',
      dataIndex: 'hot100_order',
      width: 70,
      render: (v: number) => <span style={{ color: '#999' }}>#{v}</span>,
    },
    {
      title: '题号',
      dataIndex: 'number',
      width: 80,
    },
    {
      title: '题目',
      dataIndex: 'title',
      render: (text: string) => <span style={{ fontWeight: 500 }}>{text}</span>,
    },
    {
      title: '难度',
      dataIndex: 'difficulty',
      width: 80,
      render: (d: string) => <Tag color={difficultyColor[d]}>{d}</Tag>,
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 100,
      render: (c: string) => <Tag>{c}</Tag>,
    },
    {
      title: '建议用时',
      dataIndex: 'time_standard',
      width: 100,
      render: (t: number) => `${t} 分钟`,
    },
    {
      title: '历史',
      key: 'history',
      width: 90,
      render: (_: unknown, p: Problem) => (
        <Button
          size="small"
          onClick={(event) => {
            event.stopPropagation();
            openHistoryDrawer(p);
          }}
        >
          历史
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <Title level={3} style={{ margin: 0 }}>📋 题目列表</Title>
        <Space>
          <span style={{ color: '#666' }}>视角用户</span>
          <Select
            style={{ width: 180 }}
            value={viewUserId}
            onChange={onChangeViewUser}
            options={profiles.map(p => ({ value: p.id, label: p.name }))}
          />
        </Space>
      </Space>

      <Space style={{ marginBottom: 16 }} wrap>
        <Search
          placeholder="搜索题号或标题"
          allowClear
          style={{ width: 250 }}
          onSearch={setSearch}
          onChange={e => setSearch(e.target.value)}
        />
        <Select
          placeholder="难度筛选"
          allowClear
          style={{ width: 120 }}
          onChange={(v) => setDiffFilter(v || '')}
          options={[
            { label: 'Easy', value: 'Easy' },
            { label: 'Medium', value: 'Medium' },
            { label: 'Hard', value: 'Hard' },
          ]}
        />
        <Select
          placeholder="分类筛选"
          allowClear
          style={{ width: 150 }}
          onChange={(v) => setCatFilter(v || '')}
          options={categories.map(c => ({ label: c, value: c }))}
        />
      </Space>

      <Table
        dataSource={filtered}
        columns={columns}
        rowKey="id"
        pagination={{ pageSize: 20 }}
        onRow={(record) => ({
          onClick: () => navigate(`/problems/${record.id}`),
          style: { cursor: 'pointer' },
        })}
      />

      <Drawer
        title="📜 题目历史记录"
        placement="right"
        open={historyDrawerOpen}
        width={560}
        onClose={() => setHistoryDrawerOpen(false)}
      >
        {!historyProblem ? (
          <Empty description="请先选择题目" />
        ) : historyLoading ? (
          <div style={{ minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spin />
          </div>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Card size="small">
              <Space wrap>
                <Text strong>{historyProblem.number}. {historyProblem.title}</Text>
                <Tag color={difficultyColor[historyProblem.difficulty]}>{historyProblem.difficulty}</Tag>
                <Tag>{historyProblem.category}</Tag>
              </Space>
            </Card>

            <Card size="small" title="🏁 个人完成记录">
              {historyPersonalBest?.has_record ? (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Alert
                    type="success"
                    showIcon
                    message={`历史最佳：${formatDuration(historyPersonalBest.best_time ?? 0)}`}
                    description={historyPersonalBest.created_at ? `记录创建于 ${dayjs(historyPersonalBest.created_at).format('YYYY-MM-DD HH:mm')}` : ''}
                  />
                  <List
                    size="small"
                    bordered
                    dataSource={historyPersonalBest.records}
                    locale={{ emptyText: '暂无通过记录' }}
                    renderItem={(item) => (
                      <List.Item>
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                          <Tag color="processing">{formatDuration(item.time_spent)}</Tag>
                          <Text type="secondary">{dayjs(item.created_at).format('MM-DD HH:mm')}</Text>
                        </Space>
                      </List.Item>
                    )}
                  />
                </Space>
              ) : (
                <Text type="secondary">还没有通过记录。</Text>
              )}
            </Card>

            <Card size="small" title="📜 提交历史">
              <List
                size="small"
                dataSource={historySubmissions}
                locale={{ emptyText: '暂无提交记录' }}
                renderItem={(item) => (
                  <List.Item>
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                        <span>
                          {item.is_passed
                            ? <Tag color="success">通过</Tag>
                            : <Tag color="error">未通过</Tag>
                          }
                          {item.test_cases_passed}/{item.test_cases_total} 用例
                        </span>
                        <Text type="secondary">{formatDuration(item.time_spent)}</Text>
                      </Space>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        提交时间：{dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')}
                      </Text>
                      {item.feedback && <Text type="secondary" style={{ fontSize: 12 }}>{item.feedback}</Text>}
                      {item.ai_feedback && (
                        <Alert
                          type={item.is_passed ? 'info' : 'warning'}
                          message={item.is_passed ? 'AI 优化建议' : 'AI 纠错分析'}
                          description={<AiMarkdown content={item.ai_feedback} />}
                          showIcon
                        />
                      )}
                    </Space>
                  </List.Item>
                )}
              />
            </Card>
          </Space>
        )}
      </Drawer>
    </div>
  );
}
