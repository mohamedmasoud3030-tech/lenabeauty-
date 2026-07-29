/**
 * Tauri SQLite Client Wrapper
 * 
 * v2.0 Desktop mode: Local SQLite database instead of Supabase
 * Communicates with Tauri backend via ipc invoke commands
 * 
 * Usage:
 *   const client = TauriClient.getInstance();
 *   const result = await client.query('SELECT * FROM customers');
 */

import { logger } from "../../shared/logger";

export class TauriClient {
  private static instance: TauriClient;

  private constructor() {}

  static getInstance(): TauriClient {
    if (!TauriClient.instance) {
      TauriClient.instance = new TauriClient();
    }
    return TauriClient.instance;
  }

  /**
   * Execute a raw SQL query
   * @param sql SQL query string
   * @param params Optional query parameters
   */
  async query(sql: string, params?: any[]): Promise<any> {
    try {
      // In v2.0, this will invoke Tauri backend
      // For now: stub that returns empty results
      logger.log('[Tauri] query:', sql, params);
      return { ok: true, data: [] };
    } catch (error) {
      console.error('[Tauri] query error:', error);
      throw error;
    }
  }

  /**
   * Execute a single row query
   */
  async queryOne(sql: string, params?: any[]): Promise<any> {
    const result = await this.query(sql, params);
    return result.data?.[0] || null;
  }

  /**
   * Execute an insert/update/delete
   */
  async execute(sql: string, params?: any[]): Promise<number> {
    const result = await this.query(sql, params);
    return result.changes || 0;
  }

  /**
   * Begin transaction
   */
  async beginTransaction(): Promise<void> {
    await this.query('BEGIN TRANSACTION');
  }

  /**
   * Commit transaction
   */
  async commit(): Promise<void> {
    await this.query('COMMIT');
  }

  /**
   * Rollback transaction
   */
  async rollback(): Promise<void> {
    await this.query('ROLLBACK');
  }
}
