import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  content: string;
}

export default function AiMarkdown({ content }: Props) {
  return (
    <div style={{ lineHeight: 1.7, wordBreak: 'break-word' }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p style={{ margin: '0 0 10px' }}>{children}</p>,
          ul: ({ children }) => <ul style={{ margin: '0 0 10px', paddingInlineStart: 20 }}>{children}</ul>,
          ol: ({ children }) => <ol style={{ margin: '0 0 10px', paddingInlineStart: 20 }}>{children}</ol>,
          li: ({ children }) => <li style={{ marginBottom: 6 }}>{children}</li>,
          code: ({ children, className }) => {
            const text = String(children ?? '');
            const isInline = !text.includes('\n');
            if (isInline) {
              return (
                <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>
                  {children}
                </code>
              );
            }
            return (
              <code className={className} style={{ display: 'block', background: '#1e1e1e', color: '#d4d4d4', padding: 12, borderRadius: 8, overflowX: 'auto' }}>
                {children}
              </code>
            );
          },
        }}
      >
        {content || ''}
      </ReactMarkdown>
    </div>
  );
}
