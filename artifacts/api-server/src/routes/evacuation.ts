/**
 * Evacuation Route Intelligence Module Routes
 *
 * Provides endpoints for:
 * 1. Public Portal (unauthenticated): whitelisted, published-only evacuation routes and basic segments
 * 2. BPBD Management (authenticated operator/admin): full lifecycle CRUD, route segmentation,
 *    field verification logging, and scenario-based multi-criteria evaluations
 */

import { Router } from "express";
import {
  db,
  evacuationRoutesTable,
  routeSegmentsTable,
  routeVerificationsTable,
  evacuationScenariosTable,
  facilitiesTable,
  usersTable,
} from "@workspace/db";
import { eq, and, asc, desc, inArray, count, sql } from "drizzle-orm";
import { z } from "zod";
import { authenticate, requireRole } from "../middlewares/auth";
import { recordAudit } from "../lib/audit";
import { parsePositiveInt } from "../lib/validation";

const router = Router();

// ─── Enums & Types ────────────────────────────────────────────────────────────

const HAZARD_TYPES = [
  "flood",
  "landslide",
  "earthquake",
  "volcanic",
  "tsunami",
  "drought",
  "strong_wind",
] as const;

const ROUTE_TYPES = ["primary", "alternative"] as const;
const HAZARD_EXPOSURES = ["none", "low", "moderate", "high"] as const;
const ROUTE_STATUSES = [
  "draft",
  "analysis",
  "field_verification",
  "review",
  "approved",
  "published",
  "archived",
] as const;
const ROAD_CONDITIONS = [
  "good",
  "fair",
  "poor",
  "damaged",
  "impassable",
  "unknown",
] as const;

type RouteRow = typeof evacuationRoutesTable.$inferSelect;
type SegmentRow = typeof routeSegmentsTable.$inferSelect;
type VerificationRow = typeof routeVerificationsTable.$inferSelect;
type ScenarioRow = typeof evacuationScenariosTable.$inferSelect;

// ─── Helpers & Serializers ───────────────────────────────────────────────────

function parseParamId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return parsePositiveInt(value);
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  return null;
}

function serializePublicRoute(row: RouteRow) {
  return {
    id: row.id,
    name: row.name,
    routeCode: row.routeCode,
    originName: row.originName,
    originLatitude: row.originLatitude,
    originLongitude: row.originLongitude,
    destinationName: row.destinationName,
    destinationLatitude: row.destinationLatitude,
    destinationLongitude: row.destinationLongitude,
    regionName: row.regionName,
    province: row.province,
    hazardType: row.hazardType,
    routeType: row.routeType,
    distanceKm: row.distanceKm,
    estimatedTimeMinutes: row.estimatedTimeMinutes,
    roadSurface: row.roadSurface,
    isAccessible: row.isAccessible,
    hazardExposure: row.hazardExposure,
    routeStatus: row.routeStatus,
    routeGeometry: row.routeGeometry,
    publicDescription: row.publicDescription,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    version: row.version,
  };
}

function serializeFullRoute(row: RouteRow) {
  return {
    id: row.id,
    name: row.name,
    routeCode: row.routeCode,
    originName: row.originName,
    originLatitude: row.originLatitude,
    originLongitude: row.originLongitude,
    destinationName: row.destinationName,
    destinationLatitude: row.destinationLatitude,
    destinationLongitude: row.destinationLongitude,
    destinationFacilityId: row.destinationFacilityId,
    regionName: row.regionName,
    province: row.province,
    hazardType: row.hazardType,
    routeType: row.routeType,
    distanceKm: row.distanceKm,
    estimatedTimeMinutes: row.estimatedTimeMinutes,
    maxCapacityPersons: row.maxCapacityPersons,
    elevationGainM: row.elevationGainM,
    roadSurface: row.roadSurface,
    isAccessible: row.isAccessible,
    hazardExposure: row.hazardExposure,
    routeStatus: row.routeStatus,
    routeGeometry: row.routeGeometry,
    evaluationNotes: row.evaluationNotes,
    publicDescription: row.publicDescription,
    createdBy: row.createdBy,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializePublicSegment(row: SegmentRow) {
  return {
    id: row.id,
    segmentOrder: row.segmentOrder,
    name: row.name,
    startLatitude: row.startLatitude,
    startLongitude: row.startLongitude,
    endLatitude: row.endLatitude,
    endLongitude: row.endLongitude,
    distanceKm: row.distanceKm,
    roadCondition: row.roadCondition,
    isBlocked: row.isBlocked,
  };
}

function serializeSegment(row: SegmentRow) {
  return {
    id: row.id,
    routeId: row.routeId,
    segmentOrder: row.segmentOrder,
    name: row.name,
    startLatitude: row.startLatitude,
    startLongitude: row.startLongitude,
    endLatitude: row.endLatitude,
    endLongitude: row.endLongitude,
    distanceKm: row.distanceKm,
    roadCondition: row.roadCondition,
    roadWidth: row.roadWidth,
    hazardNotes: row.hazardNotes,
    isBlocked: row.isBlocked,
    blockageReason: row.blockageReason,
    lastInspectedAt: row.lastInspectedAt ? row.lastInspectedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeVerification(row: VerificationRow) {
  return {
    id: row.id,
    routeId: row.routeId,
    inspectorId: row.inspectorId,
    inspectorName: row.inspectorName,
    inspectionDate: row.inspectionDate.toISOString(),
    overallCondition: row.overallCondition,
    roadAccessible: row.roadAccessible,
    signageAdequate: row.signageAdequate,
    shelterReady: row.shelterReady,
    lightingAvailable: row.lightingAvailable,
    drainageAdequate: row.drainageAdequate,
    findings: row.findings,
    recommendations: row.recommendations,
    geotagPhotos: row.geotagPhotos,
    gpsTrack: row.gpsTrack,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeScenario(row: ScenarioRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    hazardType: row.hazardType,
    regionName: row.regionName,
    parameters: row.parameters,
    candidateRoutes: row.candidateRoutes,
    recommendation: row.recommendation,
    status: row.status,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}

// ─── Inline Validation Schemas ───────────────────────────────────────────────

const CreateEvacuationRouteBody = z.object({
  name: z.string().min(1, "Nama rute wajib diisi"),
  routeCode: z.string().min(1, "Kode rute wajib diisi"),
  originName: z.string().min(1, "Titik awal wajib diisi"),
  originLatitude: z.number({ required_error: "Latitude asal wajib diisi" }),
  originLongitude: z.number({ required_error: "Longitude asal wajib diisi" }),
  destinationName: z.string().min(1, "Titik tujuan wajib diisi"),
  destinationLatitude: z.number({ required_error: "Latitude tujuan wajib diisi" }),
  destinationLongitude: z.number({ required_error: "Longitude tujuan wajib diisi" }),
  destinationFacilityId: z.number().int().positive().nullable().optional(),
  regionName: z.string().min(1, "Nama wilayah wajib diisi"),
  province: z.string().optional().default("Central Java"),
  hazardType: z.enum(HAZARD_TYPES),
  routeType: z.enum(ROUTE_TYPES).optional().default("primary"),
  distanceKm: z.number().nonnegative().optional().default(0),
  estimatedTimeMinutes: z.number().int().nonnegative().optional().default(0),
  maxCapacityPersons: z.number().int().nonnegative().optional().default(0),
  elevationGainM: z.number().optional().default(0),
  roadSurface: z.string().nullable().optional(),
  isAccessible: z.boolean().optional().default(false),
  hazardExposure: z.enum(HAZARD_EXPOSURES).optional().default("none"),
  routeGeometry: z.array(z.tuple([z.number(), z.number()])).optional().default([]),
  evaluationNotes: z.string().nullable().optional(),
  publicDescription: z.string().nullable().optional(),
});

const UpdateEvacuationRouteBody = z.object({
  name: z.string().min(1).optional(),
  routeCode: z.string().min(1).optional(),
  originName: z.string().min(1).optional(),
  originLatitude: z.number().optional(),
  originLongitude: z.number().optional(),
  destinationName: z.string().min(1).optional(),
  destinationLatitude: z.number().optional(),
  destinationLongitude: z.number().optional(),
  destinationFacilityId: z.number().int().positive().nullable().optional(),
  regionName: z.string().min(1).optional(),
  province: z.string().optional(),
  hazardType: z.enum(HAZARD_TYPES).optional(),
  routeType: z.enum(ROUTE_TYPES).optional(),
  distanceKm: z.number().nonnegative().optional(),
  estimatedTimeMinutes: z.number().int().nonnegative().optional(),
  maxCapacityPersons: z.number().int().nonnegative().optional(),
  elevationGainM: z.number().optional(),
  roadSurface: z.string().nullable().optional(),
  isAccessible: z.boolean().optional(),
  hazardExposure: z.enum(HAZARD_EXPOSURES).optional(),
  routeGeometry: z.array(z.tuple([z.number(), z.number()])).optional(),
  evaluationNotes: z.string().nullable().optional(),
  publicDescription: z.string().nullable().optional(),
});

const CreateSegmentBody = z.object({
  segmentOrder: z.number().int().nonnegative().optional(),
  name: z.string().min(1, "Nama segmen wajib diisi"),
  startLatitude: z.number({ required_error: "Start latitude wajib diisi" }),
  startLongitude: z.number({ required_error: "Start longitude wajib diisi" }),
  endLatitude: z.number({ required_error: "End latitude wajib diisi" }),
  endLongitude: z.number({ required_error: "End longitude wajib diisi" }),
  distanceKm: z.number().nonnegative().optional().default(0),
  roadCondition: z.enum(ROAD_CONDITIONS).optional().default("unknown"),
  roadWidth: z.string().nullable().optional(),
  hazardNotes: z.string().nullable().optional(),
  isBlocked: z.boolean().optional().default(false),
  blockageReason: z.string().nullable().optional(),
  lastInspectedAt: z.string().nullable().optional(),
});

const UpdateSegmentBody = z.object({
  segmentOrder: z.number().int().nonnegative().optional(),
  name: z.string().min(1).optional(),
  startLatitude: z.number().optional(),
  startLongitude: z.number().optional(),
  endLatitude: z.number().optional(),
  endLongitude: z.number().optional(),
  distanceKm: z.number().nonnegative().optional(),
  roadCondition: z.enum(ROAD_CONDITIONS).optional(),
  roadWidth: z.string().nullable().optional(),
  hazardNotes: z.string().nullable().optional(),
  isBlocked: z.boolean().optional(),
  blockageReason: z.string().nullable().optional(),
  lastInspectedAt: z.string().nullable().optional(),
});

const CreateVerificationBody = z.object({
  inspectorName: z.string().optional(),
  inspectionDate: z.string().optional(),
  overallCondition: z.enum(ROAD_CONDITIONS),
  roadAccessible: z.boolean().optional().default(true),
  signageAdequate: z.boolean().optional().default(false),
  shelterReady: z.boolean().optional().default(false),
  lightingAvailable: z.boolean().optional().default(false),
  drainageAdequate: z.boolean().optional().default(false),
  findings: z.string().min(1, "Temuan inspeksi wajib diisi"),
  recommendations: z.string().nullable().optional(),
  geotagPhotos: z
    .array(
      z.object({
        url: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        caption: z.string(),
      }),
    )
    .optional()
    .default([]),
  gpsTrack: z.array(z.tuple([z.number(), z.number()])).optional().default([]),
});

const CreateEvacuationScenarioBody = z.object({
  name: z.string().min(1, "Nama skenario wajib diisi"),
  description: z.string().nullable().optional(),
  hazardType: z.enum(HAZARD_TYPES),
  regionName: z.string().min(1, "Nama wilayah wajib diisi"),
  parameters: z.record(z.string(), z.unknown()).optional().default({}),
  candidateRoutes: z
    .array(
      z.object({
        routeId: z.number().optional(),
        name: z.string(),
        score: z.number(),
        travelTime: z.number(),
        hazardExposure: z.string(),
        notes: z.string(),
      }),
    )
    .optional()
    .default([]),
  recommendation: z.string().nullable().optional(),
  status: z.string().optional().default("draft"),
});

// ─── Workflow Transitions ─────────────────────────────────────────────────────

type RouteTransitionAction =
  | "submit_analysis"
  | "submit_verification"
  | "submit_review"
  | "approve"
  | "publish"
  | "return_draft"
  | "archive";

interface TransitionRule {
  from: Array<(typeof ROUTE_STATUSES)[number]>;
  to: (typeof ROUTE_STATUSES)[number];
  roles: ("operator" | "admin")[];
  label: string;
}

const ROUTE_TRANSITIONS: Record<RouteTransitionAction, TransitionRule> = {
  submit_analysis: {
    from: ["draft"],
    to: "analysis",
    roles: ["operator", "admin"],
    label: "Pengajuan analisis rute",
  },
  submit_verification: {
    from: ["analysis"],
    to: "field_verification",
    roles: ["operator", "admin"],
    label: "Pengajuan verifikasi lapangan",
  },
  submit_review: {
    from: ["field_verification"],
    to: "review",
    roles: ["operator", "admin"],
    label: "Pengajuan peninjauan rute",
  },
  approve: {
    from: ["review"],
    to: "approved",
    roles: ["admin"],
    label: "Persetujuan rute",
  },
  publish: {
    from: ["approved"],
    to: "published",
    roles: ["admin"],
    label: "Publikasi rute",
  },
  return_draft: {
    from: ["analysis", "field_verification", "review", "approved"],
    to: "draft",
    roles: ["admin"],
    label: "Pengembalian ke draf",
  },
  archive: {
    from: ["published"],
    to: "archived",
    roles: ["admin"],
    label: "Pengarsipan rute",
  },
};

// ─── PUBLIC ENDPOINTS (no authentication) ────────────────────────────────────

/**
 * GET /public/evacuation/routes
 * List all published evacuation routes with public-safe fields.
 */
router.get("/public/evacuation/routes", async (req, res): Promise<void> => {
  const conditions = [eq(evacuationRoutesTable.routeStatus, "published")];

  const regionName = typeof req.query.regionName === "string" ? req.query.regionName.trim() : undefined;
  if (regionName) {
    conditions.push(eq(evacuationRoutesTable.regionName, regionName));
  }

  const hazardType = typeof req.query.hazardType === "string" ? req.query.hazardType.trim() : undefined;
  if (hazardType) {
    if (HAZARD_TYPES.includes(hazardType as (typeof HAZARD_TYPES)[number])) {
      conditions.push(eq(evacuationRoutesTable.hazardType, hazardType as (typeof HAZARD_TYPES)[number]));
    } else {
      res.status(400).json({ error: "Unknown hazard type" });
      return;
    }
  }

  const destinationType = typeof req.query.destinationType === "string" ? req.query.destinationType.trim() : undefined;
  if (destinationType) {
    const matchingFacilities = await db
      .select({ id: facilitiesTable.id })
      .from(facilitiesTable)
      .where(and(eq(facilitiesTable.type, destinationType as any), eq(facilitiesTable.isPublic, true)));

    const facilityIds = matchingFacilities.map((f) => f.id);
    if (facilityIds.length === 0) {
      res.json([]);
      return;
    }
    conditions.push(inArray(evacuationRoutesTable.destinationFacilityId, facilityIds));
  }

  const rows = await db
    .select()
    .from(evacuationRoutesTable)
    .where(and(...conditions))
    .orderBy(asc(evacuationRoutesTable.routeType), asc(evacuationRoutesTable.name));

  res.json(rows.map(serializePublicRoute));
});

/**
 * GET /public/evacuation/routes/:id
 * Retrieve a single published evacuation route with public segments and destination facility.
 */
router.get("/public/evacuation/routes/:id", async (req, res): Promise<void> => {
  const id = parseParamId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid route ID" });
    return;
  }

  const [route] = await db
    .select()
    .from(evacuationRoutesTable)
    .where(and(eq(evacuationRoutesTable.id, id), eq(evacuationRoutesTable.routeStatus, "published")))
    .limit(1);

  if (!route) {
    res.status(404).json({ error: "Evacuation route not found or not published" });
    return;
  }

  const segments = await db
    .select()
    .from(routeSegmentsTable)
    .where(eq(routeSegmentsTable.routeId, route.id))
    .orderBy(asc(routeSegmentsTable.segmentOrder));

  let destinationFacility = null;
  if (route.destinationFacilityId) {
    const [facility] = await db
      .select({
        id: facilitiesTable.id,
        name: facilitiesTable.name,
        type: facilitiesTable.type,
        capacity: facilitiesTable.capacity,
        address: facilitiesTable.address,
      })
      .from(facilitiesTable)
      .where(and(eq(facilitiesTable.id, route.destinationFacilityId), eq(facilitiesTable.isPublic, true)))
      .limit(1);

    if (facility) {
      destinationFacility = facility;
    }
  }

  res.json({
    ...serializePublicRoute(route),
    segments: segments.map(serializePublicSegment),
    destinationFacility,
  });
});

// ─── BPBD ROUTE MANAGEMENT (operator/admin) ──────────────────────────────────

/**
 * GET /evacuation/routes
 * List all evacuation routes (all statuses) with full metadata.
 */
router.get(
  "/evacuation/routes",
  authenticate,
  requireRole("operator", "admin"),
  async (req, res): Promise<void> => {
    const conditions = [];

    const regionName = typeof req.query.regionName === "string" ? req.query.regionName.trim() : undefined;
    if (regionName) {
      conditions.push(eq(evacuationRoutesTable.regionName, regionName));
    }

    const hazardType = typeof req.query.hazardType === "string" ? req.query.hazardType.trim() : undefined;
    if (hazardType) {
      if (HAZARD_TYPES.includes(hazardType as (typeof HAZARD_TYPES)[number])) {
        conditions.push(eq(evacuationRoutesTable.hazardType, hazardType as (typeof HAZARD_TYPES)[number]));
      } else {
        res.status(400).json({ error: "Unknown hazard type" });
        return;
      }
    }

    const routeStatus = typeof req.query.routeStatus === "string" ? req.query.routeStatus.trim() : undefined;
    if (routeStatus) {
      if (ROUTE_STATUSES.includes(routeStatus as (typeof ROUTE_STATUSES)[number])) {
        conditions.push(eq(evacuationRoutesTable.routeStatus, routeStatus as (typeof ROUTE_STATUSES)[number]));
      } else {
        res.status(400).json({ error: "Unknown route status" });
        return;
      }
    }

    const rows = await db
      .select()
      .from(evacuationRoutesTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(evacuationRoutesTable.updatedAt));

    res.json(rows.map(serializeFullRoute));
  },
);

/**
 * POST /evacuation/routes
 * Create a new evacuation route in draft status.
 */
router.post(
  "/evacuation/routes",
  authenticate,
  requireRole("operator", "admin"),
  async (req, res): Promise<void> => {
    const parsed = CreateEvacuationRouteBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [existingCode] = await db
      .select({ id: evacuationRoutesTable.id })
      .from(evacuationRoutesTable)
      .where(eq(evacuationRoutesTable.routeCode, parsed.data.routeCode))
      .limit(1);

    if (existingCode) {
      res.status(409).json({ error: "Route code already exists" });
      return;
    }

    const [created] = await db
      .insert(evacuationRoutesTable)
      .values({
        name: parsed.data.name,
        routeCode: parsed.data.routeCode,
        originName: parsed.data.originName,
        originLatitude: parsed.data.originLatitude,
        originLongitude: parsed.data.originLongitude,
        destinationName: parsed.data.destinationName,
        destinationLatitude: parsed.data.destinationLatitude,
        destinationLongitude: parsed.data.destinationLongitude,
        destinationFacilityId: parsed.data.destinationFacilityId ?? null,
        regionName: parsed.data.regionName,
        province: parsed.data.province ?? "Central Java",
        hazardType: parsed.data.hazardType,
        routeType: parsed.data.routeType ?? "primary",
        distanceKm: parsed.data.distanceKm ?? 0,
        estimatedTimeMinutes: parsed.data.estimatedTimeMinutes ?? 0,
        maxCapacityPersons: parsed.data.maxCapacityPersons ?? 0,
        elevationGainM: parsed.data.elevationGainM ?? 0,
        roadSurface: parsed.data.roadSurface ?? null,
        isAccessible: parsed.data.isAccessible ?? false,
        hazardExposure: parsed.data.hazardExposure ?? "none",
        routeStatus: "draft",
        routeGeometry: parsed.data.routeGeometry ?? [],
        evaluationNotes: parsed.data.evaluationNotes ?? null,
        publicDescription: parsed.data.publicDescription ?? null,
        createdBy: req.user!.userId,
        version: 1,
      })
      .returning();

    await recordAudit(req, "evacuation_route.create", "evacuation_route", created!.id, {
      name: created!.name,
      routeCode: created!.routeCode,
      regionName: created!.regionName,
      hazardType: created!.hazardType,
    });

    res.status(201).json(serializeFullRoute(created!));
  },
);

/**
 * GET /evacuation/routes/:id
 * Full route detail including segments, verifications, scenario links, and facility details.
 */
router.get(
  "/evacuation/routes/:id",
  authenticate,
  requireRole("operator", "admin"),
  async (req, res): Promise<void> => {
    const id = parseParamId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid route ID" });
      return;
    }

    const [route] = await db
      .select()
      .from(evacuationRoutesTable)
      .where(eq(evacuationRoutesTable.id, id))
      .limit(1);

    if (!route) {
      res.status(404).json({ error: "Evacuation route not found" });
      return;
    }

    const segments = await db
      .select()
      .from(routeSegmentsTable)
      .where(eq(routeSegmentsTable.routeId, route.id))
      .orderBy(asc(routeSegmentsTable.segmentOrder));

    const verifications = await db
      .select()
      .from(routeVerificationsTable)
      .where(eq(routeVerificationsTable.routeId, route.id))
      .orderBy(desc(routeVerificationsTable.inspectionDate));

    const allScenarios = await db
      .select()
      .from(evacuationScenariosTable)
      .orderBy(desc(evacuationScenariosTable.createdAt));

    const matchingScenarios = allScenarios
      .filter((s) => Array.isArray(s.candidateRoutes) && s.candidateRoutes.some((c) => c.routeId === route.id))
      .map(serializeScenario);

    let destinationFacility = null;
    if (route.destinationFacilityId) {
      const [facility] = await db
        .select()
        .from(facilitiesTable)
        .where(eq(facilitiesTable.id, route.destinationFacilityId))
        .limit(1);

      if (facility) {
        destinationFacility = {
          id: facility.id,
          name: facility.name,
          type: facility.type,
          regionName: facility.regionName,
          province: facility.province,
          address: facility.address,
          latitude: facility.latitude,
          longitude: facility.longitude,
          capacity: facility.capacity,
          occupancy: facility.occupancy,
          status: facility.status,
          isPublic: facility.isPublic,
          contact: facility.contact,
          operatingAgency: facility.operatingAgency,
        };
      }
    }

    res.json({
      ...serializeFullRoute(route),
      segments: segments.map(serializeSegment),
      verifications: verifications.map(serializeVerification),
      scenarios: matchingScenarios,
      destinationFacility,
    });
  },
);

/**
 * PATCH /evacuation/routes/:id
 * Update route fields (only allowed in draft or analysis status). Increments version.
 */
router.patch(
  "/evacuation/routes/:id",
  authenticate,
  requireRole("operator", "admin"),
  async (req, res): Promise<void> => {
    const id = parseParamId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid route ID" });
      return;
    }

    const [existing] = await db
      .select()
      .from(evacuationRoutesTable)
      .where(eq(evacuationRoutesTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Evacuation route not found" });
      return;
    }

    if (existing.routeStatus !== "draft" && existing.routeStatus !== "analysis") {
      res.status(409).json({
        error: "Rute terkunci. Hanya rute berstatus draf atau analisis yang dapat diperbarui.",
      });
      return;
    }

    const parsed = UpdateEvacuationRouteBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    if (parsed.data.routeCode && parsed.data.routeCode !== existing.routeCode) {
      const [duplicate] = await db
        .select({ id: evacuationRoutesTable.id })
        .from(evacuationRoutesTable)
        .where(eq(evacuationRoutesTable.routeCode, parsed.data.routeCode))
        .limit(1);

      if (duplicate) {
        res.status(409).json({ error: "Route code already exists" });
        return;
      }
    }

    const updates: Partial<typeof evacuationRoutesTable.$inferInsert> = {};
    const d = parsed.data;
    if (d.name !== undefined) updates.name = d.name;
    if (d.routeCode !== undefined) updates.routeCode = d.routeCode;
    if (d.originName !== undefined) updates.originName = d.originName;
    if (d.originLatitude !== undefined) updates.originLatitude = d.originLatitude;
    if (d.originLongitude !== undefined) updates.originLongitude = d.originLongitude;
    if (d.destinationName !== undefined) updates.destinationName = d.destinationName;
    if (d.destinationLatitude !== undefined) updates.destinationLatitude = d.destinationLatitude;
    if (d.destinationLongitude !== undefined) updates.destinationLongitude = d.destinationLongitude;
    if (d.destinationFacilityId !== undefined) updates.destinationFacilityId = d.destinationFacilityId;
    if (d.regionName !== undefined) updates.regionName = d.regionName;
    if (d.province !== undefined) updates.province = d.province;
    if (d.hazardType !== undefined) updates.hazardType = d.hazardType;
    if (d.routeType !== undefined) updates.routeType = d.routeType;
    if (d.distanceKm !== undefined) updates.distanceKm = d.distanceKm;
    if (d.estimatedTimeMinutes !== undefined) updates.estimatedTimeMinutes = d.estimatedTimeMinutes;
    if (d.maxCapacityPersons !== undefined) updates.maxCapacityPersons = d.maxCapacityPersons;
    if (d.elevationGainM !== undefined) updates.elevationGainM = d.elevationGainM;
    if (d.roadSurface !== undefined) updates.roadSurface = d.roadSurface;
    if (d.isAccessible !== undefined) updates.isAccessible = d.isAccessible;
    if (d.hazardExposure !== undefined) updates.hazardExposure = d.hazardExposure;
    if (d.routeGeometry !== undefined) updates.routeGeometry = d.routeGeometry;
    if (d.evaluationNotes !== undefined) updates.evaluationNotes = d.evaluationNotes;
    if (d.publicDescription !== undefined) updates.publicDescription = d.publicDescription;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No update fields provided" });
      return;
    }

    updates.version = existing.version + 1;
    updates.updatedAt = new Date();

    const [updated] = await db
      .update(evacuationRoutesTable)
      .set(updates)
      .where(eq(evacuationRoutesTable.id, existing.id))
      .returning();

    await recordAudit(req, "evacuation_route.update", "evacuation_route", existing.id, {
      fields: Object.keys(updates),
      version: updates.version,
    });

    res.json(serializeFullRoute(updated!));
  },
);

/**
 * DELETE /evacuation/routes/:id
 * Delete a route (admin only, draft status only). Also removes segments and verifications.
 */
router.delete(
  "/evacuation/routes/:id",
  authenticate,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = parseParamId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid route ID" });
      return;
    }

    const [existing] = await db
      .select()
      .from(evacuationRoutesTable)
      .where(eq(evacuationRoutesTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Evacuation route not found" });
      return;
    }

    if (existing.routeStatus !== "draft") {
      res.status(409).json({ error: "Hanya rute berstatus draf yang dapat dihapus" });
      return;
    }

    await db.delete(routeSegmentsTable).where(eq(routeSegmentsTable.routeId, existing.id));
    await db.delete(routeVerificationsTable).where(eq(routeVerificationsTable.routeId, existing.id));
    await db.delete(evacuationRoutesTable).where(eq(evacuationRoutesTable.id, existing.id));

    await recordAudit(req, "evacuation_route.delete", "evacuation_route", existing.id, {
      name: existing.name,
      routeCode: existing.routeCode,
    });

    res.status(204).end();
  },
);

/**
 * POST /evacuation/routes/:id/transition
 * Perform a status transition according to the workflow state machine.
 */
router.post(
  "/evacuation/routes/:id/transition",
  authenticate,
  requireRole("operator", "admin"),
  async (req, res): Promise<void> => {
    const id = parseParamId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid route ID" });
      return;
    }

    const actionSchema = z.object({
      action: z.enum([
        "submit_analysis",
        "submit_verification",
        "submit_review",
        "approve",
        "publish",
        "return_draft",
        "archive",
      ]),
    });

    const parsed = actionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const action = parsed.data.action as RouteTransitionAction;
    const rule = ROUTE_TRANSITIONS[action];
    if (!rule) {
      res.status(400).json({ error: "Unknown transition action" });
      return;
    }

    const userRole = req.user!.role as "operator" | "admin";
    if (!rule.roles.includes(userRole)) {
      res.status(403).json({
        error: `Hanya peran ${rule.roles.join("/")} yang diizinkan melakukan tindakan ${action}`,
      });
      return;
    }

    const [existing] = await db
      .select()
      .from(evacuationRoutesTable)
      .where(eq(evacuationRoutesTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Evacuation route not found" });
      return;
    }

    if (!rule.from.includes(existing.routeStatus)) {
      res.status(400).json({
        error: `Transisi tidak valid: status saat ini "${existing.routeStatus}" tidak dapat berpindah ke "${rule.to}" via tindakan "${action}". Status asal yang diizinkan: ${rule.from.join(", ")}.`,
      });
      return;
    }

    // Workflow rule: submit_review requires at least one verification record
    if (action === "submit_review") {
      const [verResult] = await db
        .select({ count: count() })
        .from(routeVerificationsTable)
        .where(eq(routeVerificationsTable.routeId, existing.id));

      const verCount = Number(verResult?.count ?? 0);
      if (verCount === 0) {
        res.status(400).json({
          error: "Rute memerlukan minimal satu catatan verifikasi lapangan sebelum diajukan untuk ditinjau.",
        });
        return;
      }
    }

    const updates: Partial<typeof evacuationRoutesTable.$inferInsert> = {
      routeStatus: rule.to,
      updatedAt: new Date(),
    };

    if (action === "submit_review") {
      updates.reviewedBy = req.user!.userId;
      updates.reviewedAt = new Date();
    } else if (action === "approve") {
      updates.approvedBy = req.user!.userId;
      updates.approvedAt = new Date();
    } else if (action === "publish") {
      updates.publishedAt = new Date();
    } else if (action === "return_draft") {
      updates.approvedBy = null;
      updates.approvedAt = null;
      updates.reviewedBy = null;
      updates.reviewedAt = null;
    }

    const [updated] = await db
      .update(evacuationRoutesTable)
      .set(updates)
      .where(eq(evacuationRoutesTable.id, existing.id))
      .returning();

    await recordAudit(req, `evacuation_route.${action}`, "evacuation_route", existing.id, {
      from: existing.routeStatus,
      to: rule.to,
      action,
      label: rule.label,
    });

    res.json(serializeFullRoute(updated!));
  },
);

// ─── ROUTE SEGMENTS (operator/admin) ─────────────────────────────────────────

/**
 * GET /evacuation/routes/:routeId/segments
 * List segments for a specific route, ordered by segmentOrder.
 */
router.get(
  "/evacuation/routes/:routeId/segments",
  authenticate,
  requireRole("operator", "admin"),
  async (req, res): Promise<void> => {
    const routeId = parseParamId(req.params.routeId);
    if (!routeId) {
      res.status(400).json({ error: "Invalid route ID" });
      return;
    }

    const [route] = await db
      .select({ id: evacuationRoutesTable.id })
      .from(evacuationRoutesTable)
      .where(eq(evacuationRoutesTable.id, routeId))
      .limit(1);

    if (!route) {
      res.status(404).json({ error: "Evacuation route not found" });
      return;
    }

    const segments = await db
      .select()
      .from(routeSegmentsTable)
      .where(eq(routeSegmentsTable.routeId, routeId))
      .orderBy(asc(routeSegmentsTable.segmentOrder));

    res.json(segments.map(serializeSegment));
  },
);

/**
 * POST /evacuation/routes/:routeId/segments
 * Add a segment to an evacuation route.
 */
router.post(
  "/evacuation/routes/:routeId/segments",
  authenticate,
  requireRole("operator", "admin"),
  async (req, res): Promise<void> => {
    const routeId = parseParamId(req.params.routeId);
    if (!routeId) {
      res.status(400).json({ error: "Invalid route ID" });
      return;
    }

    const [route] = await db
      .select({ id: evacuationRoutesTable.id })
      .from(evacuationRoutesTable)
      .where(eq(evacuationRoutesTable.id, routeId))
      .limit(1);

    if (!route) {
      res.status(404).json({ error: "Evacuation route not found" });
      return;
    }

    const parsed = CreateSegmentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    let segmentOrder = parsed.data.segmentOrder;
    if (segmentOrder === undefined) {
      const [maxOrderRow] = await db
        .select({ maxOrder: sql<number>`COALESCE(MAX(${routeSegmentsTable.segmentOrder}), -1)` })
        .from(routeSegmentsTable)
        .where(eq(routeSegmentsTable.routeId, routeId));
      segmentOrder = Number(maxOrderRow?.maxOrder ?? -1) + 1;
    }

    const [created] = await db
      .insert(routeSegmentsTable)
      .values({
        routeId,
        segmentOrder,
        name: parsed.data.name,
        startLatitude: parsed.data.startLatitude,
        startLongitude: parsed.data.startLongitude,
        endLatitude: parsed.data.endLatitude,
        endLongitude: parsed.data.endLongitude,
        distanceKm: parsed.data.distanceKm ?? 0,
        roadCondition: parsed.data.roadCondition ?? "unknown",
        roadWidth: parsed.data.roadWidth ?? null,
        hazardNotes: parsed.data.hazardNotes ?? null,
        isBlocked: parsed.data.isBlocked ?? false,
        blockageReason: parsed.data.blockageReason ?? null,
        lastInspectedAt: parseDate(parsed.data.lastInspectedAt),
      })
      .returning();

    await recordAudit(req, "evacuation_segment.create", "evacuation_segment", created!.id, {
      routeId,
      name: created!.name,
      segmentOrder: created!.segmentOrder,
    });

    res.status(201).json(serializeSegment(created!));
  },
);

/**
 * PATCH /evacuation/routes/:routeId/segments/:id
 * Update an existing route segment.
 */
router.patch(
  "/evacuation/routes/:routeId/segments/:id",
  authenticate,
  requireRole("operator", "admin"),
  async (req, res): Promise<void> => {
    const routeId = parseParamId(req.params.routeId);
    const id = parseParamId(req.params.id);
    if (!routeId || !id) {
      res.status(400).json({ error: "Invalid route ID or segment ID" });
      return;
    }

    const [existing] = await db
      .select()
      .from(routeSegmentsTable)
      .where(and(eq(routeSegmentsTable.id, id), eq(routeSegmentsTable.routeId, routeId)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Route segment not found" });
      return;
    }

    const parsed = UpdateSegmentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const updates: Partial<typeof routeSegmentsTable.$inferInsert> = {};
    const d = parsed.data;
    if (d.segmentOrder !== undefined) updates.segmentOrder = d.segmentOrder;
    if (d.name !== undefined) updates.name = d.name;
    if (d.startLatitude !== undefined) updates.startLatitude = d.startLatitude;
    if (d.startLongitude !== undefined) updates.startLongitude = d.startLongitude;
    if (d.endLatitude !== undefined) updates.endLatitude = d.endLatitude;
    if (d.endLongitude !== undefined) updates.endLongitude = d.endLongitude;
    if (d.distanceKm !== undefined) updates.distanceKm = d.distanceKm;
    if (d.roadCondition !== undefined) updates.roadCondition = d.roadCondition;
    if (d.roadWidth !== undefined) updates.roadWidth = d.roadWidth;
    if (d.hazardNotes !== undefined) updates.hazardNotes = d.hazardNotes;
    if (d.isBlocked !== undefined) updates.isBlocked = d.isBlocked;
    if (d.blockageReason !== undefined) updates.blockageReason = d.blockageReason;
    if (d.lastInspectedAt !== undefined) updates.lastInspectedAt = parseDate(d.lastInspectedAt);

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No update fields provided" });
      return;
    }

    updates.updatedAt = new Date();

    const [updated] = await db
      .update(routeSegmentsTable)
      .set(updates)
      .where(eq(routeSegmentsTable.id, existing.id))
      .returning();

    await recordAudit(req, "evacuation_segment.update", "evacuation_segment", existing.id, {
      routeId,
      fields: Object.keys(updates),
    });

    res.json(serializeSegment(updated!));
  },
);

/**
 * DELETE /evacuation/routes/:routeId/segments/:id
 * Delete a route segment.
 */
router.delete(
  "/evacuation/routes/:routeId/segments/:id",
  authenticate,
  requireRole("operator", "admin"),
  async (req, res): Promise<void> => {
    const routeId = parseParamId(req.params.routeId);
    const id = parseParamId(req.params.id);
    if (!routeId || !id) {
      res.status(400).json({ error: "Invalid route ID or segment ID" });
      return;
    }

    const [existing] = await db
      .select()
      .from(routeSegmentsTable)
      .where(and(eq(routeSegmentsTable.id, id), eq(routeSegmentsTable.routeId, routeId)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Route segment not found" });
      return;
    }

    await db.delete(routeSegmentsTable).where(eq(routeSegmentsTable.id, existing.id));

    await recordAudit(req, "evacuation_segment.delete", "evacuation_segment", existing.id, {
      routeId,
      name: existing.name,
    });

    res.status(204).end();
  },
);

// ─── ROUTE VERIFICATIONS (operator/admin) ────────────────────────────────────

/**
 * GET /evacuation/routes/:routeId/verifications
 * List verification records for a route.
 */
router.get(
  "/evacuation/routes/:routeId/verifications",
  authenticate,
  requireRole("operator", "admin"),
  async (req, res): Promise<void> => {
    const routeId = parseParamId(req.params.routeId);
    if (!routeId) {
      res.status(400).json({ error: "Invalid route ID" });
      return;
    }

    const [route] = await db
      .select({ id: evacuationRoutesTable.id })
      .from(evacuationRoutesTable)
      .where(eq(evacuationRoutesTable.id, routeId))
      .limit(1);

    if (!route) {
      res.status(404).json({ error: "Evacuation route not found" });
      return;
    }

    const verifications = await db
      .select()
      .from(routeVerificationsTable)
      .where(eq(routeVerificationsTable.routeId, routeId))
      .orderBy(desc(routeVerificationsTable.inspectionDate));

    res.json(verifications.map(serializeVerification));
  },
);

/**
 * POST /evacuation/routes/:routeId/verifications
 * Record a field inspection for a route.
 */
router.post(
  "/evacuation/routes/:routeId/verifications",
  authenticate,
  requireRole("operator", "admin"),
  async (req, res): Promise<void> => {
    const routeId = parseParamId(req.params.routeId);
    if (!routeId) {
      res.status(400).json({ error: "Invalid route ID" });
      return;
    }

    const [route] = await db
      .select({ id: evacuationRoutesTable.id })
      .from(evacuationRoutesTable)
      .where(eq(evacuationRoutesTable.id, routeId))
      .limit(1);

    if (!route) {
      res.status(404).json({ error: "Evacuation route not found" });
      return;
    }

    const parsed = CreateVerificationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    let inspectorName = parsed.data.inspectorName;
    if (!inspectorName) {
      const [user] = await db
        .select({ name: usersTable.name })
        .from(usersTable)
        .where(eq(usersTable.id, req.user!.userId))
        .limit(1);
      inspectorName = user?.name ?? req.user!.email;
    }

    const inspectionDate = parseDate(parsed.data.inspectionDate) ?? new Date();

    const [created] = await db
      .insert(routeVerificationsTable)
      .values({
        routeId,
        inspectorId: req.user!.userId,
        inspectorName,
        inspectionDate,
        overallCondition: parsed.data.overallCondition,
        roadAccessible: parsed.data.roadAccessible ?? true,
        signageAdequate: parsed.data.signageAdequate ?? false,
        shelterReady: parsed.data.shelterReady ?? false,
        lightingAvailable: parsed.data.lightingAvailable ?? false,
        drainageAdequate: parsed.data.drainageAdequate ?? false,
        findings: parsed.data.findings,
        recommendations: parsed.data.recommendations ?? null,
        geotagPhotos: parsed.data.geotagPhotos ?? [],
        gpsTrack: parsed.data.gpsTrack ?? [],
      })
      .returning();

    await recordAudit(req, "evacuation_verification.create", "route_verification", created!.id, {
      routeId,
      overallCondition: created!.overallCondition,
      inspectorName: created!.inspectorName,
    });

    res.status(201).json(serializeVerification(created!));
  },
);

// ─── EVACUATION SCENARIOS (operator/admin) ───────────────────────────────────

/**
 * GET /evacuation/scenarios
 * Query evacuation scenario evaluations.
 */
router.get(
  "/evacuation/scenarios",
  authenticate,
  requireRole("operator", "admin"),
  async (req, res): Promise<void> => {
    const conditions = [];

    const regionName = typeof req.query.regionName === "string" ? req.query.regionName.trim() : undefined;
    if (regionName) {
      conditions.push(eq(evacuationScenariosTable.regionName, regionName));
    }

    const hazardType = typeof req.query.hazardType === "string" ? req.query.hazardType.trim() : undefined;
    if (hazardType) {
      if (HAZARD_TYPES.includes(hazardType as (typeof HAZARD_TYPES)[number])) {
        conditions.push(eq(evacuationScenariosTable.hazardType, hazardType as (typeof HAZARD_TYPES)[number]));
      } else {
        res.status(400).json({ error: "Unknown hazard type" });
        return;
      }
    }

    const rows = await db
      .select()
      .from(evacuationScenariosTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(evacuationScenariosTable.createdAt));

    res.json(rows.map(serializeScenario));
  },
);

/**
 * POST /evacuation/scenarios
 * Create scenario with candidate route evaluations.
 */
router.post(
  "/evacuation/scenarios",
  authenticate,
  requireRole("operator", "admin"),
  async (req, res): Promise<void> => {
    const parsed = CreateEvacuationScenarioBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [created] = await db
      .insert(evacuationScenariosTable)
      .values({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        hazardType: parsed.data.hazardType,
        regionName: parsed.data.regionName,
        parameters: parsed.data.parameters ?? {},
        candidateRoutes: parsed.data.candidateRoutes ?? [],
        recommendation: parsed.data.recommendation ?? null,
        status: parsed.data.status ?? "draft",
        createdBy: req.user!.userId,
      })
      .returning();

    await recordAudit(req, "evacuation_scenario.create", "evacuation_scenario", created!.id, {
      name: created!.name,
      regionName: created!.regionName,
      hazardType: created!.hazardType,
    });

    res.status(201).json(serializeScenario(created!));
  },
);

/**
 * GET /evacuation/scenarios/:id
 * Retrieve a single evacuation scenario evaluation.
 */
router.get(
  "/evacuation/scenarios/:id",
  authenticate,
  requireRole("operator", "admin"),
  async (req, res): Promise<void> => {
    const id = parseParamId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid scenario ID" });
      return;
    }

    const [scenario] = await db
      .select()
      .from(evacuationScenariosTable)
      .where(eq(evacuationScenariosTable.id, id))
      .limit(1);

    if (!scenario) {
      res.status(404).json({ error: "Evacuation scenario not found" });
      return;
    }

    res.json(serializeScenario(scenario));
  },
);

/**
 * DELETE /evacuation/scenarios/:id
 * Delete an evacuation scenario.
 */
router.delete(
  "/evacuation/scenarios/:id",
  authenticate,
  requireRole("operator", "admin"),
  async (req, res): Promise<void> => {
    const id = parseParamId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid scenario ID" });
      return;
    }

    const [scenario] = await db
      .select()
      .from(evacuationScenariosTable)
      .where(eq(evacuationScenariosTable.id, id))
      .limit(1);

    if (!scenario) {
      res.status(404).json({ error: "Evacuation scenario not found" });
      return;
    }

    await db.delete(evacuationScenariosTable).where(eq(evacuationScenariosTable.id, scenario.id));

    await recordAudit(req, "evacuation_scenario.delete", "evacuation_scenario", scenario.id, {
      name: scenario.name,
    });

    res.status(204).end();
  },
);

export default router;
