import { useMemo } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import 'katex/contrib/mhchem/mhchem.js'

interface MathTextProps {
  text: string
  className?: string
  as?: 'p' | 'span' | 'div'
}

// Matches inline $...$ and display $$...$$ LaTeX delimiters
// Also matches \(...\) for inline and \[...\] for display
const MATH_REGEX = /(\$\$[\s\S]+?\$\$|\$(?!\s)(?:(?!\$).)+?(?<!\s)\$|\\[[\s\S]+?\\]|\\\([\s\S]+?\\\))/g

function renderSegment(segment: string, index: number): string {
  // Display math: $$...$$ or \[...\]
  if (
    (segment.startsWith('$$') && segment.endsWith('$$')) ||
    (segment.startsWith('\\[') && segment.endsWith('\\]'))
  ) {
    const tex = segment.startsWith('$$')
      ? segment.slice(2, -2)
      : segment.slice(2, -2)
    try {
      return katex.renderToString(tex.trim(), {
        displayMode: true,
        throwOnError: false,
        trust: true,
      })
    } catch {
      return segment
    }
  }

  // Inline math: $...$ or \(...\)
  if (
    (segment.startsWith('$') && segment.endsWith('$')) ||
    (segment.startsWith('\\(') && segment.endsWith('\\)'))
  ) {
    const tex = segment.startsWith('$')
      ? segment.slice(1, -1)
      : segment.slice(2, -2)
    try {
      return katex.renderToString(tex.trim(), {
        displayMode: false,
        throwOnError: false,
        trust: true,
      })
    } catch {
      return segment
    }
  }

  // Escape HTML in plain text segments
  return segment
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeAndPreserveNewlines(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>')
}

export function MathText({ text, className, as: Tag = 'span' }: MathTextProps) {
  const html = useMemo(() => {
    if (!text) return ''

    // Quick check: if no math delimiters, return plain text with newline handling
    if (!text.includes('$') && !text.includes('\\(') && !text.includes('\\[')) {
      return escapeAndPreserveNewlines(text)
    }

    const parts = text.split(MATH_REGEX)
    return parts
      .map((part, i) => {
        if (MATH_REGEX.test(part)) {
          // Reset regex lastIndex since it's global
          MATH_REGEX.lastIndex = 0
          return renderSegment(part, i)
        }
        return escapeAndPreserveNewlines(part)
      })
      .join('')
  }, [text])

  return (
    <Tag
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
