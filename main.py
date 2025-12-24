import subprocess
import time
from playwright.sync_api import sync_playwright

YOUTUBE_RTMP = "rtmp://a.rtmp.youtube.com/live2/8k6c-cm4e-s69w-sjts-cvt6"

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=False,
        args=["--window-size=854,480"]
    )

    page = browser.new_page(
        viewport={"width": 854, "height": 480}
    )

    page.goto("https://www.noradsanta.org")
    page.wait_for_timeout(10000)

    ffmpeg_cmd = [
        "ffmpeg",
        "-y",
        "-f", "x11grab",
        "-video_size", "854x480",
        "-framerate", "30",
        "-i", ":0.0",
        "-f", "lavfi",
        "-i", "anullsrc",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-pix_fmt", "yuv420p",
        "-g", "60",
        "-b:v", "1500k",
        "-maxrate", "1500k",
        "-bufsize", "3000k",
        "-c:a", "aac",
        "-b:a", "96k",
        "-f", "flv",
        YOUTUBE_RTMP
    ]

    subprocess.Popen(ffmpeg_cmd)
    print("🎅 Streaming Santa in 480p...")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        browser.close()
