import { useEffect, useState } from 'react';
import { Table, Tag, Input, Select, Space, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { problemsApi, submissionsApi, Problem, Submission } from '../api';

const { Title } = Typography;
const { Search } = Input;

interface Props {
  userId: number;
}

const difficultyColor: Record<string, string> = {
  Easy: 'green',
  Medium: 'orange',
  Hard: 'red',
};

export default function ProblemList({ userId }: Props) {
  const navigate = useNavigate();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [search, setSearch] = useState('');
  const [diffFilter, setDiffFilter] = useState<string>('');
  const [catFilter, setCatFilter] = useState<string>('');

  useEffect(() => {
    problemsApi.list().then(setProblems);
    submissionsApi.list({ user: userId }).then(setSubmissions);
  }, [userId]);

  // 每道题的状态：已通过 / 已尝试 / 未做
  const statusMap = new Map<number, 'passed' | 'attempted'>();
  submissions.forEach(s => {
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
      render: (_: any, p: Problem) => {
        const status = statusMap.get(p.id);
        if (status === 'passed') return <Tag color="success">✓</Tag>;
        if (status === 'attempted') return <Tag color="warning">○</Tag>;
        return <Tag>-</Tag>;
      },
    },
    {
      title: '题号',
      dataIndex: 'number',
      width: 80,
      sorter: (a: Problem, b: Problem) => a.number - b.number,
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
  ];

  return (
    <div>
      <Title level={3}>📋 题目列表</Title>

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
    </div>
  );
}
