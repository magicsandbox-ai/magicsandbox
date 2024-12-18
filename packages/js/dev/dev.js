import { buildAppLocal } from "../buildAppLocal.js";
import http from "http";

export function dev(path, port, debug) {
  const headers = {
    "Access-Control-Allow-Origin": "http://localhost:3000", //todo update url
    "Content-Type": "application/json",
  };

  const contextRef = { current: undefined };

  const server = http.createServer(async (_, res) => {
    try {
      const { appObj, context } = await buildAppLocal(
        path,
        debug,
        contextRef.current,
      );
      contextRef.current = context;
      res.writeHead(200, headers);
      res.end(JSON.stringify(appObj));
    } catch (error) {
      res.writeHead(500, headers);
      res.end(JSON.stringify({ error: error.message }));
    }
  });

  server.listen(port, () => {
    console.log(`magicsandbox dev server running at http://localhost:${port}`);
  });

  return server;
}
