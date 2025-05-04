"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { io } from "socket.io-client"
import { Editor as MonacoEditor } from "@monaco-editor/react"
import { motion } from "framer-motion"
import Sidebar from "../components/Sidebar"
import Toolbar from "../components/Toolbar"
import Terminal from "../components/Terminal"
import UserPresence from "../components/UserPresence"
import "../styles/Editor.css"
import { useAuth } from "../context/AuthContext"
import CustomCursor from "../components/CustomCursor"
import DebugPanel from "../components/DebugPanel"
import { toast } from "react-hot-toast"

const Editor = () => {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const [socket, setSocket] = useState(null)
  const [files, setFiles] = useState([
    {
      id: "index.html",
      name: "index.html",
      language: "html",
      value: `<!DOCTYPE html>
<html>
<head>
  <title>My Page</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #f5f5f5;
    }

    h1 {
      color: #333;
    }
    
    button {
      padding: 8px 16px;
      background-color: #4285f4;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    
    button:hover {
      background-color: #3367d6;
    }
  </style>
</head>
<body>
  <h1>Hello, World!</h1>
  <p>Welcome to CodeCollab Editor</p>
  <p>Create new files using the File menu in the sidebar.</p>
  <p>Supported languages:</p>
  <ul>
    <li>HTML/CSS/JavaScript</li>
    <li>Python</li>
    <li>C</li>
    <li>C++</li>
  </ul>
  <button id="myButton">Click Me</button>
  
  <script>
    // JavaScript code here
    document.getElementById("myButton").addEventListener("click", function() {
      this.textContent = "Clicked!";
      this.style.backgroundColor = "#34a853";
    });
  </script>
</body>
</html>`,
      isActive: true,
      type: "file"
    },
  ])
  const [activeFile, setActiveFile] = useState(files[0])
  const [users, setUsers] = useState([])
  const [isTerminalOpen, setIsTerminalOpen] = useState(false)
  const [terminalOutput, setTerminalOutput] = useState([])
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const editorRef = useRef(null)
  const { currentUser } = useAuth()
  const username = currentUser?.displayName || currentUser?.email || "Anonymous"
  const [theme, setTheme] = useState("vs-dark")
  const [isDebugging, setIsDebugging] = useState(false)
  const [breakpoints, setBreakpoints] = useState([])
  const [terminals, setTerminals] = useState([{ id: 1, name: "Terminal 1" }])
  const [activeTerminal, setActiveTerminal] = useState(1)
  const [editorSettings] = useState({
    fontSize: 16,
    fontFamily: '"SF Mono", "Menlo", "Monaco", "Ubuntu Mono", monospace',
    fontWeight: 'normal',
    fontLigatures: true,
    letterSpacing: 0.5,
    wordWrap: "on",
    minimap: { enabled: true },
    formatOnSave: true,
    lineHeight: 22,
    renderWhitespace: 'selection',
    smoothScrolling: true,
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: true,
  })

  // Enable custom cursor
  useEffect(() => {
    document.body.classList.add("custom-cursor-active")

    return () => {
      document.body.classList.remove("custom-cursor-active")
    }
  }, [])

  useEffect(() => {
    const socketInstance = io("http://localhost:5001", {
      query: {
        roomId,
        username,
        userId: currentUser?.uid || "anonymous-user",
      },
    })

    socketInstance.on("connect", () => {
      console.log("Connected to server")
    })

    socketInstance.on("room-users", (roomUsers) => {
      setUsers(roomUsers)
    })

    socketInstance.on("file-change", ({ fileId, value }) => {
      setFiles((prevFiles) => prevFiles.map((file) => (file.id === fileId ? { ...file, value } : file)))

      if (activeFile.id === fileId && editorRef.current) {
        // Only update if the current model value is different to avoid cursor jumping
        const currentValue = editorRef.current.getValue()
        if (currentValue !== value) {
          editorRef.current.setValue(value)
        }
      }
    })

    socketInstance.on("new-file", (file) => {
      setFiles((prevFiles) => [...prevFiles, file])
    })

    socketInstance.on("delete-file", (fileId) => {
      setFiles((prevFiles) => {
        const updatedFiles = prevFiles.filter((file) => file.id !== fileId)
        if (activeFile.id === fileId && updatedFiles.length > 0) {
          setActiveFile(updatedFiles[0])
        } else if (activeFile.id === fileId && updatedFiles.length === 0) {
          // Handle the case where there are no files left.  Ideally, create a default file.
          // For now, we'll just leave the editor blank.
          setActiveFile(null)
        }
        return updatedFiles
      })
    })

    socketInstance.on("rename-file", ({ fileId, newName }) => {
      setFiles((prevFiles) => prevFiles.map((file) => (file.id === fileId ? { ...file, name: newName } : file)))
    })

    socketInstance.on("terminal-output", (output) => {
      setTerminalOutput((prev) => [...prev, output])
      if (output.type === "command" && output.text === "Running code...") {
        setIsRunning(true)
      } else if (output.type === "output" || output.type === "error") {
        setIsRunning(false)
      }
    })

    socketInstance.on("disconnect", () => {
      console.log("Disconnected from server")
    })

    setSocket(socketInstance)

    // Show welcome information in the terminal
    setTerminalOutput(prev => [
      ...prev,
      {
        type: "info",
        text: "Welcome to CodeCollab Editor"
      },
      {
        type: "info",
        text: "You can create and run code in various languages including HTML, JavaScript, Python, C, and C++."
      },
      {
        type: "info",
        text: "Create new files using the File menu in the sidebar."
      }
    ]);
    setIsTerminalOpen(true);

    return () => {
      socketInstance.disconnect()
    }
  }, [roomId, username, currentUser, activeFile])

  const handleEditorDidMount = (editor) => {
    editorRef.current = editor
  }

  const handleEditorChange = (value) => {
    if (!socket || !activeFile) return

    // Update local state
    setFiles((prevFiles) => prevFiles.map((file) => (file.id === activeFile.id ? { ...file, value } : file)))

    // Send to server
    socket.emit("file-change", {
      roomId,
      fileId: activeFile.id,
      value,
    })
  }

  const handleFileSelect = (file) => {
    setActiveFile(file)
  }

  const handleCreateFile = (fileName, language = "javascript", parentFolderId = null) => {
    // Check if file with same name already exists
    if (files.some((file) => file.name === fileName)) {
      toast.error(`File ${fileName} already exists`);
      return;
    }

    let newFile;
    const extension = fileName.split(".").pop().toLowerCase();

    if (extension === "html") {
      newFile = createHtmlWithJsTemplate(fileName);
    } else if (extension === "css") {
      newFile = createFile(fileName, "/* CSS styles */\n");
    } else if (extension === "py") {
      const pythonContent = `# Python code
print("Hello, World from Python!")

# Function definition
def greet(name):
    return f"Hello, {name}!"

if __name__ == "__main__":
    print(greet("User"))
    
    # Variables and data types
    number = 42
    pi = 3.14159
    text = "Python Programming"
    is_fun = True
    
    print(f"Number: {number}")
    print(f"Pi: {pi}")
    print(f"Text: {text}")
    print(f"Is Python fun? {is_fun}")
    
    # List operations
    numbers = [1, 2, 3, 4, 5]
    print(f"List: {numbers}")
    print(f"Squared: {[n**2 for n in numbers]}")
`;
      newFile = createFile(fileName, pythonContent);
    } else if (extension === "c") {
      newFile = createCTemplate(fileName);
    } else if (extension === "cpp" || extension === "cc") {
      newFile = createCppTemplate(fileName);
    } else {
      newFile = createFile(fileName, "");
    }

    newFile.type = "file"
    if (parentFolderId) {
      setFiles(prevFiles => addToFolder(prevFiles, parentFolderId, newFile))
    } else {
      setFiles(prevFiles => [...prevFiles, newFile])
    }
    setActiveFile(newFile)

    // Emit socket event for new file
    if (socket) {
      socket.emit("new-file", { roomId, file: newFile });
    }

    // If this is a Python file, check if we have a requirements.txt file already
    if (extension === "py" && !flattenFiles(files).some((file) => file.name === "requirements.txt")) {
      // Offer to create a requirements.txt file
      if (window.confirm("Would you like to create a requirements.txt file for Python dependencies?")) {
        createRequirementsTxt();
      }
    }
  };

  // Helper function to create HTML template with JS
  const createHtmlWithJsTemplate = (fileName) => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${fileName}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            line-height: 1.6;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 5px;
        }
        .output {
            background-color: #f4f4f4;
            padding: 10px;
            border-radius: 4px;
            margin-top: 10px;
        }
        button {
            padding: 8px 16px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        button:hover {
            background-color: #45a049;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>JavaScript in HTML Example</h1>
        <p>This file demonstrates how to use JavaScript in an HTML document.</p>
        
        <button onclick="runExample()">Run Example</button>
        <div id="output" class="output">Results will appear here</div>
    </div>

    <script>
        // Your JavaScript code goes here
        function runExample() {
            const output = document.getElementById('output');
            
            // Example operations
            const numbers = [1, 2, 3, 4, 5];
            const sum = numbers.reduce((total, num) => total + num, 0);
            const doubled = numbers.map(num => num * 2);
            
            // Display results
            output.innerHTML = \`
                <p>Original array: [\${numbers.join(', ')}]</p>
                <p>Sum of numbers: \${sum}</p>
                <p>Doubled values: [\${doubled.join(', ')}]</p>
                <p>Current time: \${new Date().toLocaleTimeString()}</p>
            \`;
        }
        
        // You can also add event listeners
        document.addEventListener('DOMContentLoaded', () => {
            console.log('HTML document loaded and parsed');
        });
    </script>
</body>
</html>`;
  }

  // Helper function to create a file with content
  const createFile = (fileName, content) => {
    const extension = fileName.split(".").pop().toLowerCase();
    let language = "text";

    if (extension === "html") language = "html";
    else if (extension === "css") language = "css";
    else if (extension === "js" || extension === "jsx") language = "javascript";
    else if (extension === "ts" || extension === "tsx") language = "typescript";
    else if (extension === "json") language = "json";
    else if (extension === "md") language = "markdown";
    else if (extension === "py") language = "python";
    else if (extension === "c") language = "c";
    else if (extension === "cpp" || extension === "cc" || extension === "cxx") language = "cpp";
    else if (extension === "h" || extension === "hpp") language = "cpp"; // Header files use C++ highlighting

    return {
      id: fileName, // Use fileName as ID to make it easier to reference
      name: fileName,
      language,
      value: content || "",
    };
  };

  const createRequirementsTxt = () => {
    const requirementsContent = `# Python dependencies - one per line
# Example:
# numpy==1.20.3
# pandas==1.3.0
# matplotlib==3.4.2
`;

    const requirementsFile = createFile("requirements.txt", requirementsContent);

    setFiles((prevFiles) => [...prevFiles, requirementsFile]);

    // Emit socket event for new file
    if (socket) {
      socket.emit("new-file", { roomId, file: requirementsFile });
    }

    toast.success("requirements.txt file created");
  };

  const handleCreateFolder = (folderName, parentFolderId = null) => {
    const newFolder = {
      id: Date.now().toString(),
      name: folderName,
      type: "folder",
      children: [],
    }
    if (parentFolderId) {
      setFiles(prev => addToFolder(prev, parentFolderId, newFolder))
    } else {
      setFiles(prev => [...prev, newFolder])
    }
    if (socket) {
      socket.emit("new-folder", { roomId, folder: newFolder })
    }
  };

  const handleDeleteFile = (fileId) => {
    setFiles(prev => deleteById(prev, fileId))
    if (activeFile && activeFile.id === fileId) {
      setActiveFile(null)
    }
    if (socket) {
      socket.emit("delete-file", { roomId, fileId })
    }
  }

  const handleRenameFile = (fileId, newName) => {
    setFiles(prev => renameById(prev, fileId, newName))
    if (socket) {
      socket.emit("rename-file", { roomId, fileId, newName })
    }
  }

  const handleRunCode = () => {
    if (!socket) return;
    setIsTerminalOpen(true);

    // Send terminal command execution message
    setTerminalOutput((prev) => [
      ...prev,
      {
        type: "command",
        text: `Running ${activeFile.name}...`
      },
    ]);

    // Preparing files to send to server
    const preparedFiles = files.map((file) => ({
      name: file.name,
      content: file.value,
      isActive: file.id === activeFile.id
    }));

    // Identify if active file is HTML
    const isHtml = activeFile.name.endsWith(".html");
    const isPython = activeFile.name.endsWith(".py");
    const isJs = activeFile.name.endsWith(".js");
    const isC = activeFile.name.endsWith(".c");
    const isCpp = activeFile.name.endsWith(".cpp") || activeFile.name.endsWith(".cc");

    // For HTML files, use preview instead of running
    if (isHtml) {
      setIsPreviewOpen(true);
      setTerminalOutput((prev) => [
        ...prev,
        {
          type: "info",
          text: "HTML file detected. Opened in preview mode."
        },
      ]);
      return;
    }

    // Special handling for C/C++ files
    if (isC || isCpp) {
      setTerminalOutput((prev) => [
        ...prev,
        {
          type: "info",
          text: `${isC ? 'C' : 'C++'} file detected. Compiling...`
        },
      ]);
    }

    // Execute code on server
    socket.emit("run-code", {
      roomId,
      activeFileId: activeFile.id,
      files: preparedFiles
    });

    setIsRunning(true);
  };

  const handleLeaveRoom = () => {
    navigate("/")
  }

  const toggleTerminal = () => {
    setIsTerminalOpen(prev => !prev)
    if (!isTerminalOpen) {
      setTerminalOutput([]) // Clear terminal output when opening
    }
  }

  const togglePreview = () => {
    setIsPreviewOpen((prev) => !prev)
  }

  // Function to get HTML content
  const getHtmlContent = () => {
    const htmlFile = flattenFiles(files).find((f) => f.name.endsWith(".html"))
    return htmlFile ? htmlFile.value : ""
  }

  // Function to get CSS content
  const getCssContent = () => {
    const cssFile = flattenFiles(files).find((f) => f.name.endsWith(".css"))
    return cssFile ? cssFile.value : ""
  }

  // Function to get JavaScript content
  const getJsContent = () => {
    const jsFile = flattenFiles(files).find((f) => f.name.endsWith(".js"))
    return jsFile ? jsFile.value : ""
  }

  // Editor options
  const editorOptions = {
    ...editorSettings,
    readOnly: isDebugging,
    lineNumbers: "on",
    roundedSelection: false,
    scrollBeyondLastLine: false,
    automaticLayout: true,
  }

  // Handle file operations
  const handleSaveFile = () => {
    if (!activeFile) return
    // Implement save logic
    socket?.emit("save-file", { roomId, fileId: activeFile.id, content: activeFile.value })
  }

  const handleDuplicateFile = (file) => {
    const newFile = {
      ...file,
      id: Date.now().toString(),
      name: `${file.name.split(".")[0]}_copy.${file.name.split(".")[1]}`,
    }
    setFiles(prev => [...prev, newFile])
  }

  const startDebugging = () => {
    setIsDebugging(true)
    socket?.emit("debug-start", { roomId, fileId: activeFile.id })
  }

  // Add these new template functions after the existing ones like createHtmlWithJsTemplate
  const createCTemplate = (fileName) => {
    return {
      id: fileName,
      name: fileName,
      language: "c",
      value: `#include <stdio.h>
#include <stdlib.h>

/**
 * A simple C program example
 */
int main() {
    printf("Hello, World from C!\\n");
    
    // Variable declaration and initialization
    int number = 42;
    float pi = 3.14159;
    char letter = 'A';
    
    // Output variables
    printf("Number: %d\\n", number);
    printf("Pi: %.5f\\n", pi);
    printf("Letter: %c\\n", letter);
    
    // Arrays
    int numbers[5] = {1, 2, 3, 4, 5};
    printf("Array elements: ");
    for(int i = 0; i < 5; i++) {
        printf("%d ", numbers[i]);
    }
    printf("\\n");
    
    // Conditional statements
    if(number > 40) {
        printf("Number is greater than 40\\n");
    } else {
        printf("Number is not greater than 40\\n");
    }
    
    return 0;
}`,
    };
  };

  const createCppTemplate = (fileName) => {
    return {
      id: fileName,
      name: fileName,
      language: "cpp",
      value: `#include <iostream>
#include <vector>
#include <string>

/**
 * A simple C++ program example
 */
class Person {
private:
    std::string name;
    int age;
    
public:
    // Constructor
    Person(std::string name, int age) : name(name), age(age) {}
    
    // Member function
    void introduce() {
        std::cout << "Hello, my name is " << name << " and I am " << age << " years old." << std::endl;
    }
};

int main() {
    std::cout << "Hello, World from C++!" << std::endl;
    
    // Variable declaration and initialization
    int number = 42;
    double pi = 3.14159;
    char letter = 'A';
    std::string text = "C++ Programming";
    
    // Output variables
    std::cout << "Number: " << number << std::endl;
    std::cout << "Pi: " << pi << std::endl;
    std::cout << "Letter: " << letter << std::endl;
    std::cout << "Text: " << text << std::endl;
    
    // Vectors (dynamic arrays)
    std::vector<int> numbers = {1, 2, 3, 4, 5};
    std::cout << "Vector elements: ";
    for(int num : numbers) {
        std::cout << num << " ";
    }
    std::cout << std::endl;
    
    // Using the Person class
    Person alice("Alice", 30);
    alice.introduce();
    
    return 0;
}`,
    };
  };

  // Helper to find a file/folder by id recursively
  const findFileById = (items, id) => {
    for (let item of items) {
      if (item.id === id) return item
      if (item.type === 'folder' && item.children) {
        const found = findFileById(item.children, id)
        if (found) return found
      }
    }
    return null
  }

  // Helper to update a file/folder tree recursively
  const updateTree = (items, id, updater) => {
    return items.map(item => {
      if (item.id === id) {
        return updater(item)
      } else if (item.type === 'folder' && item.children) {
        return { ...item, children: updateTree(item.children, id, updater) }
      } else {
        return item
      }
    })
  }

  // Helper to add a file/folder to a folder
  const addToFolder = (items, parentId, newItem) => {
    return items.map(item => {
      if (item.id === parentId && item.type === 'folder') {
        return { ...item, children: [...item.children, newItem] }
      } else if (item.type === 'folder' && item.children) {
        return { ...item, children: addToFolder(item.children, parentId, newItem) }
      } else {
        return item
      }
    })
  }

  // Helper to delete a file/folder by id
  const deleteById = (items, id) => {
    return items.filter(item => {
      if (item.id === id) return false
      if (item.type === 'folder' && item.children) {
        item.children = deleteById(item.children, id)
      }
      return true
    })
  }

  // Helper to rename a file/folder by id
  const renameById = (items, id, newName) => {
    return items.map(item => {
      if (item.id === id) {
        return { ...item, name: newName }
      } else if (item.type === 'folder' && item.children) {
        return { ...item, children: renameById(item.children, id, newName) }
      } else {
        return item
      }
    })
  }

  // Helper to flatten all files for search
  const flattenFiles = (items) => {
    let result = []
    for (let item of items) {
      if (item.type === 'file') result.push(item)
      if (item.type === 'folder' && item.children) result = result.concat(flattenFiles(item.children))
    }
    return result
  }

  return (
    <div className="editor-container">
      <CustomCursor />

      <Toolbar
        roomId={roomId}
        onRun={handleRunCode}
        onToggleTerminal={toggleTerminal}
        onTogglePreview={togglePreview}
        onLeaveRoom={handleLeaveRoom}
        isTerminalOpen={isTerminalOpen}
        isPreviewOpen={isPreviewOpen}
        isRunning={isRunning}
        onSave={handleSaveFile}
        onDebug={startDebugging}
        isDebugging={isDebugging}
        theme={theme}
        onThemeChange={setTheme}
      />

      <div className="editor-main">
        <Sidebar
          files={files}
          activeFile={activeFile}
          onFileSelect={handleFileSelect}
          onCreateFile={handleCreateFile}
          onCreateFolder={handleCreateFolder}
          onDeleteFile={handleDeleteFile}
          onRenameFile={handleRenameFile}
          onDuplicateFile={handleDuplicateFile}
          currentUser={currentUser}
        />

        <div className="editor-content">
          <motion.div
            className="monaco-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <MonacoEditor
              height="100%"
              language={activeFile.language === "cpp" || activeFile.language === "c" ? "cpp" : activeFile.language}
              value={activeFile.value}
              theme={theme}
              onChange={handleEditorChange}
              onMount={handleEditorDidMount}
              options={{
                ...editorSettings,
                automaticLayout: true,
                scrollBeyondLastLine: false,
              }}
              beforeMount={(monaco) => {
                // Configure Monaco editor for C and C++
                monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
                  target: monaco.languages.typescript.ScriptTarget.ES2016,
                  allowNonTsExtensions: true,
                });

                // Configure C file extension
                monaco.languages.register({ id: 'c', extensions: ['.c'], aliases: ['C'] });

                // Configure C++ file extensions
                monaco.languages.register({
                  id: 'cpp',
                  extensions: ['.cpp', '.cc', '.cxx', '.hpp', '.h'],
                  aliases: ['C++', 'CPP']
                });

                // Set up proper language configuration for C
                monaco.languages.setLanguageConfiguration('c', {
                  comments: {
                    lineComment: '//',
                    blockComment: ['/*', '*/'],
                  },
                  brackets: [
                    ['{', '}'],
                    ['[', ']'],
                    ['(', ')']
                  ],
                  autoClosingPairs: [
                    { open: '{', close: '}' },
                    { open: '[', close: ']' },
                    { open: '(', close: ')' },
                    { open: '"', close: '"' },
                    { open: "'", close: "'" },
                  ],
                  surroundingPairs: [
                    { open: '{', close: '}' },
                    { open: '[', close: ']' },
                    { open: '(', close: ')' },
                    { open: '"', close: '"' },
                    { open: "'", close: "'" },
                  ],
                });
              }}
            />
          </motion.div>

          {isPreviewOpen && (
            <div className="preview-container">
              <iframe
                title="Preview"
                srcDoc={`
                  <!DOCTYPE html>
                  <html>
                    <head>
                      <style>${getCssContent()}</style>
                    </head>
                    <body>
                      ${getHtmlContent()}
                      <script>${getJsContent()}</script>
                    </body>
                  </html>
                `}
                sandbox="allow-scripts"
                width="100%"
                height="100%"
              />
            </div>
          )}

          {isDebugging && (
            <DebugPanel
              breakpoints={breakpoints}
              onBreakpointChange={setBreakpoints}
              isDebugging={isDebugging}
              onStopDebugging={() => setIsDebugging(false)}
            />
          )}
        </div>
      </div>

      {isTerminalOpen && (
        <Terminal
          output={terminalOutput}
          onClose={toggleTerminal}
          terminals={terminals}
          activeTerminal={activeTerminal}
          onTerminalCreate={() => {
            setTerminals(prev => [...prev, {
              id: prev.length + 1,
              name: `Terminal ${prev.length + 1}`
            }])
          }}
          onTerminalSelect={setActiveTerminal}
        />
      )}

      <UserPresence users={users} />
    </div>
  )
}

export default Editor
