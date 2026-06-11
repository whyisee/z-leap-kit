import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const aliases = new Map([
  ["@components/", "src/components/"],
  ["@layouts/", "src/layouts/"],
  ["@lib/", "src/lib/"],
  ["@server/", "src/server/"],
  ["@styles/", "src/styles/"],
]);

export async function resolve(specifier, context, nextResolve) {
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    const parentDirectory = path.dirname(fileURLToPath(context.parentURL));
    const resolvedPath = resolveExistingPath(path.resolve(parentDirectory, specifier));

    if (resolvedPath) {
      return {
        shortCircuit: true,
        url: pathToFileURL(resolvedPath).href,
      };
    }
  }

  for (const [prefix, targetRoot] of aliases) {
    if (!specifier.startsWith(prefix)) continue;

    const relativePath = specifier.slice(prefix.length);
    const basePath = path.resolve(process.cwd(), targetRoot, relativePath);
    const resolvedPath = resolveExistingPath(basePath);

    if (resolvedPath) {
      return {
        shortCircuit: true,
        url: pathToFileURL(resolvedPath).href,
      };
    }
  }

  return nextResolve(specifier, context);
}

function resolveExistingPath(basePath) {
  for (const suffix of ["", ".ts", ".tsx", ".js", ".mjs"]) {
    const candidate = `${basePath}${suffix}`;
    if (existsSync(candidate)) return candidate;
  }

  for (const indexFile of ["index.ts", "index.tsx", "index.js", "index.mjs"]) {
    const candidate = path.join(basePath, indexFile);
    if (existsSync(candidate)) return candidate;
  }

  return "";
}
