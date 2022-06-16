// Imports
const VERSION = "0.2.1";
const express = require('express');
const cors = require('cors');
let env = require("./.env.json");
const { persistToEnv, isCorrectIp } = require('./utils');
const TerminalRequestStack = require('./TerminalRequestStack');
const http = require("http");
const { userInfo } = require("os");
const { resolve } = require("path");
const { truncate } = require("fs")
// const { spawn } = require('child_process');

const app = express();
// Middleware for handling cors and json requests
app.use(cors());
app.use(express.json());
const requestStack = new TerminalRequestStack();

// ======================================================================================
// ===================================== ROUTES =========================================
// ======================================================================================
app.get("/ping", (req, res) => {
  res.send("Pong");
});

app.get("/version", (req, res) => {
  res.send(VERSION);
});
// Return all ip address list
app.get("/ip", (req, res) => {
  if (env == null) {
    return res.status(404).send("No specfied information in list.");
  }
  res.status(200).json(env);
});

// const _command = "pm2";
// app.get("/clear_log", (req, res) => {
//   const childProcess = spawn(_command, {
//     detached: true,
//     argv0: "flush terminal-cc-v2"
//   });

//   let statusCode = 200;

//   childProcess
//     .on("error",
//       (e) => {
//         console.error(e);
//         statusCode = 500;
//       }
//     )
//     .on("close",
//       () => {
//         return res.sendStatus(statusCode).send();
//       }
//     )
// });

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
  persistToEnv(
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
  persistToEnv(
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

    persistToEnv(
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


// ======================================================================================
// ===================================== PROXY ==========================================
// ======================================================================================
// Handle terminal proxy


const terminalRequestScheme = "http";
app.post("/", express.text({ type: "*/*" }), async (req, res) => {
  if (env.CURRENT_IP == null || env.TERMINAL_PORT == null) {
    return res.status(400).send("Terminal port or ip not specified.");
  }
  if (requestStack.stack.length !== 0) {
    return res.status(400).send("Terminal is busy.");
  }
  const target = `${terminalRequestScheme}://${env.CURRENT_IP}:${env.TERMINAL_PORT}`;
  let terminalResponseBody = "";
  const options = {
    method: "POST",
    // headers: { ...req.headers }
    headers: {
      "Content-Type": req.headers['content-type'],
      "Content-Length": req.headers['content-length']
    }
  };

  const clientRequest = http
    .request(target, options, (incomingMessage) => {
      incomingMessage.on("data", (dataAsChunk) => {
        terminalResponseBody += String(dataAsChunk);
        console.log("\n\n\nIncoming terminal request body:\n", terminalResponseBody);
      })
    })
    .on("close", () => {
      requestStack.pop();
      console.log("This final message returns terminal -> proxy to browser client: \n", terminalResponseBody)
      res.status(200).send(terminalResponseBody);
    })
    .on("error", (e) => {
      console.log("Error", e);
    });

  requestStack.push(clientRequest)
  console.log("\n\n\nSending terminal request body:", req.body);
  clientRequest.write(req.body);
  clientRequest.end();
});
// CurrMNTTime> 0 200 08.06.2022 12:37:35 200 08.06.2022 12:37:35 0 13.06.2022 23:07:39 04:54

// Test purpose wait request like terminal(simulating)

// app.all("/10", express.text({ type: "*/*" }), async (req, res) => {
//   res.send("")
// });

app.all("/cancel_all", (req, res) => {
  try {
    requestStack.cancelAll();
    res.status(200).send("Successfully closed all connections to terminal.")
  } catch (error) {
    console.log(error)
    res.status(500).send("Error occured");
  }
});

app.get("/clear_log", (req, res) => {
  const logName = "terminal-cc-v2-out.log";
  const logPath = resolve(userInfo().homedir, ".pm2", "logs", logName)
  truncate(logPath, (err) => {
    if (err) {
      return res.status(500).send();
    }
    const errorLogName = "terminal-cc-v2-error.log";
    const errorLogPath = resolve(userInfo().homedir, ".pm2", "logs", errorLogName)
    truncate(errorLogPath, (err) => {
      if (err) {
        return res.status(500).send();
      } else {
        return res.status(200).send();
      }
    })
  });
})

// Configure port
const serverPort = /* env.SERVER_PORT || */ 6565;
// Start server
app.listen(serverPort, () => console.log(`Server started at: ${serverPort}`));