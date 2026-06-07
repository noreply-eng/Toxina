/** Minimal markdown → HTML for legal documents (headings, paragraphs, lists, bold). */
export function markdownToHtml(markdown: string): string {
  const lines = markdown.split('\n');
  const parts: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      parts.push('</ul>');
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (!line.trim()) {
      closeList();
      continue;
    }

    if (line.startsWith('# ')) {
      closeList();
      parts.push(`<h1 class="legal-h1">${inlineFormat(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith('## ')) {
      closeList();
      parts.push(`<h2 class="legal-h2">${inlineFormat(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('### ')) {
      closeList();
      parts.push(`<h3 class="legal-h3">${inlineFormat(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith('- ')) {
      if (!inList) {
        parts.push('<ul class="legal-ul">');
        inList = true;
      }
      parts.push(`<li>${inlineFormat(line.slice(2))}</li>`);
      continue;
    }

    closeList();
    parts.push(`<p class="legal-p">${inlineFormat(line)}</p>`);
  }

  closeList();
  return parts.join('\n');
}

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}
