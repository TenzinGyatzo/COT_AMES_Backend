/**
 * Extrae plain text de un doc TipTap/ProseMirror JSON, alineado con
 * `editor.getText()` de TipTap (blockSeparator por defecto `\n\n`).
 * Sin dependencia de @tiptap/* en el backend.
 */
const TEXTBLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'codeBlock',
  'blockquote',
]);

function collectInlineText(node: Record<string, unknown>): string {
  if (node.type === 'text' && typeof node.text === 'string') {
    return node.text;
  }
  if (node.type === 'hardBreak') {
    return '\n';
  }
  const content = node.content;
  if (!Array.isArray(content)) return '';
  return content
    .map((child) =>
      child && typeof child === 'object'
        ? collectInlineText(child as Record<string, unknown>)
        : '',
    )
    .join('');
}

export function plainTextFromTipTapDoc(doc: unknown): string {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return '';
  }

  const blocks: string[] = [];

  function walk(node: Record<string, unknown>) {
    const type = node.type;
    if (typeof type === 'string' && TEXTBLOCK_TYPES.has(type)) {
      blocks.push(collectInlineText(node));
      return;
    }
    const content = node.content;
    if (!Array.isArray(content)) return;
    for (const child of content) {
      if (child && typeof child === 'object' && !Array.isArray(child)) {
        walk(child as Record<string, unknown>);
      }
    }
  }

  walk(doc as Record<string, unknown>);
  return blocks.join('\n\n');
}
