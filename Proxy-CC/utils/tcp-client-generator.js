const Net = require("net");

// Create TCP client:
generateTcpClient = () => {

  const client = new Net.Socket();
  client.on("error", (error) => {
    console.log("TCP client - error", error);
    client.end();
  });
  client.on("data", (dataAsChunk) => {
    console.log("TCP client - data", dataAsChunk.toString());
    client.end();
  });
  client.on("end", () => {
    console.log("TCP client - end");
  });

  return client;
};

module.exports = generateTcpClient;