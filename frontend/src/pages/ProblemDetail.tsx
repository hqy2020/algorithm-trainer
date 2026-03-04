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
  TeamOutlined,
  LoginOutlined,
} from '@ant-design/icons';
import Timer, { type TimerHandle } from '../components/Timer';
import CodeEditor from '../components/CodeEditor';
import AiMarkdown from '../components/AiMarkdown';
import { playToneSequence, primeAudio } from '../utils/sound';
import {
  problemsApi,
  submissionsApi,
  notesApi,
  roomsApi,
  AiUsageTokens,
  AiStreamEvent,
  LatestSubmissionSummary,
  Problem,
  PersonalBest,
  Profile,
  RoomInfo,
  RoomStreamEvent,
} from '../api';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

type BattleMode = 'single' | 'room';
type DuelTimerAction = 'start' | 'pause' | 'reset';
type DuelTimerSyncState = {
  action: DuelTimerAction;
  version: number;
  elapsed_seconds: number;
  // 双人对战状态
  user_a?: {
    id: number;
    status: 'not_started' | 'working' | 'submitted' | 'passed';
    submission: { is_passed: boolean; time_spent: number; created_at: string } | null;
  };
  user_b?: {
    id: number;
    status: 'not_started' | 'working' | 'submitted' | 'passed';
    submission: { is_passed: boolean; time_spent: number; created_at: string } | null;
  };
};

const EMPTY_USAGE: AiUsageTokens = {
  prompt_tokens: null,
  completion_tokens: null,
  total_tokens: null,
};

const normalizeUsageTokens = (usage?: Partial<AiUsageTokens> | null): AiUsageTokens => {
  const toToken = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
  return {
    prompt_tokens: toToken(usage?.prompt_tokens),
    completion_tokens: toToken(usage?.completion_tokens),
    total_tokens: toToken(usage?.total_tokens),
  };
};

const formatTokenCount = (value: number | null) => (value === null ? '--' : String(value));

const formatSubmissionTimestamp = (value?: string) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

const playSubmitBeep = () => {
  playToneSequence([
    { frequency: 1046, durationMs: 150, gain: 0.14, type: 'triangle' },
  ]);
};

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
  enableAlarmSound?: boolean;
  timerControlsEnabled?: boolean;
  duelTimerState?: DuelTimerSyncState | null;
  submissionSyncEnabled?: boolean;
  onSubmitSuccess?: () => void;
}

function PlayerPanel({
  user,
  problem,
  onViewSolution,
  onBestChange,
  enableAlarmSound = true,
  timerControlsEnabled = true,
  duelTimerState = null,
  submissionSyncEnabled = false,
  onSubmitSuccess,
}: PlayerPanelProps) {
  type AiReviewState = {
    text: string;
    isPassed: boolean;
    streaming: boolean;
    usage: AiUsageTokens;
    error: string | null;
  };

  const [code, setCode] = useState('');
  const [timeSpent, setTimeSpent] = useState(0);
  const [isPassed, setIsPassed] = useState(true);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [latestAiReview, setLatestAiReview] = useState<AiReviewState | null>(null);
  const [showAiReview, setShowAiReview] = useState(false);
  const [latestSubmission, setLatestSubmission] = useState<LatestSubmissionSummary | null>(null);

  const noteTimerRef = useRef<number | null>(null);
  const codeTimerRef = useRef<number | null>(null);
  const timerRef = useRef<TimerHandle | null>(null);
  const aiStreamRef = useRef<EventSource | null>(null);
  const latestSubmissionVersionRef = useRef(0);
  const codeDraftKey = `code_draft:v1:${user.id}:${problem.id}`;
  const suggestedMinutes = Number(problem.time_standard);
  const alertAtSeconds = Number.isFinite(suggestedMinutes) && suggestedMinutes > 0
    ? suggestedMinutes * 60
    : null;

  const closeAiStream = useCallback(() => {
    if (aiStreamRef.current) {
      aiStreamRef.current.close();
      aiStreamRef.current = null;
    }
  }, []);

  const saveCodeDraft = useCallback((value: string) => {
    try {
      localStorage.setItem(codeDraftKey, value);
    } catch {
      // 忽略本地存储异常，不影响做题流程。
    }
  }, [codeDraftKey]);

  const handleCodeChange = useCallback((value: string) => {
    setCode(value);
    if (codeTimerRef.current) clearTimeout(codeTimerRef.current);
    codeTimerRef.current = window.setTimeout(() => {
      saveCodeDraft(value);
    }, 600);
  }, [saveCodeDraft]);

  const startAiReviewStream = useCallback((submissionId: number, passed: boolean) => {
    closeAiStream();

    const stream = new EventSource(submissionsApi.aiReviewStreamUrl(submissionId));
    aiStreamRef.current = stream;

    stream.onmessage = (event) => {
      let payload: AiStreamEvent | null = null;
      try {
        payload = JSON.parse(event.data) as AiStreamEvent;
      } catch {
        return;
      }
      if (!payload) return;

      if (payload.type === 'chunk') {
        setLatestAiReview(prev => ({
          text: `${prev?.text || ''}${payload.text || ''}`,
          isPassed: prev?.isPassed ?? passed,
          streaming: true,
          usage: prev?.usage || EMPTY_USAGE,
          error: null,
        }));
        return;
      }

      if (payload.type === 'done') {
        setLatestAiReview(prev => ({
          text: payload.text || prev?.text || '',
          isPassed: prev?.isPassed ?? passed,
          streaming: false,
          usage: normalizeUsageTokens(payload.usage),
          error: null,
        }));
        closeAiStream();
        message.info(`${user.name} 的 AI 评估已完成`);
        return;
      }

      if (payload.type === 'error') {
        setLatestAiReview(prev => ({
          text: prev?.text || '',
          isPassed: prev?.isPassed ?? passed,
          streaming: false,
          usage: prev?.usage || EMPTY_USAGE,
          error: payload.message || 'AI 评估失败',
        }));
        closeAiStream();
      }
    };

    stream.onerror = () => {
      setLatestAiReview(prev => {
        if (!prev || !prev.streaming) return prev;
        return {
          ...prev,
          streaming: false,
          error: prev.error || 'AI 流连接中断，请稍后重试',
        };
      });
      closeAiStream();
    };
  }, [closeAiStream, user.name]);

  const loadBestData = useCallback(async () => {
    const bestData = await submissionsApi.personalBest(user.id, problem.id);
    onBestChange(bestData);
  }, [onBestChange, problem.id, user.id]);

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
      submissionsApi.list({ user: user.id, problem: problem.id }),
    ]).then(([bestData, noteData, submissionData]) => {
      if (cancelled) return;
      setNote(noteData?.content || '');
      onBestChange(bestData);
      const storedAi = submissionData.find(item => (item.ai_feedback || '').trim());
      if (storedAi) {
        setLatestAiReview({
          text: storedAi.ai_feedback,
          isPassed: storedAi.is_passed,
          streaming: false,
          usage: EMPTY_USAGE,
          error: null,
        });
      } else {
        setLatestAiReview(null);
      }
      const latest = submissionData[0];
      setLatestSubmission(latest ? {
        id: latest.id,
        is_passed: latest.is_passed,
        is_code_only: latest.is_code_only,
        time_spent: latest.time_spent,
        created_at: latest.created_at,
      } : null);
      latestSubmissionVersionRef.current = latest?.id || 0;
      let localDraft = '';
      try {
        localDraft = localStorage.getItem(codeDraftKey) || '';
      } catch {
        localDraft = '';
      }
      setCode(localDraft || submissionData[0]?.code || '');
    });
    closeAiStream();
    setShowAiReview(false);

    return () => {
      cancelled = true;
      if (noteTimerRef.current) {
        clearTimeout(noteTimerRef.current);
      }
      if (codeTimerRef.current) {
        clearTimeout(codeTimerRef.current);
      }
      closeAiStream();
    };
  }, [closeAiStream, codeDraftKey, onBestChange, problem.id, user.id]);

  useEffect(() => {
    if (!submissionSyncEnabled) return;
    let stopped = false;

    const syncOnce = async () => {
      try {
        const state = await submissionsApi.latest(user.id, problem.id);
        if (stopped) return;
        if (state.version === latestSubmissionVersionRef.current) return;
        latestSubmissionVersionRef.current = state.version;
        setLatestSubmission(state.submission);
        await loadBestData();
      } catch {
        // 忽略轮询异常，下一轮自动重试。
      }
    };

    void syncOnce();
    const timerId = window.setInterval(() => {
      void syncOnce();
    }, 1000);

    return () => {
      stopped = true;
      clearInterval(timerId);
    };
  }, [loadBestData, problem.id, submissionSyncEnabled, user.id]);

  const submitCode = async (codeOnly: boolean) => {
    if (!code.trim()) {
      message.warning(`${user.name}：请先粘贴代码`);
      return;
    }
    const submitTime = codeOnly ? 0 : (timerRef.current?.getSeconds() ?? timeSpent);
    if (!codeOnly) {
      timerRef.current?.pause();
    }
    saveCodeDraft(code);
    setSubmitting(true);
    try {
      const result = await submissionsApi.create({
        user: user.id,
        problem: problem.id,
        code,
        time_spent: submitTime,
        is_passed: isPassed,
        is_code_only: codeOnly,
      });
      latestSubmissionVersionRef.current = result.id;
      setLatestSubmission({
        id: result.id,
        is_passed: result.is_passed,
        is_code_only: result.is_code_only,
        time_spent: result.time_spent,
        created_at: result.created_at,
      });
      playSubmitBeep();

      if (codeOnly) {
        message.success(`${user.name} 代码已保存为最终版（不计时）`);
        closeAiStream();
        await loadPlayerData();
        return;
      }

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

      // 通知父组件提交成功
      onSubmitSuccess?.();

      setLatestAiReview({
        text: '',
        isPassed: result.is_passed,
        streaming: true,
        usage: EMPTY_USAGE,
        error: null,
      });
      startAiReviewStream(result.id, result.is_passed);

      await loadPlayerData();
    } catch {
      message.error(`${user.name} 提交失败`);
      closeAiStream();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitTimed = () => {
    primeAudio();
    void submitCode(false);
  };

  const handleSubmitCodeOnly = () => {
    primeAudio();
    void submitCode(true);
  };

  const handleNoteChange = useCallback((value: string) => {
    setNote(value);
    if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    noteTimerRef.current = window.setTimeout(() => {
      notesApi.save({ user: user.id, problem: problem.id, content: value });
    }, 1500);
  }, [problem.id, user.id]);

  useEffect(() => {
    if (!duelTimerState || duelTimerState.version <= 0 || !timerRef.current) return;
    timerRef.current.setElapsed(duelTimerState.elapsed_seconds);
    if (duelTimerState.action === 'start') timerRef.current.start();
    if (duelTimerState.action === 'pause') timerRef.current.pause();
    if (duelTimerState.action === 'reset') timerRef.current.reset();
  }, [duelTimerState]);

  const latestSubmissionLabel = latestSubmission
    ? latestSubmission.is_code_only
      ? '仅代码已提交'
      : latestSubmission.is_passed
      ? '已通过提交'
      : '已提交未通过'
    : '未提交';

  const latestSubmissionTagColor = !latestSubmission
    ? undefined
    : latestSubmission.is_code_only
    ? 'blue'
    : latestSubmission.is_passed
    ? 'green'
    : 'orange';

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Card title={`⏱️ ${user.name} 计时做题`}>
        <Timer
          ref={timerRef}
          onTimeUpdate={setTimeSpent}
          difficulty={problem.difficulty}
          controlsEnabled={timerControlsEnabled}
          alertAtSeconds={alertAtSeconds}
          enableAlarmSound={enableAlarmSound}
        />
      </Card>

      <Card
        title={`💻 ${user.name} 代码提交`}
        extra={(
          <Space size={8}>
            <Tag color={latestSubmissionTagColor}>{latestSubmissionLabel}</Tag>
            {latestSubmission && (
              <Text type="secondary">
                {formatSubmissionTimestamp(latestSubmission.created_at)}
              </Text>
            )}
          </Space>
        )}
      >
        <CodeEditor value={code} onChange={handleCodeChange} />
        <Divider />
        <Form layout="inline" style={{ marginBottom: 16 }}>
          <Form.Item label="是否通过">
            <Switch checked={isPassed} onChange={setIsPassed} checkedChildren="通过" unCheckedChildren="未通过" />
          </Form.Item>
        </Form>
        <Space>
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSubmitTimed}
            loading={submitting}
            size="large"
          >
            提交记录（计时）
          </Button>
          <Button
            onClick={handleSubmitCodeOnly}
            loading={submitting}
            size="large"
          >
            仅提交代码
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

      <Card
        title={`🤖 ${user.name} AI 回评`}
        extra={(
          <Button
            size="small"
            disabled={!latestAiReview}
            onClick={() => setShowAiReview(prev => !prev)}
          >
            {showAiReview ? '隐藏回评' : '显示回评'}
          </Button>
        )}
      >
        {!showAiReview ? (
          latestAiReview ? (
            <Text type="secondary">
              已保存最后一次 AI 回评，点击右上角“显示回评”查看。
            </Text>
          ) : (
            <Text type="secondary">暂无 AI 回评。</Text>
          )
        ) : latestAiReview ? (
          <Alert
            type={latestAiReview.isPassed ? 'info' : 'warning'}
            showIcon
            message={latestAiReview.isPassed ? '通过后优化建议' : '未通过纠错建议'}
            description={(
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                {latestAiReview.text.trim()
                  ? <AiMarkdown content={latestAiReview.text} />
                  : <Text type="secondary">AI 正在实时生成...</Text>}
                {latestAiReview.streaming && <Text type="secondary">流式返回中...</Text>}
                {!latestAiReview.streaming && (
                  <>
                    <Text type="secondary">
                      Token 消耗：prompt {formatTokenCount(latestAiReview.usage.prompt_tokens)}
                      {' '}| completion {formatTokenCount(latestAiReview.usage.completion_tokens)}
                      {' '}| total {formatTokenCount(latestAiReview.usage.total_tokens)}
                    </Text>
                    {latestAiReview.usage.prompt_tokens === null
                      && latestAiReview.usage.completion_tokens === null
                      && latestAiReview.usage.total_tokens === null && (
                        <Text type="secondary">模型未返回 token 统计。</Text>
                    )}
                  </>
                )}
                {latestAiReview.error && <Text type="danger">{latestAiReview.error}</Text>}
              </Space>
            )}
          />
        ) : (
          <Text type="secondary">暂无 AI 回评。</Text>
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
  const [duelTimerState, setDuelTimerState] = useState<DuelTimerSyncState | null>(null);
  // 房间相关状态
  const [roomModalVisible, setRoomModalVisible] = useState(false);
  const [roomModalMode, setRoomModalMode] = useState<'create' | 'join'>('create');
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [currentRoom, setCurrentRoom] = useState<RoomInfo | null>(null);
  const [roomStream, setRoomStream] = useState<EventSource | null>(null);
  const duelTimerVersionRef = useRef(0);
  const duelTimerInitialSyncedRef = useRef(false);
  const duelTimerPollingErrorNotifiedRef = useRef(false);
  const duelTimerStreamRef = useRef<EventSource | null>(null);

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
  const userBForDisplay = selectedB && userA && selectedB.id !== userA.id ? selectedB : fallbackB || null;

  // 房间模式下，有房间时才是真正的对战状态
  const isRoomMode = battleMode === 'room' && !!currentRoom;
  // 从房间获取对手信息（优先使用房间中的对手）
  const roomUserB = currentRoom?.user_b ? {
    id: currentRoom.user_b.id,
    name: currentRoom.user_b.name,
    color: currentRoom.user_b.color,
  } : null;
  // 使用房间中的对手，如果没有则使用原来的 fallback
  const userBForDisplayForDisplay = roomUserB || userBForDisplay;
  // 实际对战状态
  const isDuelMode = isRoomMode;

  useEffect(() => {
    setBestA(null);
  }, [battleUserAId, problem?.id]);

  useEffect(() => {
    setBestB(null);
  }, [battleUserBId, problem?.id]);

  useEffect(() => {
    duelTimerVersionRef.current = 0;
    duelTimerInitialSyncedRef.current = false;
    setDuelTimerState(null);
    duelTimerPollingErrorNotifiedRef.current = false;
  }, [problem?.id]);

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

  // ===== 房间相关处理函数 =====
  const openCreateRoomModal = () => {
    setRoomModalMode('create');
    setRoomModalVisible(true);
  };

  const openJoinRoomModal = () => {
    setRoomModalMode('join');
    setJoinRoomCode('');
    setRoomModalVisible(true);
  };

  const handleCreateRoom = async () => {
    if (!problem || !userA) return;
    try {
      const room = await roomsApi.create(userA.id, problem.id);
      setCurrentRoom(room);
      message.success(`房间创建成功！房间号：${room.room_code}`);
      setRoomModalVisible(false);
      // 自动加入房间的SSE流
      connectRoomStream(room.room_code);
    } catch (err) {
      message.error('创建房间失败');
    }
  };

  const handleJoinRoom = async () => {
    if (!userA || !joinRoomCode.trim()) return;
    try {
      const room = await roomsApi.join(joinRoomCode.trim(), userA.id);
      setCurrentRoom(room);
      message.success(`加入房间成功！`);
      setRoomModalVisible(false);
      // 自动加入房间的SSE流
      connectRoomStream(room.room_code);
    } catch (err) {
      message.error('加入房间失败，请检查房间号是否正确');
    }
  };

  const connectRoomStream = (roomCode: string) => {
    if (roomStream) {
      roomStream.close();
    }
    const stream = new EventSource(roomsApi.streamUrl(roomCode));
    setRoomStream(stream);

    stream.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as RoomStreamEvent;
        if (data.type === 'update') {
          // 更新房间状态和计时器
          if (data.timer) {
            setDuelTimerState({
              action: data.timer.action,
              version: data.timer.version,
              elapsed_seconds: data.timer.elapsed_seconds,
              user_a: data.user_a,
              user_b: data.user_b ?? undefined,
            });
          }
          if (data.status) {
            setCurrentRoom(prev => prev ? { ...prev, status: data.status as 'waiting' | 'active' | 'finished' } : null);
          }
        } else if (data.type === 'error') {
          message.warning(data.message || '房间连接错误');
        }
      } catch {
        // 忽略解析错误
      }
    };

    stream.onerror = () => {
      message.warning('房间连接中断，尝试重连...');
    };
  };

  const leaveRoom = () => {
    if (roomStream) {
      roomStream.close();
      setRoomStream(null);
    }
    setCurrentRoom(null);
    setDuelTimerState(null);
  };

  const applyDuelTimerState = useCallback((nextState: DuelTimerSyncState) => {
    setDuelTimerState(nextState);
    duelTimerVersionRef.current = nextState.version;
  }, []);

  const closeDuelTimerStream = useCallback(() => {
    if (duelTimerStreamRef.current) {
      duelTimerStreamRef.current.close();
      duelTimerStreamRef.current = null;
    }
  }, []);

  const dispatchDuelTimerAction = async (action: DuelTimerAction) => {
    if (!problem) return;
    primeAudio();
    try {
      const state = await submissionsApi.updateDuelTimerState(problem.id, action);
      applyDuelTimerState(state);
      duelTimerPollingErrorNotifiedRef.current = false;
    } catch {
      // 网络异常时降级为本地触发，避免按钮失效。
      setDuelTimerState(prev => {
        const fallbackState: DuelTimerSyncState = {
          action,
          version: duelTimerVersionRef.current + 1,
          elapsed_seconds: prev?.elapsed_seconds ?? 0,
        };
        duelTimerVersionRef.current = fallbackState.version;
        return fallbackState;
      });
      message.warning('计时同步服务暂不可用，已按本地控制执行');
    }
  };

  useEffect(() => {
    // 房间模式且有房间时，使用房间的 SSE 流（已由 connectRoomStream 处理）
    if (isRoomMode || !isDuelMode || !problem) {
      closeDuelTimerStream();
      return;
    }

    let stopped = false;
    closeDuelTimerStream();

    // 旧的对战模式（已弃用），保留用于兼容
    const stream = new EventSource(submissionsApi.duelTimerStreamUrl(problem.id, userA.id, userBForDisplayForDisplay?.id));
    duelTimerStreamRef.current = stream;

    stream.onopen = () => {
      duelTimerPollingErrorNotifiedRef.current = false;
    };

    stream.onmessage = (event) => {
      if (stopped) return;
      let state: DuelTimerSyncState | null = null;
      try {
        state = JSON.parse(event.data) as DuelTimerSyncState;
      } catch {
        return;
      }
      if (!state) return;

      if (!duelTimerInitialSyncedRef.current) {
        duelTimerInitialSyncedRef.current = true;
        applyDuelTimerState(state);
      } else if (state.version > duelTimerVersionRef.current) {
        applyDuelTimerState(state);
      }
      duelTimerPollingErrorNotifiedRef.current = false;
    };

    stream.onerror = () => {
      if (stopped) return;
      if (!duelTimerPollingErrorNotifiedRef.current) {
        duelTimerPollingErrorNotifiedRef.current = true;
        message.warning('对战计时实时同步暂时不可用，将自动重连');
      }
    };

    return () => {
      stopped = true;
      if (duelTimerStreamRef.current === stream) {
        closeDuelTimerStream();
      } else {
        stream.close();
      }
    };
  }, [applyDuelTimerState, closeDuelTimerStream, isDuelMode, problem]);

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
  if (isDuelMode && userBForDisplay) {
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
        description: `${userA.name} 已通过，${userBForDisplay.name} 暂未通过。${baseRule}`,
      };
    } else if (!aHas && bHas) {
      battleAlert = {
        type: 'success',
        message: `${userBForDisplay.name} 领先`,
        description: `${userBForDisplay.name} 已通过，${userA.name} 暂未通过。${baseRule}`,
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
        message: `${userBForDisplay.name} 领先`,
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

  const userBForDisplayOptions = profiles
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
              { label: '房间对战', value: 'room' },
            ]}
          />
          {battleMode === 'room' && !currentRoom && (
            <>
              <Button icon={<TeamOutlined />} onClick={openCreateRoomModal}>
                创建房间
              </Button>
              <Button icon={<LoginOutlined />} onClick={openJoinRoomModal}>
                加入房间
              </Button>
            </>
          )}
          {currentRoom && (
            <>
              <Tag color="green">房间号: {currentRoom.room_code}</Tag>
              <Tag color={currentRoom.status === 'active' ? 'blue' : currentRoom.status === 'waiting' ? 'orange' : 'default'}>
                {currentRoom.status === 'waiting' ? '等待中' : currentRoom.status === 'active' ? '进行中' : '已结束'}
              </Tag>
              {currentRoom.user_b && (
                <Text type="secondary">
                  {currentRoom.user_a.name} vs {currentRoom.user_b.name}
                </Text>
              )}
              <Button size="small" danger onClick={leaveRoom}>退出房间</Button>
            </>
          )}
          <Text strong>用户</Text>
          <Select
            style={{ width: 180 }}
            value={userA.id}
            onChange={onChangeBattleUserA}
            options={profiles.map(p => ({ value: p.id, label: p.name }))}
          />
        </Space>
      </Card>

      {isDuelMode && userBForDisplayForDisplay && (
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

      {isDuelMode && userBForDisplay ? (
        <Row gutter={16}>
          <Col xs={24} xl={12}>
            <Card size="small" style={{ marginBottom: 8 }}>
              <Space>
                <Text strong>{userBForDisplay.name} 的状态</Text>
                {duelTimerState?.user_b?.status === 'not_started' && <Tag>未开始</Tag>}
                {duelTimerState?.user_b?.status === 'working' && <Tag color="blue">做题中</Tag>}
                {duelTimerState?.user_b?.status === 'submitted' && <Tag color="orange">已提交</Tag>}
                {duelTimerState?.user_b?.status === 'passed' && <Tag color="green">已通过</Tag>}
              </Space>
            </Card>
            <PlayerPanel
              key={`panel-a-${userA.id}-${problem.id}`}
              user={userA}
              problem={problem}
              onViewSolution={handleViewSolution}
              onBestChange={setBestA}
              enableAlarmSound
              timerControlsEnabled={false}
              duelTimerState={duelTimerState}
              submissionSyncEnabled
              onSubmitSuccess={isDuelMode ? () => dispatchDuelTimerAction('pause') : undefined}
            />
          </Col>
          <Col xs={24} xl={12}>
            <Card size="small" style={{ marginBottom: 8 }}>
              <Space>
                <Text strong>{userA.name} 的状态</Text>
                {duelTimerState?.user_a?.status === 'not_started' && <Tag>未开始</Tag>}
                {duelTimerState?.user_a?.status === 'working' && <Tag color="blue">做题中</Tag>}
                {duelTimerState?.user_a?.status === 'submitted' && <Tag color="orange">已提交</Tag>}
                {duelTimerState?.user_a?.status === 'passed' && <Tag color="green">已通过</Tag>}
              </Space>
            </Card>
            <PlayerPanel
              key={`panel-b-${userBForDisplay.id}-${problem.id}`}
              user={userBForDisplay}
              problem={problem}
              onViewSolution={handleViewSolution}
              onBestChange={setBestB}
              enableAlarmSound={false}
              timerControlsEnabled={false}
              duelTimerState={duelTimerState}
              submissionSyncEnabled
              onSubmitSuccess={isDuelMode ? () => dispatchDuelTimerAction('pause') : undefined}
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
          enableAlarmSound
        />
      )}

      {/* 房间 Modal */}
      <Modal
        title={roomModalMode === 'create' ? '创建对战房间' : '加入对战房间'}
        open={roomModalVisible}
        onCancel={() => setRoomModalVisible(false)}
        footer={null}
        width={400}
      >
        {roomModalMode === 'create' ? (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Alert
              type="info"
              message="创建房间后，将生成一个4位房间号"
              description="将房间号告诉搭档，让他/她在同一网络下输入房间号加入对战。"
            />
            <Button type="primary" block onClick={handleCreateRoom} disabled={!problem || !userA}>
              创建房间（当前题目：{problem?.title}）
            </Button>
          </Space>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Alert
              type="info"
              message="输入房间号加入对战"
              description="请输入搭档告诉你的4位房间号。"
            />
            <Input
              placeholder="请输入4位房间号"
              value={joinRoomCode}
              onChange={e => setJoinRoomCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              maxLength={4}
              size="large"
              style={{ textAlign: 'center', letterSpacing: '0.5em' }}
            />
            <Button type="primary" block onClick={handleJoinRoom} disabled={joinRoomCode.length !== 4 || !userA}>
              加入房间
            </Button>
          </Space>
        )}
      </Modal>

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
