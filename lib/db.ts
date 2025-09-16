import { Pool, PoolClient } from "pg";
import { log } from "./logger";
import { SUPABASE_DB_URL, SUPABASE_DB_POOLER_URL } from "./env";
import { randomUUID } from "crypto";

// Since direct URL has DNS issues, use working pooler URL as primary
const connectionString =
  SUPABASE_DB_POOLER_URL      // PgBouncer (6543) → confirmed working
  ?? SUPABASE_DB_URL;         // Fallback to direct URL

if (!connectionString) {
  throw new Error("Missing database URL. Please set SUPABASE_DB_POOLER_URL or SUPABASE_DB_URL");
}

const pool: Pool =
  (globalThis as any).__pgpool ??
  new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    max: process.env.NODE_ENV === "production" ? 10 : 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 30_000,
    query_timeout: 30_000,
  });

if (!(globalThis as any).__pgpool) {
  (globalThis as any).__pgpool = pool;

  pool.on('error', (err) => {
    log(`PostgreSQL pool error: ${err.message}`);
  });

  pool.on('connect', () => {
    log('Connected to PostgreSQL database');
  });

  process.on('SIGTERM', async () => {
    await pool.end();
    log('PostgreSQL pool closed');
  });
}

// UUID utilities for hybrid approach
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function normalizeUserId(userId?: string): string | null {
  if (!userId) return null;

  // If it's already a valid UUID, use it
  if (isValidUUID(userId)) {
    return userId;
  }

  // Generate a deterministic UUID from the text input
  // This ensures the same text always produces the same UUID
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256').update(userId).digest('hex');

  // Format as UUID v4
  const uuid = [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '4' + hash.substring(13, 16), // Version 4
    ((parseInt(hash.substring(16, 17), 16) & 0x3) | 0x8).toString(16) + hash.substring(17, 20), // Variant bits
    hash.substring(20, 32)
  ].join('-');

  return uuid;
}

export interface DbThread {
  id: string;
  user_id?: string;
  title?: string;
  created_at: Date;
  updated_at: Date;
}

export interface DbMessage {
  id: string;
  thread_id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  created_at: Date;
}

export interface DbToolExecution {
  id: string;
  thread_id: string;
  tool_name: string;
  args: Record<string, any>;
  result: Record<string, any>;
  status: "ok" | "error";
  created_at: Date;
  execution_time_ms?: number;
}

export interface DbMemChunk {
  id: string;
  user_id?: string;
  source: string;
  source_id?: string;
  title?: string;
  text: string;
  project_id?: string;
  domain_id?: string;
  embedding?: number[];
  created_at: Date;
  updated_at: Date;
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function createThread(params: {
  userId?: string;
  title?: string
}): Promise<string> {
  const normalizedUserId = normalizeUserId(params.userId);

  const { rows } = await pool.query(
    `INSERT INTO threads (user_id, title) VALUES ($1, $2) RETURNING id`,
    [normalizedUserId, params.title ?? null]
  );
  return rows[0].id as string;
}

export async function getThread(threadId: string): Promise<DbThread | null> {
  const { rows } = await pool.query(
    `SELECT id, user_id, title, created_at, updated_at
     FROM threads
     WHERE id = $1`,
    [threadId]
  );
  return rows[0] || null;
}

export async function updateThreadTitle(
  threadId: string,
  title: string
): Promise<void> {
  await pool.query(
    `UPDATE threads SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [title, threadId]
  );
}

export async function saveMessage(args: {
  threadId: string;
  role: "user" | "assistant" | "tool";
  content: string;
}): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO messages (thread_id, role, content) VALUES ($1, $2, $3) RETURNING id`,
    [args.threadId, args.role, args.content]
  );
  return rows[0].id as string;
}

export async function listMessages(
  threadId: string,
  limit = 50,
  offset = 0
): Promise<DbMessage[]> {
  const { rows } = await pool.query(
    `SELECT id, thread_id, role, content, created_at
     FROM messages
     WHERE thread_id = $1
     ORDER BY created_at ASC
     LIMIT $2 OFFSET $3`,
    [threadId, limit, offset]
  );
  return rows;
}

export async function getMessagesCount(threadId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*) as count FROM messages WHERE thread_id = $1`,
    [threadId]
  );
  return parseInt(rows[0].count);
}

export async function saveToolExecution(args: {
  threadId: string;
  toolName: string;
  args: unknown;
  result: unknown;
  status: "ok" | "error";
  executionTimeMs?: number;
}): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO tool_executions (thread_id, tool_name, args, result, status, execution_time_ms)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      args.threadId,
      args.toolName,
      JSON.stringify(args.args),
      JSON.stringify(args.result),
      args.status,
      args.executionTimeMs ?? null
    ]
  );
  return rows[0].id as string;
}

export async function getToolExecutions(
  threadId: string,
  toolName?: string,
  limit = 100
): Promise<DbToolExecution[]> {
  const query = toolName
    ? `SELECT id, thread_id, tool_name, args, result, status, execution_time_ms, created_at
       FROM tool_executions
       WHERE thread_id = $1 AND tool_name = $2
       ORDER BY created_at DESC LIMIT $3`
    : `SELECT id, thread_id, tool_name, args, result, status, execution_time_ms, created_at
       FROM tool_executions
       WHERE thread_id = $1
       ORDER BY created_at DESC LIMIT $2`;

  const params = toolName ? [threadId, toolName, limit] : [threadId, limit];
  const { rows } = await pool.query(query, params);

  return rows.map(row => ({
    ...row,
    args: JSON.parse(row.args),
    result: JSON.parse(row.result)
  }));
}

export async function addMemChunk(args: {
  userId?: string;
  source: string;
  sourceId?: string;
  title?: string;
  text: string;
  projectId?: string;
  domainId?: string;
  embedding?: number[];
}): Promise<string> {
  const normalizedUserId = normalizeUserId(args.userId);

  const { rows } = await pool.query(
    `INSERT INTO mem_chunks
       (user_id, source, source_id, title, text, project_id, domain_id, embedding)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      normalizedUserId,
      args.source,
      args.sourceId ?? null,
      args.title ?? null,
      args.text,
      args.projectId ?? null,
      args.domainId ?? null,
      args.embedding ?? null
    ]
  );
  return rows[0].id as string;
}

export async function searchMemChunks(args: {
  userId?: string;
  projectId?: string;
  domainId?: string;
  source?: string;
  textQuery?: string;
  limit?: number;
}): Promise<DbMemChunk[]> {
  let query = `SELECT id, user_id, source, source_id, title, text, project_id, domain_id, embedding, created_at, updated_at FROM mem_chunks WHERE 1=1`;
  const params: any[] = [];
  let paramCount = 0;

  if (args.userId) {
    const normalizedUserId = normalizeUserId(args.userId);
    query += ` AND user_id = $${++paramCount}`;
    params.push(normalizedUserId);
  }
  if (args.projectId) {
    query += ` AND project_id = $${++paramCount}`;
    params.push(args.projectId);
  }
  if (args.domainId) {
    query += ` AND domain_id = $${++paramCount}`;
    params.push(args.domainId);
  }
  if (args.source) {
    query += ` AND source = $${++paramCount}`;
    params.push(args.source);
  }
  if (args.textQuery) {
    query += ` AND (title ILIKE $${++paramCount} OR text ILIKE $${paramCount})`;
    params.push(`%${args.textQuery}%`);
  }

  query += ` ORDER BY created_at DESC LIMIT $${++paramCount}`;
  params.push(args.limit ?? 50);

  const { rows } = await pool.query(query, params);
  return rows;
}

export async function healthCheck(): Promise<{ healthy: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    await pool.query('SELECT 1');
    return { healthy: true, latencyMs: Date.now() - start };
  } catch (error) {
    log(`Database health check failed: ${error}`);
    return { healthy: false, latencyMs: Date.now() - start };
  }
}

export async function getPoolStats() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  };
}

export { pool };