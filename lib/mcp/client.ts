// /lib/mcp/client.ts
const BASE = (process.env.MCP_COMPOSE_URL || "").replace(/\/$/, "");
const AUTH = process.env.MCP_BEARER || ""; // optional: "Bearer <token>"

function authHeader(): Record<string, string> {
  if (!AUTH) return {};
  return { Authorization: AUTH.startsWith("Bearer ") ? AUTH : `Bearer ${AUTH}` };
}

async function toJSONorText(res: Response) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

export async function callTool(
  toolId: string,
  args: any,
  idempotencyKey?: string
) {
  if (!BASE) throw new Error("MCP_COMPOSE_URL missing");
  const url = `${BASE}/mcp`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...authHeader(),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Math.floor(Math.random() * 10000),
      method: "tools/call",
      params: {
        name: toolId,
        arguments: args ?? {}
      }
    }),
  });

  if (!res.ok) {
    const body = await toJSONorText(res);
    throw new Error(`MCP ${toolId} ${res.status}: ${JSON.stringify(body)}`);
  }
  
  const data = await toJSONorText(res);
  
  // Handle Server-Sent Events (SSE) format for tool calls
  let parsedData = data;
  if (data.raw && typeof data.raw === 'string') {
    try {
      // Extract JSON from SSE format: "event: message\ndata: {JSON}\n\n"
      const lines = data.raw.split('\n');
      const dataLine = lines.find((line: string) => line.startsWith('data: '));
      if (dataLine) {
        const jsonStr = dataLine.replace('data: ', '');
        parsedData = JSON.parse(jsonStr);
        console.log('Parsed callTool SSE data successfully');
      }
    } catch (sseError) {
      console.log('Failed to parse callTool SSE format, using original data');
    }
  }
  
  // Handle JSON-RPC response format
  if (parsedData.error) {
    throw new Error(`MCP JSON-RPC error: ${parsedData.error.message}`);
  }
  
  // If result is undefined but we have content in the response, extract it
  if (!parsedData.result && parsedData.result !== null) {
    console.log('Result is undefined, checking for content in response...');
    
    // Check if there's content in the response that contains our actual data
    if (parsedData.content && Array.isArray(parsedData.content)) {
      const textContent = parsedData.content.find((item: any) => item.type === 'text');
      if (textContent && textContent.text) {
        try {
          // Parse the nested JSON string
          const actualResult = JSON.parse(textContent.text);
          console.log('Extracted actual result from content:', JSON.stringify(actualResult, null, 2));
          
          // Return the response_data.results if available
          if (actualResult.data && actualResult.data.response_data) {
            return actualResult.data.response_data;
          }
          return actualResult;
        } catch (parseError) {
          console.log('Failed to parse nested JSON in content');
        }
      }
    }
  }
  
  console.log('callTool returning:', JSON.stringify(parsedData.result, null, 2));
  return parsedData.result;
}

/**
 * Returns the available tools from your Composio MCP server.
 * Only here do we include helper actions by adding the query param.
 */
export async function listTools() {
  if (!BASE) throw new Error("MCP_COMPOSE_URL missing");
  const url = `${BASE}/mcp?include_composio_helper_actions=true`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...authHeader(),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {}
    }),
  });

  if (!res.ok) {
    const body = await toJSONorText(res);
    throw new Error(`MCP listTools ${res.status}: ${JSON.stringify(body)}`);
  }

  const data = await toJSONorText(res);
  
  // Handle Server-Sent Events (SSE) format
  let parsedData = data;
  if (data.raw && typeof data.raw === 'string') {
    try {
      // Extract JSON from SSE format: "event: message\ndata: {JSON}\n\n"
      const lines = data.raw.split('\n');
      const dataLine = lines.find((line: string) => line.startsWith('data: '));
      if (dataLine) {
        const jsonStr = dataLine.replace('data: ', '');
        parsedData = JSON.parse(jsonStr);
        console.log('Parsed SSE data successfully');
      }
    } catch (sseError) {
      console.log('Failed to parse SSE format, using original data');
    }
  }
  
  // Handle JSON-RPC response format
  if (parsedData.error) {
    throw new Error(`MCP JSON-RPC error: ${parsedData.error.message}`);
  }
  
  // Extract tools from JSON-RPC result
  if (parsedData.result && Array.isArray(parsedData.result.tools)) {
    console.log('Found tools in result.tools:', parsedData.result.tools.length);
    return parsedData.result.tools;
  }
  
  // Check for other possible formats
  if (Array.isArray(parsedData.result)) {
    console.log('Found tools in result array:', parsedData.result.length);
    return parsedData.result;
  }
  
  if (Array.isArray(parsedData.tools)) {
    console.log('Found tools in tools array:', parsedData.tools.length);
    return parsedData.tools;
  }
  
  // Fallback if response format is unexpected
  console.log('No tools found in response, returning empty array');
  console.log('Final parsed data:', JSON.stringify(parsedData, null, 2));
  return [];
}
