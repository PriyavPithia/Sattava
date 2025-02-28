// pages/api/convert.js
import fs from 'fs';
import path from 'path';
import { IncomingForm } from 'formidable';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { promisify } from 'util';

ffmpeg.setFfmpegPath(ffmpegStatic);

export const config = {
  api: {
    bodyParser: false, // Disable default body parser to handle multipart/form-dat
  },
};

const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const form = new IncomingForm();
    form.uploadDir = './tmp';
    form.keepExtensions = true;
    
    // Ensure temporary directory exists
    if (!fs.existsSync(form.uploadDir)) {
      fs.mkdirSync(form.uploadDir);
    }

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error parsing the file upload.' });
      }
      
      // Expecting the file field name to be 'video'
      const videoFile = files.video;
      if (!videoFile) {
        return res.status(400).json({ error: 'No video file uploaded.' });
      }
      
      const inputPath = videoFile.filepath || videoFile.path; // Depending on formidable version
      const outputFilename = `${Date.now()}.mp3`;
      const outputPath = path.join(form.uploadDir, outputFilename);

      // Convert the video to MP3 using FFmpeg
      ffmpeg(inputPath)
        .noVideo()
        .audioCodec('libmp3lame')
        .format('mp3')
        .on('error', async (err) => {
          console.error('FFmpeg error:', err);
          await unlink(inputPath);
          return res.status(500).json({ error: 'Error during conversion.' });
        })
        .on('end', async () => {
          try {
            const audioData = await readFile(outputPath);
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('Content-Disposition', `attachment; filename=${outputFilename}`);
            res.status(200).send(audioData);
          } catch (readErr) {
            console.error('Read error:', readErr);
            res.status(500).json({ error: 'Error reading the converted file.' });
          } finally {
            // Clean up the temporary files
            fs.unlink(inputPath, () => {});
            fs.unlink(outputPath, () => {});
          }
        })
        .save(outputPath);
    });
  } else {
    res.status(405).json({ error: 'Method not allowed.' });
  }
}
