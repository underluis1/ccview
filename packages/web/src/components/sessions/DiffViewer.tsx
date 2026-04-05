import { useEffect, useRef, useState, useMemo } from 'react'
import type { Highlighter } from 'shiki'

interface DiffViewerProps {
  oldContent: string
  newContent: string
  language?: string | undefined
}

interface DiffLine {
  type: '+' | '-' | ' '
  text: string
}

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')

  const m = oldLines.length
  const n = newLines.length
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  )

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] = oldLines[i - 1] === newLines[j - 1]
        ? dp[i - 1]![j - 1]! + 1
        : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!)
    }
  }

  const result: DiffLine[] = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({ type: ' ', text: oldLines[i - 1]! })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      result.push({ type: '+', text: newLines[j - 1]! })
      j--
    } else {
      result.push({ type: '-', text: oldLines[i - 1]! })
      i--
    }
  }

  return result.reverse()
}

export default function DiffViewer({ oldContent, newContent, language }: DiffViewerProps) {
  const highlighterRef = useRef<Highlighter | null>(null)
  const [highlighted, setHighlighted] = useState(false)
  const [htmlLines, setHtmlLines] = useState<Map<string, string>>(new Map())

  const diffLines = useMemo(() => computeDiff(oldContent, newContent), [oldContent, newContent])

  useEffect(() => {
    let cancelled = false

    async function initShiki() {
      try {
        const { createHighlighter } = await import('shiki')
        const lang = language ?? 'text'
        const highlighter = await createHighlighter({
          themes: ['github-dark'],
          langs: [lang],
        })
        if (cancelled) return
        highlighterRef.current = highlighter

        // Highlight each unique line
        const uniqueTexts = new Set(diffLines.map(l => l.text))
        const map = new Map<string, string>()
        for (const text of uniqueTexts) {
          const html = highlighter.codeToHtml(text || ' ', {
            lang,
            theme: 'github-dark',
          })
          // Extract inner content from shiki output
          const match = html.match(/<code[^>]*>([\s\S]*?)<\/code>/)
          if (match) {
            // Remove wrapping <span class="line"> if present
            const inner = match[1]!.replace(/<span class="line">([\s\S]*?)<\/span>/, '$1')
            map.set(text, inner)
          }
        }
        if (!cancelled) {
          setHtmlLines(map)
          setHighlighted(true)
        }
      } catch {
        // Shiki failed, fall back to plain text
      }
    }

    initShiki()
    return () => { cancelled = true }
  }, [oldContent, newContent, language])

  return (
    <div className="bg-background rounded-md p-3 text-sm font-mono overflow-x-auto">
      {diffLines.map((line, idx) => {
        const bgClass =
          line.type === '+' ? 'bg-green-900/30 text-green-300' :
          line.type === '-' ? 'bg-red-900/30 text-red-300' :
          'text-foreground/80'
        const prefix = line.type === ' ' ? '  ' : line.type + ' '

        return (
          <div key={idx} className={`${bgClass} px-2 leading-6`}>
            <span className="select-none text-muted-foreground mr-2">{prefix}</span>
            {highlighted && htmlLines.has(line.text)
              ? <span dangerouslySetInnerHTML={{ __html: htmlLines.get(line.text)! }} />
              : <span>{line.text}</span>
            }
          </div>
        )
      })}
    </div>
  )
}
