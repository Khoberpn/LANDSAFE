import {
  db,
  dataSourcesTable,
  dataSourceResourcesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import type { GovernmentConnector, HealthReport, SyncOutcome } from "./types";
import { BMKGConnector } from "./bmkg-connector";
import { BNPBConnector } from "./bnpb-connector";
import { BIGConnector } from "./big-connector";
import { PVMBGConnector } from "./pvmbg-connector";
import { BPSConnector } from "./bps-connector";

export class ConnectorRegistry {
  private static instance: ConnectorRegistry;
  private connectors = new Map<string, GovernmentConnector>();

  private constructor() {
    this.register(new BMKGConnector());
    this.register(new BNPBConnector());
    this.register(new BIGConnector());
    this.register(new PVMBGConnector());
    this.register(new BPSConnector());
  }

  static getInstance(): ConnectorRegistry {
    if (!ConnectorRegistry.instance) {
      ConnectorRegistry.instance = new ConnectorRegistry();
    }
    return ConnectorRegistry.instance;
  }

  register(connector: GovernmentConnector): void {
    this.connectors.set(connector.metadata.code, connector);
    logger.info({ code: connector.metadata.code, name: connector.metadata.name }, "Registered government data connector");
  }

  getConnector(code: string): GovernmentConnector | undefined {
    return this.connectors.get(code);
  }

  getAllConnectors(): GovernmentConnector[] {
    return Array.from(this.connectors.values());
  }

  async initializeSources(): Promise<void> {
    for (const connector of this.connectors.values()) {
      const meta = connector.metadata;
      try {
        const [existing] = await db
          .select({ id: dataSourcesTable.id })
          .from(dataSourcesTable)
          .where(eq(dataSourcesTable.code, meta.code))
          .limit(1);

        let sourceId: number;
        if (!existing) {
          const [created] = await db
            .insert(dataSourcesTable)
            .values({
              code: meta.code,
              name: meta.name,
              agency: meta.agency,
              category: meta.category,
              integrationType: "api",
              status: "connected",
              endpointUrl: meta.endpointUrl,
              updateFrequency: meta.updateFrequency,
              owner: meta.agency.toUpperCase(),
              description: meta.description,
              isSimulated: false,
              verificationStatus: meta.authRequired ? "access_required" : "verified_public",
              authType: meta.authType,
              license: meta.license,
              attribution: meta.attribution,
              documentationUrl: meta.documentationUrl,
              geographicCoverage: meta.geographicCoverage,
            })
            .returning({ id: dataSourcesTable.id });
          sourceId = created.id;
        } else {
          sourceId = existing.id;
          await db
            .update(dataSourcesTable)
            .set({
              name: meta.name,
              endpointUrl: meta.endpointUrl,
              owner: meta.agency.toUpperCase(),
              description: meta.description,
              authType: meta.authType,
              license: meta.license,
              attribution: meta.attribution,
              documentationUrl: meta.documentationUrl,
              geographicCoverage: meta.geographicCoverage,
              updatedAt: new Date(),
            })
            .where(eq(dataSourcesTable.id, sourceId));
        }

        // Register default resource if not exists
        const [existingResource] = await db
          .select({ id: dataSourceResourcesTable.id })
          .from(dataSourceResourcesTable)
          .where(eq(dataSourceResourcesTable.resourceCode, `${meta.code}-MAIN`))
          .limit(1);

        if (!existingResource) {
          await db.insert(dataSourceResourcesTable).values({
            sourceId,
            resourceCode: `${meta.code}-MAIN`,
            name: `${meta.name} - Titik Masuk Utama`,
            endpointUrl: meta.endpointUrl,
            format: meta.format,
            protocol: meta.protocol,
            updateFrequency: meta.updateFrequency,
            status: "active",
            authRequired: meta.authRequired,
            geographicCoverage: meta.geographicCoverage,
          });
        }
      } catch (err: any) {
        logger.warn({ err: err.message, code: meta.code }, "Error initializing data source in registry");
      }
    }
  }

  async verifyAll(): Promise<HealthReport[]> {
    const reports: HealthReport[] = [];
    for (const connector of this.connectors.values()) {
      try {
        const report = await connector.verify();
        reports.push(report);
      } catch (err: any) {
        reports.push({
          code: connector.metadata.code,
          status: "unavailable",
          verificationStatus: "temporarily_unavailable",
          lastCheckedAt: new Date(),
          lastSuccessAt: null,
          consecutiveFailures: 1,
          circuitBreakerOpen: true,
          message: `Pemeriksaan kesehatan gagal: ${err.message}`,
        });
      }
    }
    return reports;
  }

  async syncAll(): Promise<SyncOutcome[]> {
    const outcomes: SyncOutcome[] = [];
    for (const connector of this.connectors.values()) {
      try {
        const outcome = await connector.synchronize();
        outcomes.push(outcome);
      } catch (err: any) {
        outcomes.push({
          sourceCode: connector.metadata.code,
          status: "failed",
          recordsFetched: 0,
          recordsInserted: 0,
          recordsUpdated: 0,
          recordsRejected: 0,
          durationMs: 0,
          error: err.message,
        });
      }
    }
    return outcomes;
  }

  async syncSource(code: string, initiatedBy?: number): Promise<SyncOutcome> {
    const connector = this.connectors.get(code);
    if (!connector) {
      throw new Error(`Connector for code '${code}' not found.`);
    }
    return connector.synchronize(initiatedBy);
  }
}

export const connectorRegistry = ConnectorRegistry.getInstance();
