import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Row, Col, Typography, Tag, Button, Space, Input,
  Form, InputNumber, Switch, Divider, message, Modal, Collapse, List,
} from 'antd';
import { ArrowLeftOutlined, EyeOutlined, SendOutlined } from '@ant-design/icons';
import Timer from '../components/Timer';
import CodeEditor from '../components/CodeEditor';
import { problemsApi, submissionsApi, notesApi, Problem, Submission, Note } from '../api';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface Props {
  userId: number;
  userName: string;
}

export default function ProblemDetail({ userId, userName }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [code, setCode] = useState('');
  const [timeSpent, setTimeSpent] = useState(0);
  const [isPassed, setIsPassed] = useState(true);
  const [casesTotal, setCasesTotal] = useState(0);
  const [casesPassed, setCasesPassed] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [note, setNote] = useState('');
  const [showSolution, setShowSolution] = useState(false);
  const [solution, setSolution] = useState<{ solution_code: string; solution_explanation: string } | null>(null);
  const [history, setHistory] = useState<Submission[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const noteTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!id) return;
    problemsApi.get(Number(id)).then(setProblem);
    submissionsApi.list({ user: userId, problem: Number(id) }).then(setHistory);
    notesApi.get(userId, Number(id)).then((n: Note | null) => {
      if (n) setNote(n.content);
    });
  }, [id, userId]);

  const handleSubmit = async () => {
    if (!problem || !code.trim()) {
      message.warning('请先粘贴代码');
      return;
    }
    setSubmitting(true);
    try {
      await submissionsApi.create({
        user: userId,
        problem: problem.id,
        code,
        time_spent: timeSpent,
        is_passed: isPassed,
        test_cases_total: casesTotal,
        test_cases_passed: casesPassed,
        feedback,
      });
      message.success('提交成功！');
      // 刷新历史
      submissionsApi.list({ user: userId, problem: problem.id }).then(setHistory);
      // 重置表单
      setCode('');
      setFeedback('');
    } catch {
      message.error('提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewSolution = async () => {
    if (!problem) return;
    if (!solution) {
      const data = await problemsApi.solution(problem.id);
      setSolution(data);
    }
    setShowSolution(true);
  };

  // 笔记自动保存（防抖1.5秒）
  const handleNoteChange = useCallback((value: string) => {
    setNote(value);
    if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    noteTimerRef.current = window.setTimeout(() => {
      if (id) {
        notesApi.save({ user: userId, problem: Number(id), content: value });
      }
    }, 1500);
  }, [id, userId]);

  if (!problem) return null;

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/problems')}>返回</Button>
        <Title level={4} style={{ margin: 0 }}>
          {problem.number}. {problem.title}
        </Title>
        <Tag color={problem.difficulty === 'Easy' ? 'green' : problem.difficulty === 'Medium' ? 'orange' : 'red'}>
          {problem.difficulty}
        </Tag>
        <Tag>{problem.category}</Tag>
        {problem.leetcode_url && (
          <a href={`https://leetcode.cn/problems/`} target="_blank" rel="noopener noreferrer">
            LeetCode 链接
          </a>
        )}
      </Space>

      <Row gutter={24}>
        {/* 左列：计时 + 代码 + 提交 */}
        <Col span={14}>
          <Card title="⏱️ 计时做题" style={{ marginBottom: 16 }}>
            <Timer onTimeUpdate={setTimeSpent} difficulty={problem.difficulty} />
          </Card>

          <Card title="💻 代码提交" style={{ marginBottom: 16 }}>
            <CodeEditor value={code} onChange={setCode} />
            <Divider />
            <Form layout="inline" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <Form.Item label="是否通过">
                <Switch checked={isPassed} onChange={setIsPassed} checkedChildren="通过" unCheckedChildren="未通过" />
              </Form.Item>
              <Form.Item label="总用例数">
                <InputNumber min={0} value={casesTotal} onChange={v => setCasesTotal(v || 0)} />
              </Form.Item>
              <Form.Item label="通过用例">
                <InputNumber min={0} value={casesPassed} onChange={v => setCasesPassed(v || 0)} />
              </Form.Item>
            </Form>
            <TextArea
              rows={2}
              placeholder="写下优化建议或反馈..."
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              style={{ marginBottom: 12 }}
            />
            <Space>
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSubmit}
                loading={submitting}
                size="large"
              >
                提交记录
              </Button>
              <Button icon={<EyeOutlined />} onClick={handleViewSolution}>
                查看参考答案
              </Button>
            </Space>
          </Card>
        </Col>

        {/* 右列：笔记 + 历史 */}
        <Col span={10}>
          <Card title={`📝 ${userName} 的笔记`} style={{ marginBottom: 16 }}>
            <TextArea
              rows={8}
              value={note}
              onChange={e => handleNoteChange(e.target.value)}
              placeholder="记录薄弱点、关键思路、易错点...（自动保存）"
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
              支持 Markdown 格式，1.5秒后自动保存
            </Text>
          </Card>

          <Card title="📜 提交历史">
            <List
              size="small"
              dataSource={history}
              locale={{ emptyText: '暂无提交记录' }}
              renderItem={(item: Submission) => (
                <List.Item>
                  <Space direction="vertical" size={0} style={{ width: '100%' }}>
                    <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                      <span>
                        {item.is_passed
                          ? <Tag color="success">通过</Tag>
                          : <Tag color="error">未通过</Tag>
                        }
                        {item.test_cases_passed}/{item.test_cases_total} 用例
                      </span>
                      <Text type="secondary">
                        {Math.floor(item.time_spent / 60)}分{item.time_spent % 60}秒
                      </Text>
                    </Space>
                    {item.feedback && <Text type="secondary" style={{ fontSize: 12 }}>{item.feedback}</Text>}
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title="参考答案"
        open={showSolution}
        onCancel={() => setShowSolution(false)}
        footer={null}
        width={700}
      >
        {solution && (
          <>
            <Title level={5}>解题思路</Title>
            <Paragraph>{solution.solution_explanation || '暂无解题思路'}</Paragraph>
            <Title level={5}>Java 参考代码</Title>
            <pre style={{
              background: '#1e1e1e',
              color: '#d4d4d4',
              padding: 16,
              borderRadius: 8,
              overflow: 'auto',
              maxHeight: 400,
            }}>
              {solution.solution_code || '暂无参考代码，请在 Admin 后台录入'}
            </pre>
          </>
        )}
      </Modal>
    </div>
  );
}
