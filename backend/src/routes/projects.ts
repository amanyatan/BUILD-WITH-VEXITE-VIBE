import { Router } from "express";
import { listProjects, getProject, createProject, updateProject, deleteProject } from "../controllers/projects";

const router = Router();

router.route("/").get(listProjects).post(createProject);
router.route("/:id").get(getProject).put(updateProject).delete(deleteProject);

export { router as projectRoutes };
