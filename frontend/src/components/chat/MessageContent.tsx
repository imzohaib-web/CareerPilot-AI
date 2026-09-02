import { useMemo } from 'react'
import type { ReactNode } from 'react'

/**
 * Safe "light markdown" renderer for mentor replies.
 *
 * Supports paragraphs, `-` / `*` bullet lists, numbered lists, markdown
 * headings, and **bold** text — matching the Career Mentor output contract
 * (docs/AGENT_SKILLS.md §5). Content is parsed into React nodes only; raw
 * HTML is never injected, so model output cannot execute markup.
 */

const BULLET_LINE = /^[-*•]\s+/
const NUMBERED_LINE = /^\d+[.)]\s+/
const HEADING_LINE = /^#{1,6}\s+/
const BOLD_SEGMENT = /\*\*([^*]+)\*\*/

interface ParagraphBlock {
  kind: 'paragraph'
  lines: string[]
}

interface ListBlock {
  kind: 'bullets' | 'numbered'
  items: string[]
}

type Block = ParagraphBlock | ListBlock

function parseBlocks(content: string): Block[] {
  const blocks: Block[] = []
  let current: Block | null = null

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line) {
      current = null
      continue
    }

    // Headings render as emphasized standalone lines.
    const heading = line.match(HEADING_LINE)
    const text = heading ? `**${line.slice(heading[0].length).trim()}**` : line

    if (BULLET_LINE.test(text)) {
      if (current === null || current.kind !== 'bullets') {
        current = { kind: 'bullets', items: [] }
        blocks.push(current)
      }
      current.items.push(text.replace(BULLET_LINE, ''))
    } else if (NUMBERED_LINE.test(text)) {
      if (current === null || current.kind !== 'numbered') {
        current = { kind: 'numbered', items: [] }
        blocks.push(current)
      }
      current.items.push(text.replace(NUMBERED_LINE, ''))
    } else {
      if (current === null || current.kind !== 'paragraph') {
        current = { kind: 'paragraph', lines: [] }
        blocks.push(current)
      }
      current.lines.push(text)
    }
  }

  return blocks
}

/** Split a line into text and <strong> segments for **bold** spans. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((segment, index) => {
    const match = segment.match(BOLD_SEGMENT)
    if (match) {
      return (
        <strong key={`${keyPrefix}-${index}`} className="font-semibold text-slate-900">
          {match[1]}
        </strong>
      )
    }
    return segment
  })
}

export function MessageContent({ content }: { content: string }) {
  const blocks = useMemo(() => parseBlocks(content), [content])

  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-700">
      {blocks.map((block, blockIndex) => {
        if (block.kind === 'paragraph') {
          return (
            <p key={blockIndex} className="whitespace-pre-wrap">
              {renderInline(block.lines.join('\n'), `${blockIndex}`)}
            </p>
          )
        }
        if (block.kind === 'bullets') {
          return (
            <ul key={blockIndex} className="list-disc space-y-1.5 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  {renderInline(item, `${blockIndex}-${itemIndex}`)}
                </li>
              ))}
            </ul>
          )
        }
        return (
          <ol key={blockIndex} className="list-decimal space-y-1.5 pl-5">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                {renderInline(item, `${blockIndex}-${itemIndex}`)}
              </li>
            ))}
          </ol>
        )
      })}
    </div>
  )
}
