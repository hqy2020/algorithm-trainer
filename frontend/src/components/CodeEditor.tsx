import { Input } from 'antd';

const { TextArea } = Input;

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

export default function CodeEditor({ value, onChange, placeholder = '粘贴你的代码...', rows = 15 }: Props) {
  return (
    <TextArea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
        fontSize: 14,
        backgroundColor: '#1e1e1e',
        color: '#d4d4d4',
        border: '1px solid #333',
        borderRadius: 8,
      }}
    />
  );
}
