const puppeteer = require('puppeteer');
const { spawn } = require('child_process');

const YOUTUBE_STREAM_KEY = 'qk7z-m07r-1b0a-0w8v-1zkh';
const YOUTUBE_RTMP_URL = `rtmp://a.rtmp.youtube.com/live2/${YOUTUBE_STREAM_KEY}`;
const FPS = 15;
const WIDTH = 1280;
const HEIGHT = 720;

(async () => {
  try {
    // Launch browser
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT });

    // Open Santa Tracker
    console.log('Loading Santa Tracker...');
    await page.goto('https://santatracker.google.com', { waitUntil: 'networkidle2' });
    console.log('Santa Tracker loaded!');

    // Spawn FFmpeg process to stream to YouTube
    const ffmpegArgs = [
      '-f', 'image2pipe',
      '-vcodec', 'mjpeg',
      '-r', String(FPS),
      '-i', '-',
      '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-tune', 'zerolatency',
      '-pix_fmt', 'yuv420p',
      '-r', String(FPS),
      '-g', String(FPS * 2),
      '-b:v', '2500k',
      '-maxrate', '3000k',
      '-bufsize', '6000k',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-shortest',
      '-f', 'flv',
      YOUTUBE_RTMP_URL
    ];

    const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    ffmpeg.stderr.on('data', (data) => {
      console.log(`[FFmpeg] ${data.toString().trim()}`);
    });

    ffmpeg.on('error', (error) => {
      console.error('FFmpeg Error:', error);
    });

    ffmpeg.on('close', (code) => {
      console.log(`FFmpeg exited with code ${code}`);
    });

    // Capture and stream screenshots
    const frameInterval = 1000 / FPS;
    let frameCount = 0;

    console.log(`Starting stream at ${FPS} FPS...`);

    const captureLoop = setInterval(async () => {
      try {
        const screenshot = await page.screenshot({
          type: 'jpeg',
          quality: 80,
          fullPage: false
        });

        if (!ffmpeg.stdin.destroyed) {
          ffmpeg.stdin.write(screenshot);
          frameCount++;
          if (frameCount % 30 === 0) {
            console.log(`Streamed ${frameCount} frames...`);
          }
        } else {
          clearInterval(captureLoop);
          console.log('FFmpeg stdin closed, stopping capture');
        }
      } catch (error) {
        console.error('Screenshot error:', error.message);
        clearInterval(captureLoop);
        ffmpeg.stdin.end();
      }
    }, frameInterval);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\nShutting down...');
      clearInterval(captureLoop);
      ffmpeg.stdin.end();
      setTimeout(async () => {
        await browser.close();
        process.exit(0);
      }, 2000);
    });

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
