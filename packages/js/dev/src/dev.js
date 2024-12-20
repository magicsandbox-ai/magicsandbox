import { buildAppLocal } from "./buildAppLocal.js";
import http from "http";

export function dev(magicPath, port, debug) {
  try {
    const headers = {
      "Access-Control-Allow-Origin": "http://localhost:3000", //todo update url
      "Content-Type": "application/json",
    };

    const contextRef = { current: {} };

    const server = http.createServer(async (_, res) => {
      try {
        const { appObj } = await buildAppLocal({
          magicPath,
          debug,
          contextRef,
          prod: false,
        });
        res.writeHead(200, headers);
        res.end(JSON.stringify(appObj));
      } catch (error) {
        console.error(error);
        res.writeHead(500, headers);
        res.end(JSON.stringify({ error: error.message }));
      }
    });

    server.listen(port, () => {
      console.log(
        `Magic Sandbox dev server running at http://localhost:${port}`,
      );
      console.log("Open https://magicsandbox.ai?app=magicsandbox.DevLocal");
    });

    return server;
  } catch (error) {
    console.error("Failed to start dev server:", error.message);
    process.exit(1);
  }
}
