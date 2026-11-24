import { connectorRegistry } from "./registry";
import { reconciliationEngine } from "./reconciliation-engine";
import { logger } from "../lib/logger";
import type { SyncOutcome, HealthReport } from "./types";

export class SyncEngine {
  private static instance: SyncEngine;
  private intervalTimer: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private lastSyncAt: Date | null = null;

  private constructor() {}

  static getInstance(): SyncEngine {
    if (!SyncEngine.instance) {
      SyncEngine.instance = new SyncEngine();
    }
    return SyncEngine.instance;
  }

  async start(intervalMs = 600000): Promise<void> {
    if (this.intervalTimer) return;

    logger.info({ intervalMs }, "Starting LANDSAFE Autonomous Government Data Synchronization Engine");

    // Initialize source definitions in database
    await connectorRegistry.initializeSources();

    // Initial background sync run
    this.runScheduledSync().catch((err) => {
      logger.error({ err: err.message }, "Error during initial background sync");
    });

    // Setup periodic scheduler
    this.intervalTimer = setInterval(() => {
      this.runScheduledSync().catch((err) => {
        logger.error({ err: err.message }, "Error during periodic background sync");
      });
    }, intervalMs);
  }

  stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
      logger.info("Autonomous Synchronization Engine stopped");
    }
  }

  async runScheduledSync(): Promise<SyncOutcome[]> {
    if (this.isSyncing) {
      logger.warn("Sync already in progress, skipping scheduled tick");
      return [];
    }

    this.isSyncing = true;
    logger.info("Starting scheduled autonomous multi-source sync tick...");

    try {
      const outcomes = await connectorRegistry.syncAll();
      this.lastSyncAt = new Date();

      // Trigger cross-source reconciliation
      await reconciliationEngine.reconcile();

      logger.info({ syncCount: outcomes.length }, "Scheduled sync tick completed successfully");
      return outcomes;
    } finally {
      this.isSyncing = false;
    }
  }

  async syncSource(code: string, userId?: number): Promise<SyncOutcome> {
    logger.info({ code, userId }, "Manual synchronization triggered for source");
    const outcome = await connectorRegistry.syncSource(code, userId);

    // Reconcile after manual sync
    await reconciliationEngine.reconcile();

    return outcome;
  }

  async verifySources(): Promise<HealthReport[]> {
    return connectorRegistry.verifyAll();
  }

  getStatus() {
    return {
      running: !!this.intervalTimer,
      isSyncing: this.isSyncing,
      lastSyncAt: this.lastSyncAt,
    };
  }
}

export const syncEngine = SyncEngine.getInstance();
