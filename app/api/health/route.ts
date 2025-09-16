import { NextResponse } from "next/server";
import { listTools } from "@/lib/mcp/client";

export async function GET() {
  try {
    console.log('Health check started');
    
    // Check if MCP environment variables are configured
    if (!process.env.MCP_COMPOSE_URL) {
      console.log('MCP_COMPOSE_URL not configured');
      return NextResponse.json({ 
        ok: false, 
        error: "MCP_COMPOSE_URL not configured",
        mcpStatus: "not_configured"
      }, { status: 200 });
    }

    console.log('MCP_COMPOSE_URL:', process.env.MCP_COMPOSE_URL);
    console.log('Attempting to list MCP tools...');
    const tools = await listTools();
    console.log('MCP tools retrieved successfully');
    
    return NextResponse.json({ 
      ok: true, 
      tools,
      mcpStatus: "connected",
      mcpUrl: process.env.MCP_COMPOSE_URL
    });
  } catch (err: any) {
    console.error('Health check error:', err);
    return NextResponse.json({ 
      ok: false, 
      error: err.message,
      mcpStatus: "connection_failed",
      mcpUrl: process.env.MCP_COMPOSE_URL
    }, { status: 200 }); // Return 200 so we can see the error details
  }
}