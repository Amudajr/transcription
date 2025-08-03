const express = require("express");
const multer = require("multer");
const fs = require("fs");
const { exec } = require("child_process");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 5000;

const UPLOAD_DIR = path.join(__dirname, "uploads");
const DOWNLOAD_DIR = path.join(__dirname, "downloads");

// Create necessary directories
[UPLOAD_DIR, DOWNLOAD_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
});

// Middleware
app.use(express.json());
app.use(cors());

// Multer config
const upload = multer({ dest: UPLOAD_DIR });

// Safe shell escape
function shellEscape(str) {
  return `"${str.replace(/(["$` + "`" + `\\])/g, "\\$1")}"`;
}

// File cleanup
function cleanupFiles(files) {
  files.forEach((file) => {
    fs.unlink(file, (err) => {
      if (err) console.error(`Failed to delete ${file}:`, err);
    });
  });
}

// Route: Upload file and transcribe
app.post("/upload", upload.single("video"), (req, res) => {
  if (!req.file) return res.status(400).send("No video file uploaded.");

  const videoPath = req.file.path;
  const audioPath = path.join(UPLOAD_DIR, `${uuidv4()}.wav`);

  exec(
    `ffmpeg -i ${shellEscape(videoPath)} -vn -acodec pcm_s16le -ar 16000 -ac 1 ${shellEscape(audioPath)}`,
    (err) => {
      if (err) {
        console.error("FFmpeg error:", err);
        cleanupFiles([videoPath]);
        return res.status(500).send("Audio conversion failed.");
      }

      exec(
        `whisper ${shellEscape(audioPath)} --model base --language English --output_format txt`,
        (err2) => {
          if (err2) {
            console.error("Whisper error:", err2);
            cleanupFiles([videoPath, audioPath]);
            return res.status(500).send("Transcription failed.");
          }

          const transcriptPath = `${audioPath}.txt`;

          fs.readFile(transcriptPath, "utf8", (err3, data) => {
            if (err3) {
              console.error("Transcript read error:", err3);
              cleanupFiles([videoPath, audioPath, transcriptPath]);
              return res.status(500).send("Failed to read transcript.");
            }

            res.json({ transcript: data });
            cleanupFiles([videoPath, audioPath, transcriptPath]);
          });
        }
      );
    }
  );
});

// Route: YouTube video transcription
app.post("/youtube", (req, res) => {
  const url = req.body.url;
  if (!url) return res.status(400).send("No URL provided.");

  const videoId = uuidv4();
  const videoPath = path.join(DOWNLOAD_DIR, `${videoId}.mp4`);
  const audioPath = path.join(DOWNLOAD_DIR, `${videoId}.wav`);

  exec(
    `yt-dlp -o ${shellEscape(videoPath)} -f bestaudio ${shellEscape(url)}`,
    (err) => {
      if (err) {
        console.error("yt-dlp error:", err);
        cleanupFiles([videoPath]);
        return res.status(500).send("YouTube download failed.");
      }

      exec(
        `ffmpeg -i ${shellEscape(videoPath)} -vn -acodec pcm_s16le -ar 16000 -ac 1 ${shellEscape(audioPath)}`,
        (err2) => {
          if (err2) {
            console.error("FFmpeg error:", err2);
            cleanupFiles([videoPath, audioPath]);
            return res.status(500).send("Audio extraction failed.");
          }

          exec(
            `whisper ${shellEscape(audioPath)} --model base --language English --output_format txt`,
            (err3) => {
              if (err3) {
                console.error("Whisper error:", err3);
                cleanupFiles([videoPath, audioPath]);
                return res.status(500).send("Transcription failed.");
              }

              const transcriptPath = `${audioPath}.txt`;

              fs.readFile(transcriptPath, "utf8", (err4, data) => {
                if (err4) {
                  console.error("Transcript read error:", err4);
                  cleanupFiles([videoPath, audioPath, transcriptPath]);
                  return res.status(500).send("Failed to read transcript.");
                }

                res.json({ transcript: data });
                cleanupFiles([videoPath, audioPath, transcriptPath]);
              });
            }
          );
        }
      );
    }
  );
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.stack);
  res.status(500).send("Internal server error.");
});

// Start server
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
