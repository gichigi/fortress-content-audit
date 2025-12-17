// Debug script to monitor Next.js build process
import fs from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logPath = '/Users/tahi/Local Documents/Coding/fortress-content-audit-main/.cursor/debug.log';
const nextDir = '/Users/tahi/Local Documents/Coding/fortress-content-audit-main/.next';

const log = (msg, data, hypothesisId) => {
  try {
    const entry = JSON.stringify({
      sessionId: 'debug-session',
      runId: 'build-debug',
      hypothesisId,
      location: 'debug-build.js',
      message: msg,
      data: data || {},
      timestamp: Date.now()
    }) + '\n';
    fs.appendFileSync(logPath, entry);
  } catch (e) {
    console.error('Log error:', e);
  }
};

const checkFile = (filePath, hypothesisId) => {
  try {
    const exists = fs.existsSync(filePath);
    const stats = exists ? fs.statSync(filePath) : null;
    log('File check', {
      path: filePath,
      exists,
      size: stats?.size,
      mode: stats?.mode?.toString(8),
      mtime: stats?.mtime?.toISOString()
    }, hypothesisId);
    return { exists, stats };
  } catch (e) {
    log('File check error', { path: filePath, error: e.message }, hypothesisId);
    return { exists: false, error: e.message };
  }
};

log('Build debug script started', { nextDir }, 'ALL');

// Check .next directory state before build
log('Pre-build: Checking .next directory', {}, 'B');
try {
  const nextExists = fs.existsSync(nextDir);
  log('Pre-build: .next exists', { exists: nextExists }, 'B');
  
  if (nextExists) {
    const serverDir = path.join(nextDir, 'server');
    const serverExists = fs.existsSync(serverDir);
    log('Pre-build: server directory exists', { exists: serverExists }, 'B');
    
    if (serverExists) {
      const notFoundPath = path.join(serverDir, 'app/_not-found/page.js');
      checkFile(notFoundPath, 'B');
    }
    
    // Check cache directory
    const cacheDir = path.join(nextDir, 'cache/webpack');
    if (fs.existsSync(cacheDir)) {
      const cacheFiles = fs.readdirSync(cacheDir, { recursive: true });
      log('Pre-build: Cache files', { count: cacheFiles.length, files: cacheFiles.slice(0, 10) }, 'A');
    }
  }
} catch (e) {
  log('Pre-build check error', { error: e.message }, 'B');
}

// Monitor build process
const build = spawn('pnpm', ['run', 'build'], {
  cwd: '/Users/tahi/Local Documents/Coding/fortress-content-audit-main',
  stdio: ['inherit', 'pipe', 'pipe']
});

let buildOutput = '';

build.stdout.on('data', (data) => {
  const output = data.toString();
  buildOutput += output;
  if (output.includes('error') || output.includes('Error') || output.includes('ENOENT')) {
    log('Build output: Error detected', { output: output.slice(0, 500) }, 'C');
  }
});

build.stderr.on('data', (data) => {
  const output = data.toString();
  buildOutput += output;
  log('Build stderr', { output: output.slice(0, 500) }, 'C');
});

build.on('close', (code) => {
  log('Build process exited', { code, outputLength: buildOutput.length }, 'C');
  
  // Check files after build
  setTimeout(() => {
    log('Post-build: Checking files', {}, 'B');
    const notFoundPath = path.join(nextDir, 'server/app/_not-found/page.js');
    const signUpPath = path.join(nextDir, 'server/app/sign-up/page.js');
    const docPath = path.join(nextDir, 'server/pages/_document.js');
    
    checkFile(notFoundPath, 'B');
    checkFile(signUpPath, 'B');
    checkFile(docPath, 'B');
    
    // Check cache state
    const cacheDir = path.join(nextDir, 'cache/webpack');
    if (fs.existsSync(cacheDir)) {
      try {
        const cacheFiles = fs.readdirSync(cacheDir, { recursive: true });
        const corrupted = cacheFiles.filter(f => f.endsWith('_') || f.includes('.old'));
        log('Post-build: Cache state', { totalFiles: cacheFiles.length, corrupted: corrupted.length, corruptedFiles: corrupted }, 'A');
      } catch (e) {
        log('Post-build: Cache read error', { error: e.message }, 'A');
      }
    }
    
    log('Build debug script completed', {}, 'ALL');
  }, 2000);
});

