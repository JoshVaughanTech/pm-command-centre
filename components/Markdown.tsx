'use client';

// Lightweight markdown renderer — handles bold, bullets, numbered lists, and line breaks.
// No dependencies. Matches the SNTRI design.

export function Markdown({ text }: { text: string }) {
  const lines = text.split('\n');

  const elements = lines.map((line, i) => {
    // Empty line = spacing
    if (!line.trim()) return <div key={i} style={{ height: 8 }} />;

    // Numbered list
    const numMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (numMatch) {
      return (
        <div key={i} className="md-item md-item--num">
          <span className="md-num">{numMatch[1]}.</span>
          <span>{renderInline(numMatch[2])}</span>
        </div>
      );
    }

    // Bullet list (- or • or *)
    const bulletMatch = line.match(/^[-*•✓]\s+(.+)/);
    if (bulletMatch) {
      const isCheck = line.startsWith('✓');
      return (
        <div key={i} className={`md-item ${isCheck ? 'md-item--check' : ''}`}>
          <span className="md-bullet">{isCheck ? '✓' : '•'}</span>
          <span>{renderInline(bulletMatch[1])}</span>
        </div>
      );
    }

    // Regular line
    return <div key={i} className="md-line">{renderInline(line)}</div>;
  });

  return <div className="md-root">{elements}</div>;
}

function renderInline(text: string): React.ReactNode {
  // Bold: **text** or __text__
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('__') && part.endsWith('__')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    // Inline code: `text`
    const codeParts = part.split(/(`[^`]+`)/g);
    if (codeParts.length > 1) {
      return codeParts.map((cp, j) => {
        if (cp.startsWith('`') && cp.endsWith('`')) {
          return <code key={`${i}-${j}`} className="md-code">{cp.slice(1, -1)}</code>;
        }
        return cp;
      });
    }
    return part;
  });
}
