const YTDlpWrap = require('yt-dlp-wrap').default || require('yt-dlp-wrap');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

async function downloadYtdlp() {
  // Check if system-wide yt-dlp is already present
  try {
    const checkCmd = process.platform === 'win32' ? 'where yt-dlp' : 'which yt-dlp';
    execSync(checkCmd, { stdio: 'ignore' });
    console.log('System-wide yt-dlp is available. Skipping pre-download.');
    return;
  } catch (e) {
    // Proceed to download local binary
  }

  const BIN_DIR = path.join(process.cwd(), 'bin');
  const BIN_NAME = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
  const BIN_PATH = path.join(BIN_DIR, BIN_NAME);

  if (fs.existsSync(BIN_PATH)) {
    console.log('Local yt-dlp binary already exists. Skipping pre-download.');
    return;
  }

  console.log('Downloading local yt-dlp binary to:', BIN_PATH);
  if (!fs.existsSync(BIN_DIR)) {
    fs.mkdirSync(BIN_DIR, { recursive: true });
  }

  try {
    await YTDlpWrap.downloadFromGithub(BIN_PATH);
    if (process.platform !== 'win32') {
      fs.chmodSync(BIN_PATH, '755');
    }
    console.log('yt-dlp binary pre-downloaded successfully!');
  } catch (err) {
    console.error('Failed to pre-download yt-dlp from GitHub:', err.message);
  }
}

downloadYtdlp();
