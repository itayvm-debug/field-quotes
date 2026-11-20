import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { authenticateToken, bearerFrom } from '@/lib/apiTokens'
import { buildMcpServer } from '@/lib/mcp/server'

export const dynamic = 'force-dynamic'

// MCP endpoint for AI agents: https://<host>/api/mcp
// Auth: "Authorization: Bearer fq_…" (personal token from /settings/profile).
// Stateless Streamable HTTP with JSON responses — fits serverless.
async function handler(req: Request): Promise<Response> {
  const auth = await authenticateToken(bearerFrom(req))
  if (!auth) {
    return new Response(JSON.stringify({ error: 'unauthorized', message: 'Missing or invalid access token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer realm="field-quotes"' },
    })
  }
  const server = buildMcpServer({ ...auth, origin: new URL(req.url).origin })
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })
  await server.connect(transport)
  try {
    return await transport.handleRequest(req)
  } finally {
    // Response is fully buffered (enableJsonResponse) — release per-request resources
    void server.close()
  }
}

export { handler as GET, handler as POST, handler as DELETE }
