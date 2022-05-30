// Imports
const express = require('express');
const cors = require('cors');
const httpProxy = require('http-proxy');
const app = express();
const { writeFile } = require("fs")
const { spawn } = require("child_process");

const events = require('events');
class CloseEmitter extends events.EventEmitter { };

let env = require("./.env.json");
const generateTcpClient = require("./utils/tcp-client-generator");

// Middleware for handling cors and json requests
app.use(cors());
app.use(express.json());

// Create "redirecting to" target
const terminalProxy = httpProxy.createProxyServer(
  {
    followRedirects: true,
    changeOrigin: true,
    autoRewrite: true,
  }
);

const IP_REGEX = /\b(?:(?:2(?:[0-4][0-9]|5[0-5])|[0-1]?[0-9]?[0-9])\.){3}(?:(?:2([0-4][0-9]|5[0-5])|[0-1]?[0-9]?[0-9]))\b/;
const isCorrectIp = (__ip) => IP_REGEX.test(__ip);
const persistToFile = (newEnv, successCallback, errorCallback) => {
  writeFile("./.env.json", JSON.stringify(newEnv), (err) => {
    if (err) {
      errorCallback();
    } else {
      successCallback();
    }
  })
};
const terminalRequestScheme = "http";
// TODO: Implement better error handling
terminalProxy.on("error", (err) => {
  console.log(err)
  console.log("Unknownn Error:\n ");
});
terminalProxy.on("econnreset", (err, req, res) => {
  console.log("Error connetion reset")
});


const closeEmitter = new CloseEmitter();
terminalProxy.on("proxyReq", (proxyReq, req, res) => {
  closeEmitter.on("close", () => {
    req.socket.destroy();
  })
});


// ======================================================================================
// ===================================== ROUTES =========================================
// ======================================================================================
app.get("/ping", (req, res) => {
  res.send("Pong");
});
// Return all ip address list
app.get("/ip", (req, res) => {
  if (env == null) {
    return res.status(404).send("No specfied information in list.");
  }
  res.status(200).json(env);
});

// Change POS IP to specified ip string
app.put("/change_pos_ip/:pos_id", (req, res) => {
  const { PRINT, IP } = req.body;
  const pos_id = Number(req.params.pos_id)
  const existingPosInJSON = env.LIST_POS.find(_pos => _pos.SALES_POS_ID === pos_id);
  if (existingPosInJSON != undefined) {
    existingPosInJSON.TERMINAL_IP = IP;
    existingPosInJSON.PRINT = PRINT;
  } else {
    env.LIST_POS.push({
      SALES_POS_ID: pos_id,
      TERMINAL_IP: IP,
      PRINT
    });
  }
  persistToFile(
    env,
    () => res.status(200).send("success"),
    (err) => {
      res.status(200).send("success");
      console.log(err)
    }
  )
});

// Select current ip for terminal proxy
app.get("/select_ip/:new_ip", (req, res) => {
  const newIp = req.params.new_ip;
  if (!isCorrectIp(newIp)) {
    return res.status(400).send("Wrong IP address !");
  }
  env.CURRENT_IP = newIp;
  persistToFile(
    env,
    () => res.status(200).send(),
    (error) => {
      console.log(error)
      res.status(500);
    }
  );
});

// Get ip address and print of sales pos
app.get("/ip/:pos_id", (req, res) => {
  const posId = Number.parseInt(req.params.pos_id, 10);
  if (Number.isNaN(posId)) {
    return res.status(400).send("Please send valid sales pos id.");
  }
  const foundPos = env.LIST_POS.find(_pos => _pos.SALES_POS_ID === posId);
  if (foundPos == undefined) {

    persistToFile(
      env,
      () => res.status(404).send("Can not find POS information."),
      (error) => {
        console.log(error)
        res.status(500);
      }
    );
  } else {
    res.status(200).json({
      ip: foundPos.TERMINAL_IP,
      print: foundPos.PRINT
    });
  }
});

const commandToRestartPm2 = "pm2";
// Get ip address and print of sales pos
const cbcb = (error, stdOut, stdError) => {
  if (error) {
    return res.sendStatus(500);
  } else {
    res.sendStatus(200);
  }
}
app.get("/restart_server", (req, res) => {
  spawn(commandToRestartPm2, {
    detached: true,
    argv0: "restart terminal-cc"
  });
});

// CHECK: Need testing, not sure it will work.
app.get("/cancel", (req, res) => {
  if (env.CURRENT_IP == null || !isCorrectIp(env.CURRENT_IP)) {
    res.status(400).send("Please select current terminal IP address.");
    return;
  }

  if (env.TERMINAL_PORT == null) {
    res.status(400).send("Terminal port is not specified in configuration.");
    return;
  }
  const tcpClient = generateTcpClient(env.CURRENT_IP, env.TERMINAL_PORT);
  const CancelBody = require("./terminal-requests.string").CancelOperationRequest;

  tcpClient.connect(remoteAddress, () => {
    tcpClient.write(CancelBody);
    tcpClient.end();
    res.status(200).send();
  });
});

// CHECK: Need testing, not sure it will work.
app.get("/cancel_all", (req, res) => {
  try {
    closeEmitter.emit("close");
    res.status(200).send();
  } catch (error) {
    console.log(error)
    res.status(500).send("Error detected");
  }
})









// ======================================================================================
// ===================================== PROXY ==========================================
// ======================================================================================
// Handle terminal proxy
app.all("/", (req, res) => {
  if (env.CURRENT_IP === null) {
    return res.status(400).send("Please select current terminal ip.");
  }
  try {
    terminalProxy.web(req, res, { target: `${terminalRequestScheme}://${env.CURRENT_IP}:${env.TERMINAL_PORT}` });
  } catch (e) {
    res.status(404).send("Unknown error");
  }
});
// Configure port
const serverPort = /* env.SERVER_PORT || */ 6565;
// Start server
app.listen(serverPort, () => console.log(`Server started at: ${serverPort}`));