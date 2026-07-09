import { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand, GetQueryResultsCommand } from "@aws-sdk/client-athena";
import dotenv from "dotenv";
dotenv.config();

const client = new AthenaClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs an Athena SQL query and returns parsed rows as an array of objects.
 * Polls until the query finishes (Athena queries are async by nature).
 */
export async function runAthenaQuery(sql) {
  const startCommand = new StartQueryExecutionCommand({
    QueryString: sql,
    QueryExecutionContext: {
      Database: process.env.ATHENA_DATABASE,
    },
    ResultConfiguration: {
      OutputLocation: process.env.ATHENA_OUTPUT_LOCATION,
    },
  });

  const startResponse = await client.send(startCommand);
  const queryExecutionId = startResponse.QueryExecutionId;

  // Poll for completion
  let state = "RUNNING";
  while (state === "RUNNING" || state === "QUEUED") {
    await sleep(1000);
    const statusCommand = new GetQueryExecutionCommand({ QueryExecutionId: queryExecutionId });
    const statusResponse = await client.send(statusCommand);
    state = statusResponse.QueryExecution.Status.State;

    if (state === "FAILED" || state === "CANCELLED") {
      const reason = statusResponse.QueryExecution.Status.StateChangeReason;
      throw new Error(`Athena query ${state}: ${reason}`);
    }
  }

  // Fetch results
  const resultsCommand = new GetQueryResultsCommand({ QueryExecutionId: queryExecutionId });
  const resultsResponse = await client.send(resultsCommand);

  const rows = resultsResponse.ResultSet.Rows;
  const headers = rows[0].Data.map((col) => col.VarCharValue);

  const dataRows = rows.slice(1).map((row) => {
    const obj = {};
    row.Data.forEach((col, i) => {
      obj[headers[i]] = col.VarCharValue ?? null;
    });
    return obj;
  });

  return dataRows;
}