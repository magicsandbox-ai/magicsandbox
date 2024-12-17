import { buildAppLocal } from '../buildAppLocal.js';
import http from 'http';

const folder = `src/magics/apps/${process.argv[2]}`;

const headers = {
  'Access-Control-Allow-Origin': 'http://localhost:3000', //todo update url
  'Content-Type': 'application/json',
};

const contextRef = { current: undefined };

const server = http.createServer(async (_, res) => {
  try {
    const { appObj, context } = await buildAppLocal(
      folder,
      false,
      contextRef.current
    );
    contextRef.current = context;
    res.writeHead(200, headers);
    res.end(JSON.stringify(appObj));
  } catch (error) {
    res.writeHead(500, headers);
    res.end(JSON.stringify({ error: error.message }));
  }
});

const PORT = 3002;
server.listen(PORT, () => {
  console.log(`DevelopLocal server running at http://localhost:${PORT}`);
});
