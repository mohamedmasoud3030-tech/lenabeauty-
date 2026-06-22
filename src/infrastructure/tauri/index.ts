/**
 * Tauri v2.0 Adapter Exports
 * 
 * Provides SQLite-backed implementations for all repositories
 * Structured identically to Supabase adapters for easy switching
 */

import { TauriClient } from './client';

export { TauriClient };

/**
 * Factory: Create all Tauri adapters at once
 * 
 * Usage in createRepositoryBundle.ts:
 *   if (config.backend === 'tauri') {
 *     return createTauriAdapters();
 *   }
 */
export function createTauriAdapters() {
  const client = TauriClient.getInstance();

  return {
    // TODO: Implement SQLite-backed adapters
    // Pattern: mirror SupabaseXxxAdapter but use TauriClient.query()
    // 
    // TauriCustomerAdapter: implements CustomerRepository
    // TauriAppointmentAdapter: implements AppointmentRepository
    // TauriEmployeeAdapter: implements EmployeeRepository
    // ... etc for all entities
  };
}
