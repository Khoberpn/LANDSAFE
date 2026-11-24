// Orval (mode: split) writes the generated package to `generated/api/api.ts`.
// Point the barrel at that file so newly generated schemas are actually used.
export * from "./generated/api/api";
