import { forwardRef, useState, useRef, useCallback, useEffect, useImperativeHandle, type ForwardedRef } from 'react';
import { Button, Space, Typography, Tag } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, RedoOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface Props {
  onTimeUpdate?: (seconds: number) => void;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  controlsEnabled?: boolean;
}

export interface TimerHandle {
  start: () => void;
  pause: () => void;
  reset: () => void;
  getSeconds: () => number;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getTimeRating(seconds: number, difficulty: string) {
  const minutes = seconds / 60;
  const thresholds: Record<string, [number, number]> = {
    Easy: [10, 15],
    Medium: [15, 25],
    Hard: [25, 40],
  };
  const [excellent, passing] = thresholds[difficulty] || [15, 25];
  if (minutes <= excellent) return { label: '优秀', color: '#52c41a' };
  if (minutes <= passing) return { label: '合格', color: '#faad14' };
  return { label: '需加强', color: '#f5222d' };
}

function TimerComponent(
  { onTimeUpdate, difficulty = 'Medium', controlsEnabled = true }: Props,
  ref: ForwardedRef<TimerHandle>,
) {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const elapsedBeforeStartRef = useRef(0);
  const onTimeUpdateRef = useRef(onTimeUpdate);

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  const clearTicker = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const getLiveSeconds = useCallback(() => {
    if (!runningRef.current || startedAtRef.current === null) {
      return elapsedBeforeStartRef.current;
    }
    const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
    return elapsedBeforeStartRef.current + Math.max(elapsed, 0);
  }, []);

  const syncSeconds = useCallback(() => {
    const next = getLiveSeconds();
    setSeconds(prev => {
      if (prev === next) return prev;
      onTimeUpdateRef.current?.(next);
      return next;
    });
  }, [getLiveSeconds]);

  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    startedAtRef.current = Date.now();
    clearTicker();
    intervalRef.current = window.setInterval(syncSeconds, 250);
    syncSeconds();
  }, [clearTicker, syncSeconds]);

  const pause = useCallback(() => {
    const current = getLiveSeconds();
    runningRef.current = false;
    setRunning(false);
    elapsedBeforeStartRef.current = current;
    startedAtRef.current = null;
    clearTicker();
    setSeconds(current);
    onTimeUpdateRef.current?.(current);
  }, [clearTicker, getLiveSeconds]);

  const reset = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    elapsedBeforeStartRef.current = 0;
    startedAtRef.current = null;
    clearTicker();
    setSeconds(0);
    onTimeUpdateRef.current?.(0);
  }, [clearTicker]);

  useImperativeHandle(ref, () => ({
    start,
    pause,
    reset,
    getSeconds: getLiveSeconds,
  }), [getLiveSeconds, pause, reset, start]);

  useEffect(() => {
    return () => {
      clearTicker();
    };
  }, [clearTicker]);

  useEffect(() => {
    const syncOnVisible = () => {
      if (!document.hidden) {
        syncSeconds();
      }
    };
    document.addEventListener('visibilitychange', syncOnVisible);
    window.addEventListener('focus', syncSeconds);
    return () => {
      document.removeEventListener('visibilitychange', syncOnVisible);
      window.removeEventListener('focus', syncSeconds);
    };
  }, [syncSeconds]);

  const rating = seconds > 0 ? getTimeRating(seconds, difficulty) : null;

  return (
    <Space direction="vertical" align="center" style={{ width: '100%' }}>
      <Text style={{ fontSize: 48, fontFamily: 'monospace', fontWeight: 'bold' }}>
        {formatTime(seconds)}
      </Text>
      {rating && <Tag color={rating.color}>{rating.label}</Tag>}
      {controlsEnabled ? (
        <Space>
          {!running ? (
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={start} size="large">
              {seconds > 0 ? '继续' : '开始'}
            </Button>
          ) : (
            <Button icon={<PauseCircleOutlined />} onClick={pause} size="large">
              暂停
            </Button>
          )}
          <Button icon={<RedoOutlined />} onClick={reset} size="large">
            重置
          </Button>
        </Space>
      ) : (
        <Text type="secondary">对战模式下由上方统一控制计时</Text>
      )}
    </Space>
  );
}

const Timer = forwardRef<TimerHandle, Props>(TimerComponent);
Timer.displayName = 'Timer';

export default Timer;
