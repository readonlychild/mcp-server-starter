// handler.mjs (ESM)
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { toReqRes, toFetchResponse } from 'fetch-to-node';
import { pokeMonsterData } from './tools/pokemon.js';

// --- create and configure server once (cold start) ---
const server = new McpServer({ name: 'my-lambda-mcp', version: '1.0.0' });
// register tools / resources on `server` here, e.g.
// server.tool('hello', z.object({}), async () => ({ content: [{ type: 'text', text: 'hi' }] }));
server.tool(
  pokeMonsterData.name,
  pokeMonsterData.description,
  pokeMonsterData.params,
  pokeMonsterData.handler,
);

// Exported Lambda handler for function URL / APIGWv2 payloads
export const handler = async (event) => {
  console.log('EVENT', JSON.stringify(event));
  // 1) Build a full URL that matches incoming request (Function URL / APIGWv2 shape)
  const domain = event.requestContext?.domainName ?? event.headers?.host ?? 'localhost';
  const rawPath = event.rawPath ?? event.path ?? '/';
  const qs = event.rawQueryString ? `?${event.rawQueryString}` : '';
  const url = `https://${domain}${rawPath}${qs}`;

  // 2) Build fetch Request init
  const method = event.requestContext?.http?.method ?? (event.httpMethod ?? 'POST');
  const headers = event.headers ?? {};
  // event.body may be base64 encoded depending on client
  const body = event.body && event.isBase64Encoded
    ? Buffer.from(event.body, 'base64')
    : (event.body ?? undefined);

  // Create a Fetch Request (Node 18+ exposes global Request)
  const fetchReq = new Request(url, { method, headers, body });

  // 3) Convert Fetch Request -> Node req/res
  const { req: nodeReq, res: nodeRes } = toReqRes(fetchReq);

  // 4) Create a transport per-request (stateless mode). Use sessionIdGenerator if you want sessionful.
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  // connect transport to server (server takes ownership of transport callbacks)
  await server.connect(transport);

  // 5) If the body is JSON, decode it and pass it as the third arg (many examples do this)
  let parsedBody;
  if (body) {
    try { parsedBody = typeof body === 'string' ? JSON.parse(body) : JSON.parse(body.toString('utf8')); }
    catch { parsedBody = body; }
  }

  try {
    // This hands the nodeReq/nodeRes to the transport which will dispatch the JSON-RPC to server
    await transport.handleRequest(nodeReq, nodeRes, parsedBody);

    // 6) Convert Node res -> Fetch Response and then into APIGW result
    const fetchResp = await toFetchResponse(nodeRes);
    const respHeaders = {};
    for (const [k, v] of fetchResp.headers.entries()) respHeaders[k] = v;

    // decide base64 encoding for non-text bodies
    const contentType = fetchResp.headers.get('content-type') ?? '';
    const isBinary = !/^text\/|^application\/json/.test(contentType);

    const respBuffer = Buffer.from(await fetchResp.arrayBuffer());
    const bodyOut = isBinary ? respBuffer.toString('base64') : respBuffer.toString('utf8');

    console.log('bodyOut', bodyOut);

    return {
      statusCode: fetchResp.status,
      headers: respHeaders,
      body: bodyOut,
      isBase64Encoded: isBinary,
    };
  } catch (err) {
    console.error('MCP transport error:', err);
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error', data: String(err?.message ?? err) },
        id: null
      }),
      isBase64Encoded: false,
    };
  } finally {
    // cleanup the transport for this invocation
    try { await transport.close(); } catch (_) {}
    // optionally close server if you created per-request; if server is reused across warm invocations, don't close it
    // await server.close();
  }
};
