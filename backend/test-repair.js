import { repairTablePartitions, runAthenaQuery } from "./athenaClient.js";

async function test() {
  console.log("Before repair:");
  const before = await runAthenaQuery(`SELECT COUNT(*) as cnt FROM ${process.env.ATHENA_TABLE};`);
  console.log(before);

  console.log("Running repair...");
  await repairTablePartitions();
  console.log("Repair done.");

  console.log("After repair:");
  const after = await runAthenaQuery(`SELECT COUNT(*) as cnt FROM ${process.env.ATHENA_TABLE};`);
  console.log(after);
}

test();