import { useState, useRef, useCallback, useEffect } from 'react';
import { Button, Space, Typography, Tag } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, RedoOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface Props {
  onTimeUpdate?: (seconds: number) => void;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
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

export default function Timer({ onTimeUpdate, difficulty = 'Medium' }: Props) {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const start = useCallback(() => {
    if (running) return;
    setRunning(true);
    intervalRef.current = window.setInterval(() => {
      setSeconds(prev => {
        const next = prev + 1;
        onTimeUpdate?.(next);
        return next;
      });
    }, 1000);
  }, [running, onTimeUpdate]);

  const pause = useCallback(() => {
    setRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    pause();
    setSeconds(0);
    onTimeUpdate?.(0);
  }, [pause, onTimeUpdate]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const rating = seconds > 0 ? getTimeRating(seconds, difficulty) : null;

  return (
    <Space direction="vertical" align="center" style={{ width: '100%' }}>
      <Text style={{ fontSize: 48, fontFamily: 'monospace', fontWeight: 'bold' }}>
        {formatTime(seconds)}
      </Text>
      {rating && <Tag color={rating.color}>{rating.label}</Tag>}
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
    </Space>
  );
}
