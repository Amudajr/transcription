const express = require("express");
const multer = require("multer");
const fs = require("fs");
const { exec } = require("child_process");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

const app = express();
const port = 5000;

const UPLOAD_DIR = path.join(__dirname, "uploads");
const DOWNLOAD_DIR = path.join(__dirname, "downloads");

// Create folders if not exist
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR);
}

// Middleware
app.use(express.json());

// Multer upload setup
const upload = multer({ dest: UPLOAD_DIR });

// Helper to safely quote shell args
function shellEscape(str) {
  return `"${str.replace(/(["$` + "`" + `\\])/g, '\\$1')}"`;
}

// Route 1: Upload video file and transcribe
app.post("/upload", upload.single("video"), (req, res) => {
  if (!req.file) return res.status(400).send("No video file uploaded.");

  const videoPath = req.file.path;
  const audioPath = path.join(UPLOAD_DIR, `${uuidv4()}.wav`);

  console.log(`Converting uploaded video ${videoPath} to audio ${audioPath}`);

  exec(
    `ffmpeg -i ${shellEscape(videoPath)} -vn -acodec pcm_s16le -ar 16000 -ac 1 ${shellEscape(audioPath)}`,
    (err, stdout, stderr) => {
      if (err) {
        console.error("FFmpeg conversion error:", err, stderr);
        cleanupFiles([videoPath]);
        return res.status(500).send("FFmpeg conversion error.");
      }

      console.log("Audio extracted successfully.");

      exec(
        `whisper ${shellEscape(audioPath)} --model base --language English --output_format txt`,
        (err2, stdout2, stderr2) => {
          if (err2) {
            console.error("Whisper transcription error:", err2, stderr2);
            cleanupFiles([videoPath, audioPath]);
            return res.status(500).send("Whisper transcription error.");
          }

          const transcriptPath = `${audioPath}.txt`;
          fs.readFile(transcriptPath, "utf8", (err3, data) => {
            if (err3) {
              console.error("Failed to read transcript file:", err3);
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

// Route 2: Download YouTube video, convert and transcribe
app.post("/youtube", (req, res) => {
  const url = req.body.url;
  if (!url) return res.status(400).send("No URL provided.");

  console.log(`Received YouTube URL to transcribe: ${url}`);

  const videoPath = path.join(DOWNLOAD_DIR, `${uuidv4()}.mp4`);
  const audioPath = videoPath.replace(".mp4", ".wav");

  const safeUrl = shellEscape(url);

  exec(
    `yt-dlp -o ${shellEscape(videoPath)} -f bestaudio ${safeUrl}`,
    (err, stdout, stderr) => {
      if (err) {
        console.error("YouTube download failed:", err, stderr);
        cleanupFiles([videoPath]);
        return res.status(500).send("YouTube download failed.");
      }

      console.log("YouTube video downloaded:", videoPath);

      exec(
        `ffmpeg -i ${shellEscape(videoPath)} -vn -acodec pcm_s16le -ar 16000 -ac 1 ${shellEscape(audioPath)}`,
        (err2, stdout2, stderr2) => {
          if (err2) {
            console.error("FFmpeg audio extraction failed:", err2, stderr2);
            cleanupFiles([videoPath, audioPath]);
            return res.status(500).send("FFmpeg failed.");
          }

          console.log("Audio extracted from YouTube video:", audioPath);

          exec(
            `whisper ${shellEscape(audioPath)} --model base --language English --output_format txt`,
            (err3, stdout3, stderr3) => {
              if (err3) {
                console.error("Whisper transcription failed:", err3, stderr3);
                cleanupFiles([videoPath, audioPath]);
                return res.status(500).send("Whisper transcription failed.");
              }

              const transcriptPath = `${audioPath}.txt`;
              fs.readFile(transcriptPath, "utf8", (err4, data) => {
                if (err4) {
                  console.error("Failed to read transcript:", err4);
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

// Helper to cleanup files asynchronously
function cleanupFiles(files) {
  files.forEach((file) => {
    fs.unlink(file, (err) => {
      if (err) console.error(`Failed to delete ${file}:`, err);
    });
  });
}

// Basic error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.stack);
  res.status(500).send("Something broke!");
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
