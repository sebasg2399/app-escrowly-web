import { buildApp } from "../app.js";
import { writeFileSync } from "node:fs";
import { stringify } from "yaml";

async function main() {
  const app = await buildApp();
  await app.ready();
  const swagger = app.swagger();
  writeFileSync("openapi.yaml", stringify(swagger), "utf-8");
  await app.close();
  console.log("openapi.yaml generated");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
