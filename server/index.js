const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const cors = require("cors")
const { v4: uuidv4 } = require("uuid")
const { exec, execSync } = require("child_process")
const fsPromises = require("fs").promises
const fs = require("fs")
const path = require("path")
const os = require("os")

const app = express()
app.use(cors())

const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
})

// Store rooms and their users
const rooms = new Map()

// Store file contents for each room
const fileContents = new Map()

// Temporary directory for code execution
const tempDir = path.join(os.tmpdir(), "codecollab")

// Create temp directory if it doesn't exist
async function ensureTempDir() {
  try {
    await fsPromises.mkdir(tempDir, { recursive: true })
    console.log(`Temporary directory created at ${tempDir}`)
  } catch (err) {
    console.error("Error creating temp directory:", err)
  }
}

ensureTempDir()

// Update the socket connection handler to use Firebase UIDs
io.on("connection", (socket) => {
  const { roomId, username, userId } = socket.handshake.query
  const socketId = socket.id

  console.log(`User ${username} (${userId}) connected to room ${roomId}`)

  // Join the room
  socket.join(roomId)

  // Initialize room if it doesn't exist
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map())
  }

  // Add user to room with Firebase UID if available
  rooms.get(roomId).set(socketId, {
    username,
    userId: userId || socketId, // Use Firebase UID if available, otherwise socket ID
  })

  // Send current file contents to the new user if available
  if (fileContents.has(roomId)) {
    const roomFiles = fileContents.get(roomId);
    roomFiles.forEach((value, fileId) => {
      socket.emit("file-change", { fileId, value });
    });
  }

  // Broadcast updated user list to all clients in the room
  io.to(roomId).emit(
    "room-users",
    Array.from(rooms.get(roomId).entries()).map(([id, user]) => ({
      id,
      username: user.username,
    })),
  )

  // Handle file changes
  socket.on("file-change", ({ roomId, fileId, value }) => {
    // Store the value temporarily for new users who join later
    if (!fileContents) {
      fileContents = new Map();
    }
    
    // Keep track of the latest content for each file
    if (!fileContents.has(roomId)) {
      fileContents.set(roomId, new Map());
    }
    
    // Only update if there's actual value (some operations might not have content)
    if (value !== null && value !== undefined) {
      fileContents.get(roomId).set(fileId, value);
    }

    // Broadcast to all other clients in the room
    socket.to(roomId).emit("file-change", { fileId, value })
  })

  // Handle new file creation
  socket.on("new-file", ({ roomId, file }) => {
    // Store the file content for new users
    if (!fileContents) {
      fileContents = new Map();
    }
    
    if (!fileContents.has(roomId)) {
      fileContents.set(roomId, new Map());
    }
    
    fileContents.get(roomId).set(file.id, file.value);
    
    socket.to(roomId).emit("new-file", file)
  })

  // Handle folder creation
  socket.on("new-folder", ({ roomId, folder }) => {
    if (!fileContents.has(roomId)) {
      fileContents.set(roomId, new Map());
    }
  
    fileContents.get(roomId).set(folder.id, folder);
    socket.to(roomId).emit("new-folder", folder);
  });

  // Handle file deletion
  socket.on("delete-file", ({ roomId, fileId }) => {
    socket.to(roomId).emit("delete-file", fileId)
  })

  // Handle file renaming
  socket.on("rename-file", ({ roomId, fileId, newName }) => {
    socket.to(roomId).emit("rename-file", { fileId, newName })
  })

  // Handle code execution
  socket.on("run-code", async ({ roomId, activeFileId, files }) => {
    try {
      // Create a temporary directory for this execution
      const execDir = path.join(tempDir, `${roomId}-${Date.now()}`)
      await fsPromises.mkdir(execDir, { recursive: true })

      // Write files to disk
      for (const file of files) {
        await fsPromises.writeFile(path.join(execDir, file.name), file.content)
      }

      let command = "";
      let env = {...process.env};  // Create a copy of the environment variables
      
      // Add common Python installation paths to PATH if on Windows
      if (process.platform === 'win32') {
        const additionalPaths = [
          'C:\\Python311',
          'C:\\Python310',
          'C:\\Python39',
          'C:\\Python38',
          'C:\\Program Files\\Python311',
          'C:\\Program Files\\Python310',
          'C:\\Program Files\\Python39',
          'C:\\Program Files\\Python38',
          'C:\\Users\\' + os.userInfo().username + '\\AppData\\Local\\Programs\\Python\\Python311',
          'C:\\Users\\' + os.userInfo().username + '\\AppData\\Local\\Programs\\Python\\Python310',
          'C:\\Users\\' + os.userInfo().username + '\\AppData\\Local\\Microsoft\\WindowsApps',
          // Add MinGW paths for C/C++ support
          'C:\\MinGW\\bin',
          'C:\\msys64\\mingw64\\bin',
          'C:\\msys64\\mingw32\\bin',
          'C:\\msys64\\ucrt64\\bin',
          'C:\\TDM-GCC\\bin',
          'C:\\Program Files\\mingw-w64\\x86_64-8.1.0-posix-seh-rt_v6-rev0\\mingw64\\bin',
          'C:\\Program Files (x86)\\mingw-w64\\i686-8.1.0-posix-dwarf-rt_v6-rev0\\mingw32\\bin'
        ];
        
        // Check if paths exist before adding
        const existingPath = env.PATH || '';
        const additionalPathsString = additionalPaths.join(path.delimiter);
        env.PATH = existingPath + path.delimiter + additionalPathsString;
        console.log('Enhanced PATH for execution:', env.PATH);
      }

      // Check for installed compilers/interpreters
      const checkCommand = process.platform === 'win32' ? 'where' : 'which';
      
      // Find the active file
      const activeFile = files.find(f => f.isActive);
      
      // Detect file types
      const isPython = activeFile && activeFile.name.endsWith('.py');
      const isJs = activeFile && activeFile.name.endsWith('.js');
      const isHtml = activeFile && activeFile.name.endsWith('.html');
      const isCpp = activeFile && (activeFile.name.endsWith('.cpp') || activeFile.name.endsWith('.cc'));
      const isC = activeFile && activeFile.name.endsWith('.c');
      
      // If we have an active file, prioritize it based on its type
      if (activeFile) {
        if (isPython) {
          try {
            // Adjust Python command priority based on platform
            let pythonCommand = '';
            const possiblePythonCommands = process.platform === 'win32' 
              ? ['python', 'py', 'python3'] // Windows prioritizes 'python'
              : ['python3', 'python', 'py']; // Unix prioritizes 'python3'
            
            let pythonFound = false;
            
            for (const cmd of possiblePythonCommands) {
              try {
                console.log(`Trying to find ${cmd}...`);
                execSync(`${checkCommand} ${cmd}`);
                pythonCommand = cmd;
                pythonFound = true;
                console.log(`Found Python at: ${cmd}`);
                break;
              } catch (err) {
                console.log(`${cmd} not found, trying next...`);
              }
            }
            
            if (!pythonFound) {
              io.to(roomId).emit("terminal-output", {
                type: "error",
                text: "Python was not found. Please install Python from https://www.python.org/downloads/ and make sure to check 'Add Python to PATH' during installation.",
              });
              return;
            }
            
            // Create or use a virtual environment
            const venvPath = path.join(tempDir, 'pyenv');
            let venvPythonPath;
            
            try {
              // Check if we've already created the virtual environment
              if (!fs.existsSync(venvPath)) {
                io.to(roomId).emit("terminal-output", {
                  type: "info",
                  text: "Creating Python virtual environment (this may take a moment)..."
                });
                
                // Create virtual environment
                console.log(`Creating virtual environment at ${venvPath}`);
                fs.mkdirSync(venvPath, { recursive: true });
                execSync(`${pythonCommand} -m venv "${venvPath}"`, { 
                  stdio: 'inherit',
                  timeout: 30000
                });
              }
              
              // Set path to Python executable in virtual environment
              if (process.platform === 'win32') {
                venvPythonPath = path.join(venvPath, 'Scripts', 'python.exe');
              } else {
                venvPythonPath = path.join(venvPath, 'bin', 'python');
              }
              
              // Verify venv Python exists
              if (fs.existsSync(venvPythonPath)) {
                pythonCommand = `"${venvPythonPath}"`;
                console.log(`Using virtual environment Python at: ${venvPythonPath}`);
                
                io.to(roomId).emit("terminal-output", {
                  type: "info",
                  text: "Using Python virtual environment"
                });
              } else {
                console.log(`Virtual environment Python not found at ${venvPythonPath}, using system Python`);
              }
            } catch (venvError) {
              console.error("Error creating virtual environment:", venvError);
              io.to(roomId).emit("terminal-output", {
                type: "warning",
                text: "Could not create virtual environment, using system Python instead."
              });
            }
            
            // Install required Python packages if requirements.txt exists
            const requirementsFile = files.find((f) => f.name === "requirements.txt");
            if (requirementsFile) {
              io.to(roomId).emit("terminal-output", {
                type: "command",
                text: "Installing Python dependencies..."
              });
              
              try {
                execSync(`${pythonCommand} -m pip install -r "${path.join(execDir, "requirements.txt")}"`, {
                  cwd: execDir,
                  timeout: 30000 // 30 second timeout for package installation
                });
                
                io.to(roomId).emit("terminal-output", {
                  type: "success",
                  text: "Dependencies installed successfully."
                });
              } catch (pipError) {
                io.to(roomId).emit("terminal-output", {
                  type: "error",
                  text: `Error installing dependencies: ${pipError.message}`
                });
                // Continue with execution anyway
              }
            }
            
            command = `${pythonCommand} "${path.join(execDir, activeFile.name)}"`;
          } catch (error) {
            io.to(roomId).emit("terminal-output", {
              type: "error",
              text: "Python is not installed or not in PATH. Please install Python from https://www.python.org/ and make sure it's added to your PATH.",
            });
            return;
          }
        } else if (isJs) {
          try {
            // Use the current node process executable path
            let nodeCommand = process.execPath;
            console.log(`Using current Node.js executable: ${nodeCommand}`);
            
            // Make sure path is quoted to handle spaces
            nodeCommand = `"${nodeCommand}"`;
            
            io.to(roomId).emit("terminal-output", {
              type: "info",
              text: `Using Node.js: ${nodeCommand}`
            });
            
            // Handle package.json dependencies
            const packageJsonFile = files.find((f) => f.name === "package.json");
            if (packageJsonFile) {
              io.to(roomId).emit("terminal-output", {
                type: "command",
                text: "Found package.json. Installing dependencies..."
              });
              
              try {
                await fsPromises.mkdir(path.join(execDir, "node_modules"), { recursive: true });
                execSync(`${nodeCommand} -e "console.log('Node.js is working')"`, { 
                  cwd: execDir,
                  timeout: 5000
                });
                
                // If node is working, run npm install
                try {
                  // Get npm path relative to node path
                  const npmPath = path.join(path.dirname(process.execPath), 'npm');
                  const npmCommand = process.platform === 'win32' 
                    ? `"${npmPath}.cmd"` 
                    : `"${npmPath}"`;
                    
                  execSync(`${npmCommand} install`, {
                    cwd: execDir,
                    timeout: 30000,
                    stdio: 'pipe'
                  });
                  
                  io.to(roomId).emit("terminal-output", {
                    type: "success",
                    text: "Dependencies installed successfully."
                  });
                } catch (npmError) {
                  io.to(roomId).emit("terminal-output", {
                    type: "warning",
                    text: `Error installing dependencies: ${npmError.message}. Will attempt to run without them.`
                  });
                }
              } catch (err) {
                io.to(roomId).emit("terminal-output", {
                  type: "warning",
                  text: `Error testing Node.js: ${err.message}`
                });
              }
            }
            
            // Run the JavaScript file
            command = `${nodeCommand} "${path.join(execDir, activeFile.name)}"`;
          } catch (error) {
            io.to(roomId).emit("terminal-output", {
              type: "error",
              text: `Error setting up Node.js: ${error.message}`
            });
            return;
          }
        } else if (isHtml) {
          io.to(roomId).emit("terminal-output", {
            type: "info",
            text: "HTML/CSS/JS detected. Use the Preview button to view the result.",
          });
          return;
        } else if (isCpp || isC) {
          try {
            // Check for available compilers
            const checkForCompiler = (cmd) => {
              try {
                execSync(`${checkCommand} ${cmd}`);
                return true;
              } catch (e) {
                return false;
              }
            };
            
            // Try to find the appropriate compiler
            let compiler = null;
            
            if (isCpp) {
              // Check for different C++ compilers in order of preference
              if (checkForCompiler('g++')) {
                compiler = 'g++';
              } else if (checkForCompiler('clang++')) {
                compiler = 'clang++';
              } else if (process.platform === 'win32' && checkForCompiler('cl')) {
                // Microsoft Visual C++ compiler
                compiler = 'cl';
              }
            } else { // C file
              // Check for different C compilers in order of preference
              if (checkForCompiler('gcc')) {
                compiler = 'gcc';
              } else if (checkForCompiler('clang')) {
                compiler = 'clang';
              } else if (process.platform === 'win32' && checkForCompiler('cl')) {
                // Microsoft Visual C++ compiler can compile C too
                compiler = 'cl';
              }
            }
            
            if (!compiler) {
              // No suitable compiler found
              io.to(roomId).emit("terminal-output", {
                type: "error",
                text: `No ${isCpp ? 'C++' : 'C'} compiler found. Please install GCC/G++ or Clang. On Windows, install MinGW from https://mingw-w64.org/ or MSYS2 from https://www.msys2.org/. On Linux, run 'sudo apt-get install build-essential'.`,
              });
              return;
            }
            
            const outputFile = path.join(execDir, process.platform === 'win32' ? 'output.exe' : 'output');
            let compileCommand = '';
            
            // Configure compile command based on compiler
            if (compiler === 'cl') {
              // Microsoft Visual C++ compiler has different syntax
              compileCommand = `${compiler} /Fe:"${outputFile}" "${path.join(execDir, activeFile.name)}"`;
            } else {
              // GCC/Clang style compilers
              const extraFlags = isCpp ? '-std=c++17' : '-std=c11';
              
              // Check for multiple source files
              const sourceExtensions = isCpp ? ['.cpp', '.cc', '.cxx'] : ['.c'];
              const headerExtensions = ['.h', '.hpp', '.hxx'];
              
              // Find all source files of the same type
              const sourceFiles = files
                .filter(f => sourceExtensions.some(ext => f.name.endsWith(ext)))
                .map(f => `"${path.join(execDir, f.name)}"`);
              
              // Check if there are header files
              const hasHeaders = files.some(f => headerExtensions.some(ext => f.name.endsWith(ext)));
              
              // If we have multiple source files, compile them all
              if (sourceFiles.length > 1) {
                io.to(roomId).emit("terminal-output", {
                  type: "info",
                  text: `Found ${sourceFiles.length} source files. Compiling all...`
                });
                
                compileCommand = `${compiler} ${sourceFiles.join(' ')} ${extraFlags} -o "${outputFile}"`;
              } else {
                compileCommand = `${compiler} "${path.join(execDir, activeFile.name)}" ${extraFlags} -o "${outputFile}"`;
              }
              
              // Add debugging info in development mode
              if (process.env.NODE_ENV !== 'production') {
                compileCommand += ' -g';
              }
              
              // Check for common libraries that might need to be linked
              const mathLibraryPatterns = [/math\.h/, /cmath/, /\bsin\b/, /\bcos\b/, /\btan\b/, /\bsqrt\b/, /\bpow\b/];
              const threadingPatterns = [/pthread\.h/, /thread/, /\bmutex\b/, /\bthread_create\b/];
              const socketPatterns = [/socket\.h/, /\bsocket\b/, /\bbind\b/, /\blisten\b/, /\baccept\b/];
              
              // Check file contents for library usage
              const needsMathLib = files.some(file => 
                (file.content && mathLibraryPatterns.some(pattern => pattern.test(file.content)))
              );
              
              const needsThreadingLib = files.some(file => 
                (file.content && threadingPatterns.some(pattern => pattern.test(file.content)))
              );
              
              const needsSocketLib = files.some(file => 
                (file.content && socketPatterns.some(pattern => pattern.test(file.content)))
              );
              
              // Add necessary libraries
              if (needsMathLib && compiler !== 'cl') {
                compileCommand += ' -lm';
              }
              
              if (needsThreadingLib && compiler !== 'cl') {
                compileCommand += ' -pthread';
              }
              
              if (needsSocketLib && process.platform !== 'win32' && compiler !== 'cl') {
                // On Unix systems, might need to link socket libraries
                compileCommand += ' -lsocket -lnsl';
              }
            }

            // Compile with better error handling
            io.to(roomId).emit("terminal-output", { 
              type: "command", 
              text: `Compiling ${activeFile.name} with ${compiler}...` 
            });

            try {
              await new Promise((resolve, reject) => {
                console.log(`Compile command: ${compileCommand}`);
                
                exec(compileCommand, { cwd: execDir, timeout: 15000 }, (error, stdout, stderr) => {
                  if (error) {
                    io.to(roomId).emit("terminal-output", { 
                      type: "error", 
                      text: `Compilation error:\n${stderr}` 
                    });
                    reject(error);
                    return;
                  }
                  
                  if (stderr && stderr.trim() !== '') {
                    // Some compilers output warnings to stderr even on successful compilation
                    io.to(roomId).emit("terminal-output", { 
                      type: "warning", 
                      text: stderr 
                    });
                  }
                  
                  io.to(roomId).emit("terminal-output", { 
                    type: "success", 
                    text: "Compilation successful" 
                  });
                  
                  resolve();
                });
              });

              command = `"${outputFile}"`;
              
              // Add a helpful message for users
              io.to(roomId).emit("terminal-output", { 
                type: "info", 
                text: `Running compiled ${isCpp ? 'C++' : 'C'} program...` 
              });
            } catch (error) {
              // Compilation failed - error already reported to user
              return;
            }
          } catch (error) {
            io.to(roomId).emit("terminal-output", {
              type: "error",
              text: `Error setting up ${isCpp ? 'C++' : 'C'} environment: ${error.message}`,
            });
            return;
          }
        } else {
          io.to(roomId).emit("terminal-output", {
            type: "error",
            text: `Unsupported file type: ${activeFile.name}. Currently supporting JavaScript, Python, C, and C++.`,
          });
          return;
        }
      } else {
        // Fall back to original implementation with file type detection
        // ... (rest of original implementation)
      }

      // Execute the command with timeout
      if (command) {
        // Log the command for debugging
        console.log(`Executing command: ${command}`);
        console.log(`Working directory: ${execDir}`);
        
        io.to(roomId).emit("terminal-output", { 
          type: "command", 
          text: `Executing: ${command.replace(/^"(.*)"$/, '$1')}` 
        });
        
        const child = exec(command, { 
          cwd: execDir,
          env: env,
          timeout: 10000, // 10 second timeout
          windowsHide: false // Show window on Windows for debugging
        }, (error, stdout, stderr) => {
          if (error) {
            console.error("Command execution error:", error);
            
            if (error.killed) {
              io.to(roomId).emit("terminal-output", { 
                type: "error", 
                text: "Execution timed out after 10 seconds" 
              });
            } else {
              io.to(roomId).emit("terminal-output", { 
                type: "error", 
                text: `Execution error: ${error.message}` 
              });
            }
            return;
          }

          if (stdout) {
            // Split output by newlines to allow individual line styling
            const outputLines = stdout.split('\n').filter(line => line.trim() !== '');
            
            // Send each line as a separate output message
            outputLines.forEach(line => {
              io.to(roomId).emit("terminal-output", { 
                type: "output", 
                text: line 
              });
            });
          }

          if (stderr) {
            io.to(roomId).emit("terminal-output", { type: "error", text: stderr });
          }
          
          if (!stdout && !stderr) {
            io.to(roomId).emit("terminal-output", { 
              type: "success", 
              text: "Code executed successfully with no output" 
            });
          }
        });

        // Clean up when done
        child.on('exit', async () => {
          try {
            await fsPromises.rm(execDir, { recursive: true, force: true });
          } catch (err) {
            console.error("Error cleaning up temp directory:", err);
          }
        });
      }
    } catch (err) {
      console.error("Error running code:", err)
      io.to(roomId).emit("terminal-output", {
        type: "error",
        text: `Server error: ${err.message}`,
      })
    }
  })

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`User ${username} (${userId}) disconnected from room ${roomId}`)

    // Remove user from room
    if (rooms.has(roomId)) {
      rooms.get(roomId).delete(socketId)

      // If room is empty, remove it
      if (rooms.get(roomId).size === 0) {
        rooms.delete(roomId)
        
        // Also clean up the file contents for this room
        if (fileContents && fileContents.has(roomId)) {
          fileContents.delete(roomId);
          console.log(`Cleaned up file contents for empty room ${roomId}`);
        }
      } else {
        // Broadcast updated user list
        io.to(roomId).emit(
          "room-users",
          Array.from(rooms.get(roomId).entries()).map(([id, user]) => ({
            id,
            username: user.username,
          })),
        )
      }
    }
  })
})

// API routes
app.get("/", (req, res) => {
  res.send("CodeCollab Server is running")
})

app.get("/api/rooms", (req, res) => {
  const roomsList = Array.from(rooms.entries()).map(([roomId, users]) => ({
    id: roomId,
    userCount: users.size,
  }))

  res.json(roomsList)
})

// Add a function to get the node path
function getNodePath() {
  const nodePathFile = path.join(__dirname, 'portable-node', 'node-path.txt');
  
  try {
    if (fs.existsSync(nodePathFile)) {
      const nodePath = fs.readFileSync(nodePathFile, 'utf8').trim();
      if (nodePath === 'PATH') {
        // Try to find Node.js in the system PATH
        try {
          const nodeCmd = process.platform === 'win32' ? 'where node' : 'which node';
          const result = execSync(nodeCmd).toString().trim();
          if (result) {
            return result;
          }
        } catch (e) {
          console.log('Node.js not found in PATH');
        }
      } else if (fs.existsSync(nodePath)) {
        return nodePath;
      }
    }
  } catch (err) {
    console.error('Error reading node path:', err);
  }
  
  // Return 'node' as a fallback (will use system PATH)
  return 'node';
}

const PORT = process.env.PORT || 5001
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

