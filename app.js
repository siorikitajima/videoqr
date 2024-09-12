const http = require("http");
const fs = require("fs");
const path = require("path");
const express = require("express");
const { render } = require('ejs');
const QRCode = require('qrcode')
const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));

let newId = 1702985948057;
let blob;
let send = false;
let latestVideo = "1702985948057.mp4";

// const { WebSocketServer } = require('ws')
// const server = app.listen(3140, () => console.log(`Omar listening on 3140`));
// const sockserver = new WebSocketServer({ server: server })

const serverPort = 3140;
const WebSocket = require('ws');
const server = http.createServer(app, () => { console.log(`Omar listening on ${serverPort}`) });

let keepAliveId = null;

// Websocket Server
// sockserver.on('connection', ws => {

//  ws.on('close', () => console.log('Client has disconnected!'))

//  ws.on('message', data => {
//    sockserver.clients.forEach(client => {
//      console.log(`distributing message: ${data}`)
//      client.send(`${data}`)
//    })
//  })

//  ws.onerror = function () {
//    console.log('websocket error')
//  }
// })

const wss = new WebSocket.Server({ server });
const sockserver = wss; // Make sockserver globally accessible
server.listen(serverPort, () => console.log(`Server listening on ${serverPort}`));

// const intRoutes = require('./routes/intRoutes')(sockserver);

wss.on("connection", function (ws, req) {
  console.log("Connection Opened");
  console.log("Client size:", wss.clients.size);

  if (!keepAliveId) {
    keepServerAlive();
  }

  ws.on("message", (data) => {
    try {
      console.log("Received the data:", data);
    } catch (e) {
      console.log(e);
    }
  });

  ws.on("close", (data) => {
    console.log("Closing connection");
    if (wss.clients.size === 0) {
      console.log("Last client disconnected, stopping keepAlive interval");
      clearInterval(keepAliveId);
      keepAliveId = null;
    }
  });
});

// const broadcast = (ws, message, includeSelf) => {
//   wss.clients.forEach((client) => {
//     if (includeSelf || client !== ws) {
//       if (client.readyState === WebSocket.OPEN) {
//         client.send(message);
//       }
//     }
//   });
// };

const keepServerAlive = () => {
  keepAliveId = setInterval(() => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send('ping');
      }
    });
  }, 50000);
};


app.post("/minting", (req, res) => {
  //Create folder if it hasn't been created
  const uploadFolder = `${__dirname}/public/uploads`;
  if (!fs.existsSync(uploadFolder)) {
    fs.mkdirSync(uploadFolder, { recursive: true });
  }
  
  const dateNow = Date.now();
  newId = dateNow;
  const fileName = `${newId}.mp4`;
  const uploadFilename = fileName;
  latestVideo = uploadFilename;
  const uploadPath = path.join(uploadFolder, uploadFilename);
  const uploadUrl = `https://qr.patternbased.com/video/${newId}`;

  // Generate QR Code
  QRCode.toDataURL(uploadUrl, {type: 'png'}, (err, png) => {
    blob = png;
    send = true;
    console.log(uploadUrl);

      // Send Updated info to Client
      sockserver.clients.forEach(client => {
        let waiting = '<p id="openmsg">QR CODE<br/>SHOWS HERE</p>';
        client.send(waiting)
        setTimeout(() => {
          let message = `<p id="newID">Video ID: <span>${newId}</span></p><div><img src="${blob}" alt="QR code"></div>`;
          client.send(message);
        }, 10000);
      })

  })

  // Create Write stream
  const writeStream = fs.createWriteStream(uploadPath);
  writeStream.on("error", (err) => {
    console.log(err); // For now, simply console log it.
    return res.status(500).end("");
  });

  // Handle end event
  req.on("end", () => {
    return res.status(200).end(uploadPath);
  });

  // Start pipe
  req.pipe(writeStream);
});

app.get("/", (req, res) => { res.render('qrcode')});

app.get("/video/:videoid", (req, res) => {
  const videoid = req.params.videoid;
  const theVideo = `${__dirname}/public/uploads/${videoid}.mp4`;
  const video = fs.existsSync(theVideo) ? fs.readFileSync(theVideo) : null;

  if (!fs.existsSync(theVideo)) {
    console.log("Video not found");
  } else {
    console.log("Video found");
  }
  res.render('video', { video: video, videoid: videoid });
});