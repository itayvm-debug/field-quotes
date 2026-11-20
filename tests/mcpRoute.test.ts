import { describe, it, expect } from 'vitest'
import { POST } from '@/app/api/mcp/route'

const rpc = (headers: Record<string, string> = {}) =>
  new Request('https://example.test/api/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  })

describe('/api/mcp auth', () => {
  it('rejects requests without a token', async () => {
    const res = await POST(rpc())
    expect(res.status).toBe(401)
    expect(res.headers.get('www-authenticate')).toContain('Bearer')
  })
  it('rejects malformed tokens without touching the database', async () => {
    const res = await POST(rpc({ Authorization: 'Bearer not-a-real-token' }))
    expect(res.status).toBe(401)
  })
})
