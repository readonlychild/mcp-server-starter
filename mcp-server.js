import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { pokeMonsterData } from './tools/pokemon.js';

const server = new McpServer({
  name: 'MCP Server - Dervie',
  version: '1.0.0',
});

server.tool(
  pokeMonsterData.name,
  pokeMonsterData.description,
  pokeMonsterData.params,
  pokeMonsterData.handler,
);

const transport = new StdioServerTransport();
await server.connect(transport);

export const handler = async (event) => {
  const baseHeaders = {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };

  try {
    if (event.requestContext.http?.method == 'OPTIONS') {
      return { statusCode: 200, headers: baseHeaders, body: '' }
    }

    const payload = JSON.parse(event.body);

    const handleSingle = async (req) => {
      try {
        const resp = await server.handleRequest(req);
        return resp; // JSON-RPC compliant
      } catch (ex1) {
        //logger.error('Tool handling error', { error: ex1.message });
        if (req.id !== undefined) {
          return {
            jsonrpc: '2.0',
            id: req.id,
            error: {
              code: -32603,
              message: 'Internal error',
              data: ex1.message,
            }
          }
        }
        return null; // notification, no response
      }
    };

    let response;
    if (Array.isArray(payload)) {
      // Batch request
      const results = await Promise.all(payload.map(handleSingle));
      // Filter out nulls
      response = results.filter(r => r !== null);
    } else {
      const resp = await handleSingle(payload);
      response = resp === null ? '' : resp;
    }

    return {
      statusCode: 200,
      headers: baseHeaders,
      body: JSON.stringify(response),
    }

  } catch (ex) {
    //logger.error('Invalid JSON or other error', { error: ex.message });
    return {
      statusCode: 400,
      headers: baseHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error', data: ex.messge }
      }),
    }
  }
}