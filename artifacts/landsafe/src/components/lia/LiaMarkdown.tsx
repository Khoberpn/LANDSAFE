import React from 'react';

/**
 * Small, dependency-free Markdown renderer for LIA answers.
 *
 * It deliberately does not use `dangerouslySetInnerHTML`; all model output is
 * rendered as React text nodes so a prompt-injected HTML payload cannot become
 * executable markup in the dashboard.
 */

function safeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString();
  } catch {
    return null;
  }
  return null;
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(pattern).filter((part) => part.length > 0);
  const nodes: React.ReactNode[] = [];

  parts.forEach((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      nodes.push(<strong key={key} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>);
      return;
    }
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      nodes.push(<em key={key}>{part.slice(1, -1)}</em>);
      return;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      nodes.push(
        <code key={key} className="rounded bg-secondary px-1 py-0.5 font-mono text-[11px] text-foreground">
          {part.slice(1, -1)}
        </code>,
      );
      return;
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      const href = safeUrl(link[2]);
      if (href) {
        nodes.push(
          <a key={key} href={href} target="_blank" rel="noreferrer noopener" className="font-medium text-info underline underline-offset-2">
            {link[1]}
          </a>,
        );
        return;
      }
      nodes.push(<span key={key}>{link[1]}</span>);
      return;
    }
    nodes.push(<React.Fragment key={key}>{part}</React.Fragment>);
  });

  return nodes;
}

function isListLine(line: string): boolean {
  return /^\s*[-*•]\s+/.test(line);
}

function isOrderedLine(line: string): boolean {
  return /^\s*\d+[.)]\s+/.test(line);
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function isTableStart(lines: string[], index: number): boolean {
  const line = lines[index];
  const next = lines[index + 1];
  return Boolean(line && next && line.includes('|') && isTableSeparator(next));
}

export function LiaMarkdown({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let index = 0;
  let blockKey = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    // Fenced code block
    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(
        <pre key={`block-${blockKey++}`} className="overflow-x-auto rounded-md border border-border bg-secondary/70 p-3 text-[11px] leading-relaxed">
          {language ? <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">{language}</div> : null}
          <code className="font-mono">{codeLines.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    // Table
    if (isTableStart(lines, index)) {
      const header = splitTableRow(lines[index]);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        const row = splitTableRow(lines[index]);
        if (row.length === 0 || row.every((cell) => cell.length === 0)) break;
        rows.push(row);
        index += 1;
      }
      const tableKey = blockKey++;
      blocks.push(
        <div key={`block-${tableKey}`} className="overflow-x-auto rounded-md border border-border">
          <table className="w-full border-collapse text-left text-[10.5px]">
            <thead className="bg-secondary/70">
              <tr>
                {header.map((cell, cellIndex) => (
                  <th key={cellIndex} className="border-b border-border px-2 py-1.5 font-semibold text-foreground">
                    {renderInline(cell, `th-${tableKey}-${cellIndex}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-border last:border-0">
                  {header.map((_, cellIndex) => (
                    <td key={cellIndex} className="px-2 py-1.5 align-top text-muted-foreground">
                      {renderInline(row[cellIndex] ?? '', `td-${tableKey}-${rowIndex}-${cellIndex}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Headings
    const heading = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2];
      const className = level <= 2
        ? 'mt-3 text-[13px] font-semibold text-foreground'
        : 'mt-2 text-[12px] font-semibold text-foreground';
      blocks.push(
        <div key={`block-${blockKey++}`} className={className}>
          {renderInline(text, `h-${blockKey}`)}
        </div>,
      );
      index += 1;
      continue;
    }

    // Horizontal rule
    if (/^([-*_])\1{2,}$/.test(trimmed.replace(/\s+/g, ''))) {
      blocks.push(<hr key={`block-${blockKey++}`} className="my-3 border-border" />);
      index += 1;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith('>')) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push(
        <blockquote key={`block-${blockKey++}`} className="border-l-2 border-info/50 pl-3 text-[12px] text-muted-foreground">
          {renderInline(quoteLines.join(' '), `q-${blockKey}`)}
        </blockquote>,
      );
      continue;
    }

    // Unordered list
    if (isListLine(line)) {
      const items: string[] = [];
      while (index < lines.length && isListLine(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*•]\s+/, ''));
        index += 1;
      }
      blocks.push(
        <ul key={`block-${blockKey++}`} className="ml-4 list-disc space-y-1 text-[12px] leading-relaxed">
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item, `ul-${blockKey}-${itemIndex}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (isOrderedLine(line)) {
      const items: string[] = [];
      while (index < lines.length && isOrderedLine(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+[.)]\s+/, ''));
        index += 1;
      }
      blocks.push(
        <ol key={`block-${blockKey++}`} className="ml-4 list-decimal space-y-1 text-[12px] leading-relaxed">
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item, `ol-${blockKey}-${itemIndex}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Paragraph: collect until blank/special line
    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const candidate = lines[index];
      const candidateTrimmed = candidate.trim();
      if (!candidateTrimmed) break;
      if (/^(#{1,4})\s+/.test(candidateTrimmed)) break;
      if (candidateTrimmed.startsWith('```') || candidateTrimmed.startsWith('>')) break;
      if (isListLine(candidate) || isOrderedLine(candidate)) break;
      if (isTableStart(lines, index)) break;
      if (/^([-*_])\1{2,}$/.test(candidateTrimmed.replace(/\s+/g, ''))) break;
      paragraphLines.push(candidateTrimmed);
      index += 1;
    }
    if (paragraphLines.length > 0) {
      blocks.push(
        <p key={`block-${blockKey++}`} className="text-[12px] leading-relaxed">
          {renderInline(paragraphLines.join(' '), `p-${blockKey}`)}
        </p>,
      );
    }
  }

  return <div className="space-y-2">{blocks}</div>;
}
