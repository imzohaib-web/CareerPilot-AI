import { describe, it, expect, vi, beforeEach } from 'vitest'
import { streamPost, type StreamError } from '../services/streamClient'

function createMockStream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let index = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(chunks[index++])
      } else {
        controller.close()
      }
    },
  })
}

describe('streamClient SSE Stream Reader', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('correctly processes start, delta, and done events in order', async () => {
    const encoder = new TextEncoder()
    const payload = [
      'data: {"type":"start","conversation_id":"conv-123"}\n\n',
      'data: {"type":"delta","text":"Hello "}\n\n',
      'data: {"type":"delta","text":"world!"}\n\n',
      'data: {"type":"done","full_text":"Hello world!","conversation_id":"conv-123"}\n\n',
    ]

    const chunks = payload.map((p) => encoder.encode(p))
    const mockBody = createMockStream(chunks)

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(mockBody, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    )

    const events: string[] = []
    let finalPayload: unknown = null
    let deltas = ''

    await streamPost(
      '/api/chat/message/stream',
      { message: 'hi' },
      {
        onStart: (ev) => {
          events.push(`start:${ev.conversation_id}`)
        },
        onDelta: (text) => {
          deltas += text
          events.push(`delta:${text}`)
        },
        onDone: (data) => {
          events.push('done')
          finalPayload = data
        },
        onError: (err) => {
          events.push(`error:${err.message}`)
        },
      }
    )

    expect(events).toEqual([
      'start:conv-123',
      'delta:Hello ',
      'delta:world!',
      'done',
    ])
    expect(deltas).toBe('Hello world!')
    expect(finalPayload).toEqual({
      type: 'done',
      full_text: 'Hello world!',
      conversation_id: 'conv-123',
    })
  })

  it('handles arbitrary chunk boundaries splitting a frame and newline across reads', async () => {
    const fullText =
      'data: {"type":"start","conversation_id":"c1"}\n\n' +
      'data: {"type":"delta","text":"Streaming is smooth"}\n\n' +
      'data: {"type":"done","status":"ok"}\n\n'

    const encoder = new TextEncoder()
    const rawBytes = encoder.encode(fullText)

    // Slice into tiny 7-byte chunks to stress frame boundary splitting
    const tinyChunks: Uint8Array[] = []
    const chunkSize = 7
    for (let i = 0; i < rawBytes.length; i += chunkSize) {
      tinyChunks.push(rawBytes.slice(i, i + chunkSize))
    }

    const mockBody = createMockStream(tinyChunks)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(mockBody, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    )

    let receivedStart = false
    let accumulatedText = ''
    let receivedDone = false

    await streamPost(
      '/api/chat/message/stream',
      {},
      {
        onStart: () => {
          receivedStart = true
        },
        onDelta: (delta) => {
          accumulatedText += delta
        },
        onDone: () => {
          receivedDone = true
        },
        onError: (err) => {
          throw new Error(`Unexpected error: ${err.message}`)
        },
      }
    )

    expect(receivedStart).toBe(true)
    expect(accumulatedText).toBe('Streaming is smooth')
    expect(receivedDone).toBe(true)
  })

  it('handles multi-byte UTF-8 sequences split across chunk boundaries without corruption', async () => {
    // Chinese characters and emoji: 🚀 (4 bytes: F0 9F 9A 80), 你好 (each 3 bytes)
    const textWithMultibyte = '🚀 祝你好运!'
    const fullSse = `data: {"type":"delta","text":"${textWithMultibyte}"}\n\ndata: {"type":"done"}\n\n`

    const encoder = new TextEncoder()
    const rawBytes = encoder.encode(fullSse)

    // Split right in the middle of the 4-byte emoji 🚀
    // Find the emoji bytes index
    const emojiStart = fullSse.indexOf('🚀')
    const splitIndex = encoder.encode(fullSse.slice(0, emojiStart)).length + 2 // 2 bytes into the 4-byte emoji

    const chunk1 = rawBytes.slice(0, splitIndex)
    const chunk2 = rawBytes.slice(splitIndex)

    const mockBody = createMockStream([chunk1, chunk2])
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(mockBody, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    )

    let capturedDelta = ''
    await streamPost(
      '/api/chat/message/stream',
      {},
      {
        onDelta: (delta) => {
          capturedDelta += delta
        },
        onDone: () => {},
        onError: () => {},
      }
    )

    expect(capturedDelta).toBe(textWithMultibyte)
  })

  it('ignores comment lines (heartbeats : ping) without emitting deltas', async () => {
    const encoder = new TextEncoder()
    const payload = [
      ': ping\n\n',
      ': ping\n\n',
      'data: {"type":"delta","text":"Hi"}\n\n',
      ': ping\n\n',
      'data: {"type":"done"}\n\n',
    ]

    const chunks = payload.map((p) => encoder.encode(p))
    const mockBody = createMockStream(chunks)

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(mockBody, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    )

    let deltas = ''
    await streamPost(
      '/api/chat/message/stream',
      {},
      {
        onDelta: (delta) => {
          deltas += delta
        },
        onDone: () => {},
        onError: () => {},
      }
    )

    expect(deltas).toBe('Hi')
  })

  it('routes error SSE event to onError with sanitized message', async () => {
    const encoder = new TextEncoder()
    const payload = 'data: {"type":"error","code":"AI_SERVICE_UNAVAILABLE","message":"AI service is currently busy. Please retry shortly."}\n\n'

    const mockBody = createMockStream([encoder.encode(payload)])
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(mockBody, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    )

    let errorResult: StreamError | null = null
    await streamPost(
      '/api/chat/message/stream',
      {},
      {
        onDelta: () => {},
        onDone: () => {},
        onError: (err) => {
          errorResult = err
        },
      }
    )

    const err1 = errorResult as StreamError | null
    expect(err1).not.toBeNull()
    expect(err1?.message).toBe('AI service is currently busy. Please retry shortly.')
    expect(err1?.code).toBe('AI_SERVICE_UNAVAILABLE')
  })

  it('handles HTTP 401 and clears stored auth token', async () => {
    localStorage.setItem('careerpilot_token', 'expired-token')

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Token expired' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    let errorResult: StreamError | null = null
    try {
      await streamPost(
        '/api/chat/message/stream',
        {},
        {
          onDelta: () => {},
          onDone: () => {},
          onError: (err) => {
            errorResult = err
          },
        }
      )
    } catch {
      // expected thrown error on HTTP non-200
    }

    const err2 = errorResult as StreamError | null
    expect(err2?.status).toBe(401)
    expect(err2?.category).toBe('authentication')
    expect(localStorage.getItem('careerpilot_token')).toBeNull()
  })

  it('handles HTTP 429 and includes Retry-After message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Rate limit reached', {
        status: 429,
        headers: {
          'Retry-After': '25',
          'Content-Type': 'text/plain',
        },
      })
    )

    let errorResult: StreamError | null = null
    try {
      await streamPost(
        '/api/chat/message/stream',
        {},
        {
          onDelta: () => {},
          onDone: () => {},
          onError: (err) => {
            errorResult = err
          },
        }
      )
    } catch {
      // expected thrown error on HTTP non-200
    }

    const err3 = errorResult as StreamError | null
    expect(err3?.status).toBe(429)
    expect(err3?.category).toBe('rate-limit')
    expect(err3?.message).toContain('Please retry in 25s.')
  })

  it('stops reading cleanly and reports aborted when AbortController aborts', async () => {
    const controller = new AbortController()

    let cancelled = false
    const endlessStream = new ReadableStream<Uint8Array>({
      pull(c) {
        if (cancelled) {
          c.close()
          return
        }
        c.enqueue(new TextEncoder().encode('data: {"type":"delta","text":"1"}\n\n'))
      },
      cancel() {
        cancelled = true
      },
    })

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(endlessStream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    )

    let receivedTokens = 0
    let abortReported = false

    const promise = streamPost(
      '/api/chat/message/stream',
      {},
      {
        onDelta: () => {
          receivedTokens++
          controller.abort()
        },
        onDone: () => {},
        onError: (err) => {
          if (err.category === 'aborted') {
            abortReported = true
          }
        },
      },
      controller.signal
    )

    await promise
    expect(receivedTokens).toBe(1)
    expect(abortReported).toBe(true)
  })
})
