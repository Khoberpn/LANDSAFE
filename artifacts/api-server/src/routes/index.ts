import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import locationsRouter from "./locations";
import sensorsRouter from "./sensors";
import measurementsRouter from "./measurements";
import alertsRouter from "./alerts";
import devicesRouter from "./devices";
import aiRouter from "./ai";
import reportsRouter from "./reports";
import usersRouter from "./users";
import auditRouter from "./audit";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(dashboardRouter);
router.use(locationsRouter);
router.use(sensorsRouter);
router.use(measurementsRouter);
router.use(alertsRouter);
router.use(devicesRouter);
router.use(aiRouter);
router.use(reportsRouter);
router.use(usersRouter);
router.use(auditRouter);

export default router;
