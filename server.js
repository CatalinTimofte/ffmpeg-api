const express = require("express");
const axios = require("axios");
const fs = require("fs");
const { exec } = require("child_process");
const { v4: uuidv4 } = require("uuid");
const app = express();
app.use(express.json());

app.post("/merge", async (req, res) => {
  const { video_url, audio_url } = req.body;
  if (!video_url || !audio_url) {
    return res.status(400).json({ error: "Missing video_url or audio_url" });
  }

  const id = uuidv4();
  const videoPath = `temp/${id}_video.webm`;
  const audioPath = `temp/${id}_audio.mp3`;
  const outputPath = `public/${id}_final.mp4`;

  try {
    const download = async (url, path) => {
      const response = await axios({ method: "GET", url, responseType: "stream" });
      const writer = fs.createWriteStream(path);
      response.data.pipe(writer);
      return new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });
    };

    await download(video_url, videoPath);
    await download(audio_url, audioPath);

    const ffmpegCmd = `ffmpeg -y -i ${videoPath} -i ${audioPath} -c:v libx264 -c:a aac -shortest ${outputPath}`;
    exec(ffmpegCmd, (error) => {
      if (error) {
        console.error("FFmpeg error:", error);
        return res.status(500).json({ error: "FFmpeg failed" });
      }

      const finalUrl = `${req.protocol}://${req.get("host")}/${id}_final.mp4`;
      res.json({ status: "success", url: finalUrl });

      // Cleanup după 1 oră
      setTimeout(() => {
        try {
          fs.unlinkSync(videoPath);
          fs.unlinkSync(audioPath);
          fs.unlinkSync(outputPath);
        } catch (e) {
          console.warn("Cleanup error:", e.message);
        }
      }, 3600000);
    });

  } catch (err) {
    console.error("Processing error:", err);
    res.status(500).json({ error: "Processing failed" });
  }
});

app.use(express.static("public"));
app.listen(process.env.PORT || 3000, () => console.log("✅ Server is running"));
