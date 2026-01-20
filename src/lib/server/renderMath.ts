import katex from 'katex';

function renderInlineMath(text: string) {
  // Inline math: $...$ (single-line, not empty, not $$)
  return text.replace(/(^|[^$])\$([^\n$]+?)\$(?!\$)/g, (_m, lead, expr) => {
    const html = katex.renderToString(expr.trim(), {
      displayMode: false,
      throwOnError: false
    });
    return `${lead}${html}`;
  });
}

function renderDisplayMath(text: string) {
  // Display math: $$...$$ (can span lines)
  return text.replace(/\$\$([\s\S]+?)\$\$/g, (_m, expr) =>
    katex.renderToString(expr.trim(), {
      displayMode: true,
      throwOnError: false
    })
  );
}

export function renderMath(source: string) {
  const cleaned = source
    .replace(/\r\n/g, '\n')
    // kill control chars that can break KaTeX / HTML rendering, probably because I can't figure this out
    .replace(/[\u0000-\u001F\u007F]/g, (c) => (c === '\n' ? '\n' : ''));

  // Paragraphs first, based on blank lines, never works in real LaTeX...
  const paragraphs = cleaned
    .trim()
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      // Preserve single newlines inside a paragraph
      const withBreaks = p.replace(/\n/g, '<br />');

      const withDisplay = renderDisplayMath(withBreaks);
      const withInline = renderInlineMath(withDisplay);

      return `<p>${withInline}</p>`;
    })
    .join('\n');

  return paragraphs;
}
