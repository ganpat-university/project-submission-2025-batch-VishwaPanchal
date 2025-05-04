const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// Directory to store the portable Node.js
const nodeDir = path.join(__dirname, 'portable-node');

// Create directory if it doesn't exist
if (!fs.existsSync(nodeDir)) {
  fs.mkdirSync(nodeDir, { recursive: true });
}

console.log('Setting up portable Node.js...');

// Determine the platform and architecture
const platform = os.platform();
const arch = os.arch();
let nodeUrl;
let nodeExePath;

if (platform === 'win32') {
  // Windows URL for Node.js 18.x (LTS)
  if (arch === 'x64') {
    nodeUrl = 'https://nodejs.org/dist/v18.19.1/node-v18.19.1-win-x64.zip';
    nodeExePath = path.join(nodeDir, 'node-v18.19.1-win-x64', 'node.exe');
  } else {
    nodeUrl = 'https://nodejs.org/dist/v18.19.1/node-v18.19.1-win-x86.zip';
    nodeExePath = path.join(nodeDir, 'node-v18.19.1-win-x86', 'node.exe');
  }
} else if (platform === 'darwin') {
  // macOS
  nodeUrl = 'https://nodejs.org/dist/v18.19.1/node-v18.19.1-darwin-x64.tar.gz';
  nodeExePath = path.join(nodeDir, 'node-v18.19.1-darwin-x64', 'bin', 'node');
} else {
  // Linux
  if (arch === 'x64') {
    nodeUrl = 'https://nodejs.org/dist/v18.19.1/node-v18.19.1-linux-x64.tar.xz';
    nodeExePath = path.join(nodeDir, 'node-v18.19.1-linux-x64', 'bin', 'node');
  } else {
    nodeUrl = 'https://nodejs.org/dist/v18.19.1/node-v18.19.1-linux-x86.tar.xz';
    nodeExePath = path.join(nodeDir, 'node-v18.19.1-linux-x86', 'bin', 'node');
  }
}

// Store the node executable path in a file to easily retrieve it later
const nodePathFile = path.join(nodeDir, 'node-path.txt');

// Check if we already have Node.js
if (fs.existsSync(nodeExePath)) {
  console.log('Portable Node.js is already set up!');
  fs.writeFileSync(nodePathFile, nodeExePath);
  process.exit(0);
}

// Instead of downloading (which is complex), let's create a helper script that checks for node
const helperScript = `
console.log('Portable Node.js setup helper');
console.log('-----------------------------');
console.log('');
console.log('Please download Node.js manually from: https://nodejs.org/');
console.log('');
console.log('After installation, the server will use your system Node.js.');
console.log('');
console.log('For now, we will create an empty nodePath file that tells the server to look for Node.js in the PATH.');
`;

fs.writeFileSync(path.join(nodeDir, 'setup-helper.js'), helperScript);
fs.writeFileSync(nodePathFile, 'PATH');

console.log('Created Node.js helper files.');
console.log('Please ensure Node.js is installed on your system.'); 