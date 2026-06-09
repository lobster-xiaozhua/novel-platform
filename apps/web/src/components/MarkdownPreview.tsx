'use client';

interface MarkdownPreviewProps {
  content: string;
}

export default function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const html = markdownToHtml(content);

  return (
    <div
      className="prose prose-sm max-w-none text-gray-800 leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const result: string[] = [];
  let inList = false;
  let inBlockquote = false;

  function closeOpenBlocks() {
    if (inList) { result.push('</ul>'); inList = false; }
    if (inBlockquote) { result.push('</blockquote>'); inBlockquote = false; }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      closeOpenBlocks();
      const level = headingMatch[1].length;
      const sizes: Record<number, string> = { 1: '2xl', 2: 'xl', 3: 'lg', 4: 'base', 5: 'sm', 6: 'xs' };
      const size = sizes[level] || 'base';
      result.push(`<h${level} class="text-${size} font-bold mt-4 mb-2">${inlineFormat(headingMatch[2])}</h${level}>`);
      continue;
    }

    // Blockquote
    const bqMatch = line.match(/^>\s?(.*)$/);
    if (bqMatch) {
      if (!inBlockquote) {
        closeOpenBlocks();
        result.push('<blockquote class="border-l-4 border-primary-300 pl-4 py-1 my-2 text-gray-600 italic">');
        inBlockquote = true;
      }
      result.push(`<p>${inlineFormat(bqMatch[1])}</p>`);
      continue;
    } else if (inBlockquote) {
      result.push('</blockquote>');
      inBlockquote = false;
    }

    // Unordered list
    const listMatch = line.match(/^[-*+]\s+(.+)$/);
    if (listMatch) {
      if (!inList) {
        closeOpenBlocks();
        result.push('<ul class="list-disc pl-6 my-2 space-y-1">');
        inList = true;
      }
      result.push(`<li>${inlineFormat(listMatch[1])}</li>`);
      continue;
    } else if (inList) {
      result.push('</ul>');
      inList = false;
    }

    // Empty line
    if (line.trim() === '') {
      closeOpenBlocks();
      continue;
    }

    // Paragraph
    closeOpenBlocks();
    result.push(`<p class="my-2">${inlineFormat(line)}</p>`);
  }

  closeOpenBlocks();
  return result.join('\n');
}

function inlineFormat(text: string): string {
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  text = text.replace(/`(.+?)`/g, '<code class="bg-gray-100 px-1 rounded text-sm">$1</code>');
  return text;
}
