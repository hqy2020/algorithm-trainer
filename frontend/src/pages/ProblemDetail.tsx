import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Typography,
  Tag,
  Button,
  Space,
  Input,
  Form,
  InputNumber,
  Switch,
  Divider,
  message,
  Modal,
  Alert,
  Select,
  Segmented,
} from 'antd';
import {
  ArrowLeftOutlined,
  EyeOutlined,
  SendOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  RedoOutlined,
} from '@ant-design/icons';
import Timer, { type TimerHandle } from '../components/Timer';
import CodeEditor from '../components/CodeEditor';
import AiMarkdown from '../components/AiMarkdown';
import {
  problemsApi,
  submissionsApi,
  notesApi,
  Problem,
  PersonalBest,
  Profile,
} from '../api';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

type BattleMode = 'single' | 'duel';
type DuelTimerAction = 'start' | 'pause' | 'reset';

interface Props {
  profiles: Profile[];
  battleMode: BattleMode;
  onChangeBattleMode: (mode: BattleMode) => void;
  battleUserAId: number;
  battleUserBId: number | null;
  onChangeBattleUserA: (userId: number) => void;
  onChangeBattleUserB: (userId: number) => void;
}

interface PlayerPanelProps {
  user: Profile;
  problem: Problem;
  onViewSolution: () => void;
  onBestChange: (value: PersonalBest | null) => void;
  timerControlsEnabled?: boolean;
  duelTimerAction?: DuelTimerAction | null;
  duelTimerVersion?: number;
}

function PlayerPanel({
  user,
  problem,
  onViewSolution,
  onBestChange,
  timerControlsEnabled = true,
  duelTimerAction = null,
  duelTimerVersion = 0,
}: PlayerPanelProps) {
  const [code, setCode] = useState('');
  const [timeSpent, setTimeSpent] = useState(0);
  const [isPassed, setIsPassed] = useState(true);
  const [casesTotal, setCasesTotal] = useState(0);
  const [casesPassed, setCasesPassed] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentAiReview, setCurrentAiReview] = useState<{ text: string; isPassed: boolean } | null>(null);

  const noteTimerRef = useRef<number | null>(null);
  const timerRef = useRef<TimerHandle | null>(null);

  const loadPlayerData = useCallback(async () => {
    const [bestData, noteData] = await Promise.all([
      submissionsApi.personalBest(user.id, problem.id),
      notesApi.get(user.id, problem.id),
    ]);
    setNote(noteData?.content || '');
    onBestChange(bestData);
  }, [onBestChange, problem.id, user.id]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      submissionsApi.personalBest(user.id, problem.id),
      notesApi.get(user.id, problem.id),
    ]).then(([bestData, noteData]) => {
      if (cancelled) return;
      setNote(noteData?.content || '');
      onBestChange(bestData);
    });

    return () => {
      cancelled = true;
      if (noteTimerRef.current) {
        clearTimeout(noteTimerRef.current);
      }
    };
  }, [onBestChange, problem.id, user.id]);

  const handleSubmit = async () => {
    const submitTime = timerRef.current?.getSeconds() ?? timeSpent;
    timerRef.current?.pause();

    if (!code.trim()) {
      message.warning(`${user.name}：请先粘贴代码`);
      return;
    }
    setSubmitting(true);
    try {
      const result = await submissionsApi.create({
        user: user.id,
        problem: problem.id,
        code,
        time_spent: submitTime,
        is_passed: isPassed,
        test_cases_total: casesTotal,
        test_cases_passed: casesPassed,
        feedback,
      });

      if (result.is_passed && result.is_new_record) {
        if (result.is_first_pass) {
          message.success(`${user.name} 首次通过，已建立个人记录！`);
        } else {
          const prev = result.previous_best || 0;
          const delta = prev - result.time_spent;
          message.success(`${user.name} 破记录！比历史最佳快 ${Math.max(delta, 0)} 秒`);
        }
      } else {
        message.success(`${user.name} 提交成功`);
      }

      if (result.ai_feedback) {
        setCurrentAiReview({ text: result.ai_feedback, isPassed: result.is_passed });
        message.info(`${user.name} 的 AI 评估已生成`);
      } else {
        setCurrentAiReview(null);
        message.warning(`${user.name} 本次未生成 AI 评估，请检查后台 AI 配置`);
      }

      await loadPlayerData();
      setCode('');
      setFeedback('');
    } catch {
      message.error(`${user.name} 提交失败`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNoteChange = useCallback((value: string) => {
    setNote(value);
    if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    noteTimerRef.current = window.setTimeout(() => {
      notesApi.save({ user: user.id, problem: problem.id, content: value });
    }, 1500);
  }, [problem.id, user.id]);

  useEffect(() => {
    // 切换用户或题目时，不展示历史 AI 回评；仅展示本次提交触发的回评
    setCurrentAiReview(null);
  }, [problem.id, user.id]);

  useEffect(() => {
    if (!duelTimerAction || duelTimerVersion <= 0 || !timerRef.current) return;
    if (duelTimerAction === 'start') timerRef.current.start();
    if (duelTimerAction === 'pause') timerRef.current.pause();
    if (duelTimerAction === 'reset') timerRef.current.reset();
  }, [duelTimerAction, duelTimerVersion]);

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Card title={`⏱️ ${user.name} 计时做题`}>
        <Timer
          ref={timerRef}
          onTimeUpdate={setTimeSpent}
          difficulty={problem.difficulty}
          controlsEnabled={timerControlsEnabled}
        />
      </Card>

      <Card title={`💻 ${user.name} 代码提交`}>
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
          <Button icon={<EyeOutlined />} onClick={onViewSolution}>
            查看参考答案
          </Button>
        </Space>
      </Card>

      <Card title={`📝 ${user.name} 的笔记`}>
        <TextArea
          rows={6}
          value={note}
          onChange={e => handleNoteChange(e.target.value)}
          placeholder="记录薄弱点、关键思路、易错点...（自动保存）"
        />
        <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
          支持 Markdown 格式，1.5秒后自动保存
        </Text>
        <Divider style={{ margin: '12px 0' }} />
        <Text strong style={{ display: 'block', marginBottom: 8 }}>Markdown 预览</Text>
        <div style={{ minHeight: 80, background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, padding: 12 }}>
          {note.trim()
            ? <AiMarkdown content={note} />
            : <Text type="secondary">暂无内容，输入 Markdown 后会在这里实时预览。</Text>}
        </div>
      </Card>

      <Card title={`🤖 ${user.name} AI 回评`}>
        {currentAiReview ? (
          <Alert
            type={currentAiReview.isPassed ? 'info' : 'warning'}
            showIcon
            message={currentAiReview.isPassed ? '通过后优化建议' : '未通过纠错建议'}
            description={<AiMarkdown content={currentAiReview.text} />}
          />
        ) : (
          <Text type="secondary">提交后会在这里显示本次 AI 回评。</Text>
        )}
      </Card>
    </Space>
  );
}

export default function ProblemDetail({
  profiles,
  battleMode,
  onChangeBattleMode,
  battleUserAId,
  battleUserBId,
  onChangeBattleUserA,
  onChangeBattleUserB,
}: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [allProblems, setAllProblems] = useState<Problem[]>([]);
  const [showSolution, setShowSolution] = useState(false);
  const [solution, setSolution] = useState<{ solution_code: string; solution_explanation: string } | null>(null);
  const [bestA, setBestA] = useState<PersonalBest | null>(null);
  const [bestB, setBestB] = useState<PersonalBest | null>(null);
  const [duelTimerAction, setDuelTimerAction] = useState<DuelTimerAction | null>(null);
  const [duelTimerVersion, setDuelTimerVersion] = useState(0);

  useEffect(() => {
    problemsApi.list().then(setAllProblems);
  }, []);

  useEffect(() => {
    if (!id) return;
    problemsApi.get(Number(id)).then(setProblem);
  }, [id]);

  const userA = profiles.find(p => p.id === battleUserAId) || profiles[0] || null;
  const fallbackB = userA ? profiles.find(p => p.id !== userA.id) : null;
  const selectedB = battleUserBId ? profiles.find(p => p.id === battleUserBId) : null;
  const userB = selectedB && userA && selectedB.id !== userA.id ? selectedB : fallbackB || null;

  const isDuelMode = battleMode === 'duel' && !!userB;

  useEffect(() => {
    setBestA(null);
  }, [battleUserAId, problem?.id]);

  useEffect(() => {
    setBestB(null);
  }, [battleUserBId, problem?.id]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}分${secs}秒`;
  };

  const handleViewSolution = async () => {
    if (!problem) return;
    if (!solution) {
      const data = await problemsApi.solution(problem.id);
      setSolution(data);
    }
    setShowSolution(true);
  };

  const dispatchDuelTimerAction = (action: DuelTimerAction) => {
    setDuelTimerAction(action);
    setDuelTimerVersion(prev => prev + 1);
  };

  if (!problem || !userA) return null;

  const currentIndex = allProblems.findIndex(p => p.id === problem.id);
  const prevProblem = currentIndex > 0 ? allProblems[currentIndex - 1] : null;
  const nextProblem = currentIndex >= 0 && currentIndex < allProblems.length - 1
    ? allProblems[currentIndex + 1]
    : null;
  const suggestedMinutes = Number(problem.time_standard);
  const duelSuggestedTimeText = Number.isFinite(suggestedMinutes) && suggestedMinutes > 0
    ? `本题建议用时：${suggestedMinutes} 分钟`
    : '本题建议用时：未设置';

  let battleAlert: { type: 'success' | 'warning' | 'info'; message: string; description: string } | null = null;
  if (isDuelMode && userB) {
    const aHas = !!(bestA?.has_record && bestA.best_time !== null);
    const bHas = !!(bestB?.has_record && bestB.best_time !== null);
    const baseRule = '判定规则：通过优先 + 最佳通过用时更短。';

    if (!aHas && !bHas) {
      battleAlert = {
        type: 'info',
        message: '未分胜负',
        description: `双方都还没有通过记录。${baseRule}`,
      };
    } else if (aHas && !bHas) {
      battleAlert = {
        type: 'success',
        message: `${userA.name} 领先`,
        description: `${userA.name} 已通过，${userB.name} 暂未通过。${baseRule}`,
      };
    } else if (!aHas && bHas) {
      battleAlert = {
        type: 'success',
        message: `${userB.name} 领先`,
        description: `${userB.name} 已通过，${userA.name} 暂未通过。${baseRule}`,
      };
    } else if ((bestA?.best_time ?? 0) < (bestB?.best_time ?? 0)) {
      const delta = (bestB?.best_time ?? 0) - (bestA?.best_time ?? 0);
      battleAlert = {
        type: 'success',
        message: `${userA.name} 领先`,
        description: `最佳通过用时 ${formatDuration(bestA?.best_time ?? 0)}，领先 ${delta} 秒。${baseRule}`,
      };
    } else if ((bestA?.best_time ?? 0) > (bestB?.best_time ?? 0)) {
      const delta = (bestA?.best_time ?? 0) - (bestB?.best_time ?? 0);
      battleAlert = {
        type: 'success',
        message: `${userB.name} 领先`,
        description: `最佳通过用时 ${formatDuration(bestB?.best_time ?? 0)}，领先 ${delta} 秒。${baseRule}`,
      };
    } else {
      battleAlert = {
        type: 'warning',
        message: '平局',
        description: `双方最佳通过用时都是 ${formatDuration(bestA?.best_time ?? 0)}。${baseRule}`,
      };
    }
  }

  const userBOptions = profiles
    .filter(p => p.id !== userA.id)
    .map(p => ({ value: p.id, label: p.name }));

  return (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/problems')}>返回</Button>
        <Title level={4} style={{ margin: 0 }}>
          {problem.number}. {problem.title}
        </Title>
        <Tag color="blue">Hot100 #{problem.hot100_order}</Tag>
        <Tag color={problem.difficulty === 'Easy' ? 'green' : problem.difficulty === 'Medium' ? 'orange' : 'red'}>
          {problem.difficulty}
        </Tag>
        <Tag>{problem.category}</Tag>
        {problem.leetcode_url && (
          <a href={problem.leetcode_url} target="_blank" rel="noopener noreferrer">
            LeetCode 链接
          </a>
        )}
        <Button disabled={!prevProblem} onClick={() => prevProblem && navigate(`/problems/${prevProblem.id}`)}>
          上一题
        </Button>
        <Button disabled={!nextProblem} onClick={() => nextProblem && navigate(`/problems/${nextProblem.id}`)}>
          下一题
        </Button>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Text strong>模式</Text>
          <Segmented
            value={battleMode}
            onChange={value => onChangeBattleMode(value as BattleMode)}
            options={[
              { label: '单人模式', value: 'single' },
              { label: '双人对战', value: 'duel', disabled: profiles.length < 2 },
            ]}
          />
          <Text strong>用户A</Text>
          <Select
            style={{ width: 180 }}
            value={userA.id}
            onChange={onChangeBattleUserA}
            options={profiles.map(p => ({ value: p.id, label: p.name }))}
          />
          {battleMode === 'duel' && (
            <>
              <Text strong>用户B</Text>
              <Select
                style={{ width: 180 }}
                value={userB?.id}
                onChange={onChangeBattleUserB}
                options={userBOptions}
              />
            </>
          )}
        </Space>
      </Card>

      {isDuelMode && userB && (
        <Card style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Text type="secondary">{duelSuggestedTimeText}</Text>
            <Space wrap>
              <Text strong>对战计时</Text>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={() => dispatchDuelTimerAction('start')}
              >
                双方同时开始
              </Button>
              <Button
                icon={<PauseCircleOutlined />}
                onClick={() => dispatchDuelTimerAction('pause')}
              >
                双方同时暂停
              </Button>
              <Button
                icon={<RedoOutlined />}
                onClick={() => dispatchDuelTimerAction('reset')}
              >
                双方同时重置
              </Button>
            </Space>
          </Space>
        </Card>
      )}

      {battleAlert && (
        <Alert
          style={{ marginBottom: 16 }}
          type={battleAlert.type}
          showIcon
          message={battleAlert.message}
          description={battleAlert.description}
        />
      )}

      {isDuelMode && userB ? (
        <Row gutter={16}>
          <Col xs={24} xl={12}>
            <PlayerPanel
              key={`panel-a-${userA.id}-${problem.id}`}
              user={userA}
              problem={problem}
              onViewSolution={handleViewSolution}
              onBestChange={setBestA}
              timerControlsEnabled={false}
              duelTimerAction={duelTimerAction}
              duelTimerVersion={duelTimerVersion}
            />
          </Col>
          <Col xs={24} xl={12}>
            <PlayerPanel
              key={`panel-b-${userB.id}-${problem.id}`}
              user={userB}
              problem={problem}
              onViewSolution={handleViewSolution}
              onBestChange={setBestB}
              timerControlsEnabled={false}
              duelTimerAction={duelTimerAction}
              duelTimerVersion={duelTimerVersion}
            />
          </Col>
        </Row>
      ) : (
        <PlayerPanel
          key={`panel-single-${userA.id}-${problem.id}`}
          user={userA}
          problem={problem}
          onViewSolution={handleViewSolution}
          onBestChange={setBestA}
        />
      )}

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
