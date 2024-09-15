const http = require("http");
const fs = require("fs");
const path = require("path");
const express = require("express");
const { render } = require('ejs');
const QRCode = require('qrcode');
const ffmpeg = require('fluent-ffmpeg');
const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));

let newId = 1702985948057;
let blob;
let send = false;
let latestVideo = "1702985948057.mp4";

const serverPort = 3140;
const WebSocket = require('ws');
const server = http.createServer(app, () => { console.log(`Omar listening on ${serverPort}`) });

let keepAliveId = null;

// WebSocket Server
const wss = new WebSocket.Server({ server });
const sockserver = wss;
server.listen(serverPort, () => console.log(`Server listening on ${serverPort}`));

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

const keepServerAlive = () => {
  keepAliveId = setInterval(() => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send('ping');
      }
    });
  }, 50000);
};

app.put("/minting", (req, res) => {
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
  const outputDir = path.join(__dirname, 'public/processed/');
  const outputFile = path.join(outputDir, `${newId}_output.mp4`);
  const optimizedFile = path.join(outputDir, `${newId}_optimized.mp4`);
  const footerFile = path.join(__dirname, 'footer.mp4');
  const uploadUrl = `https://qr.patternbased.com/video/${newId}`;

  // Generate QR Code
  QRCode.toDataURL(uploadUrl, { type: 'png' }, (err, png) => {
    if (err) {
      console.error('Error generating QR code:', err);
      return res.status(500).send('QR code generation failed');
    }
  
    blob = png;
    send = true;
    console.log('QR Code generated:', uploadUrl);
  
    // Send QR Code to all connected clients
    sockserver.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        let waiting = '<p id="openmsg">QR CODE<br/>SHOWS HERE</p>';
        client.send(waiting);
  
        setTimeout(() => {
          let message = `<p id="newID">Video ID: <span>${newId}</span></p><div><img src="${blob}" alt="QR code"></div>`;
          console.log('Sending QR code to client');
          client.send(message);
        }, 10000);
      } else {
        console.log('Client is not ready to receive QR code');
      }
    });
  });

  // Create Write stream
  const writeStream = fs.createWriteStream(uploadPath);
  writeStream.on("error", (err) => {
    console.log(err);
    return res.status(500).end("");
  });

  req.on("end", () => {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Append footer to video
    console.log(`Processing video: ${uploadPath}`);
    ffmpeg(uploadPath)
      .input(footerFile)
      .complexFilter(['[0:v:0][1:v:0]concat=n=2:v=1:a=0[outv]', '[0:a:0][1:a:0]concat=n=2:v=0:a=1[outa]'])
      .map('outv').map('outa')
      .output(outputFile)
      .on('start', () => {
        console.log('FFmpeg processing started...');
      })
      .on('progress', (progress) => {
        console.log(`Processing: ${progress.percent}% done`);
      })
      .on('end', () => {
        console.log('Footer appended, starting optimization...');
        
        // Now optimize the video for size and compatibility
        ffmpeg(outputFile)
          .outputOptions([
            '-vf scale=640:360',    // Resize to 640x360 for web compatibility
            '-c:v libx264',         // Use H.264 codec
            '-crf 28',              // Optimize for file size (28 is visually lossless)
            '-preset slow',         // Maximize compression efficiency
            '-c:a aac',             // Use AAC codec for audio
            '-b:a 128k'             // Set audio bitrate
          ])
          .output(optimizedFile)
          .on('start', () => {
            console.log('Optimization started...');
          })
          .on('end', () => {
            console.log('Optimization complete:', optimizedFile);
            res.status(200).send('Video uploaded, processed, and optimized');
          })
          .on('error', (err) => {
            console.error('Error during optimization:', err);
            res.status(500).send('Video optimization failed: ' + err.message);
          })
          .run();
      })
      .on('error', (err) => {
        console.error('Error during video processing:', err);
        res.status(500).send('Video processing failed: ' + err.message);
      })
      .run();
  });

  req.pipe(writeStream);
});

// app.put("/minting", (req, res) => {
//   const uploadFolder = `${__dirname}/public/uploads`;
//   if (!fs.existsSync(uploadFolder)) {
//     fs.mkdirSync(uploadFolder, { recursive: true });
//   }
  
//   const dateNow = Date.now();
//   newId = dateNow;
//   const fileName = `${newId}.mp4`;
//   const uploadFilename = fileName;
//   latestVideo = uploadFilename;
//   const uploadPath = path.join(uploadFolder, uploadFilename);
//   const outputDir = path.join(__dirname, 'public/processed/');
//   const outputFile = path.join(outputDir, `${newId}_output.mp4`);
//   const optimizedFile = path.join(outputDir, `${newId}_optimized.mp4`);
//   const footerFile = path.join(__dirname, 'footer.mp4');
//   const uploadUrl = `https://qr.patternbased.com/video/${newId}`;

//   // Generate QR Code
//   QRCode.toDataURL(uploadUrl, { type: 'png' }, (err, png) => {
//     if (err) {
//       console.error('Error generating QR code:', err);
//       return res.status(500).send('QR code generation failed');
//     }
  
//     blob = png;
//     send = true;
//     console.log('QR Code generated:', uploadUrl);
  
//     // Send QR Code to all connected clients
//     sockserver.clients.forEach(client => {
//       if (client.readyState === WebSocket.OPEN) {
//         let waiting = '<p id="openmsg">QR CODE<br/>SHOWS HERE</p>';
//         client.send(waiting);
  
//         setTimeout(() => {
//           let message = `<p id="newID">Video ID: <span>${newId}</span></p><div><img src="${blob}" alt="QR code"></div>`;
//           console.log('Sending QR code to client');
//           client.send(message);
//         }, 10000);
//       } else {
//         console.log('Client is not ready to receive QR code');
//       }
//     });
//   });

//   // Create Write stream
//   const writeStream = fs.createWriteStream(uploadPath);
//   writeStream.on("error", (err) => {
//     console.log(err);
//     return res.status(500).end("");
//   });

//   req.on("end", () => {
//     if (!fs.existsSync(outputDir)) {
//       fs.mkdirSync(outputDir, { recursive: true });
//     }

//     // Append footer to video
//     console.log(`Processing video: ${uploadPath}`);
//     ffmpeg(uploadPath)
//       .input(footerFile)
//       .complexFilter(['[0:v:0][1:v:0]concat=n=2:v=1:a=0[outv]', '[0:a:0][1:a:0]concat=n=2:v=0:a=1[outa]'])
//       .map('outv').map('outa')
//       .output(outputFile)
//       .on('start', () => {
//         console.log('FFmpeg processing started...');
//       })
//       .on('progress', (progress) => {
//         console.log(`Processing: ${progress.percent}% done`);
//       })
//       .on('end', () => {
//         console.log('Footer appended, starting optimization...');
        
//         // Now optimize the video for size and compatibility
//         ffmpeg(outputFile)
//           .outputOptions([
//             '-vf scale=640:360',    // Resize to 640x360 for web compatibility
//             '-c:v libx264',         // Use H.264 codec
//             '-crf 28',              // Optimize for file size (28 is visually lossless)
//             '-preset slow',         // Maximize compression efficiency
//             '-c:a aac',             // Use AAC codec for audio
//             '-b:a 128k'             // Set audio bitrate
//           ])
//           .output(optimizedFile)
//           .on('start', () => {
//             console.log('Optimization started...');
//           })
//           .on('end', () => {
//             console.log('Optimization complete:', optimizedFile);
//             res.status(200).send('Video uploaded, processed, and optimized');
//           })
//           .on('error', (err) => {
//             console.error('Error during optimization:', err);
//             res.status(500).send('Video optimization failed: ' + err.message);
//           })
//           .run();
//       })
//       .on('error', (err) => {
//         console.error('Error during video processing:', err);
//         res.status(500).send('Video processing failed: ' + err.message);
//       })
//       .run();
//   });

//   req.pipe(writeStream);
// });


app.get("/", (req, res) => { res.render('qrcode') });

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
