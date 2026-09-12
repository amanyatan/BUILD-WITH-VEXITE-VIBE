import app from "./app";
import { config, validateConfig } from "./config";
import { setupWebSocket } from "./websocket/ws.server";

validateConfig();

const server = app.listen(config.port, () => {
  console.log(`Vibe backend running on port ${config.port} in ${config.nodeEnv} mode`);
});

setupWebSocket(server);

export default server;
