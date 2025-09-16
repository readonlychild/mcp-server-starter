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
  console.log('EVENT', JSON.stringify(event, null, 2));
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
        const resp = await server.rpc.dispatchRequest(req);
        return resp; // JSON-RPC compliant
      } catch (ex1) {
        //logger.error('Tool handling error', { error: ex1.message });
        console.log('ERR! ex1', ex1.message);
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

    if (response) {
      console.log('RESPONSE', JSON.stringify(response));
    } else {
      console.log('RESPONSE', 'null');
    }
    return {
      statusCode: 200,
      headers: baseHeaders,
      body: response ? JSON.stringify(response) : null,
    }

  } catch (ex) {
    //logger.error('Invalid JSON or other error', { error: ex.message });
    console.log('ERR! ex', ex.message);
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