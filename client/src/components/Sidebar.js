"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import "../styles/Sidebar.css"

const Sidebar = ({ files, activeFile, onFileSelect, onCreateFile, onCreateFolder, onDeleteFile, onRenameFile }) => {
  const [isCreatingFile, setIsCreatingFile] = useState(false)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [newFileName, setNewFileName] = useState("")
  const [newFolderName, setNewFolderName] = useState("")
  const [editingFileId, setEditingFileId] = useState(null)
  const [editingFileName, setEditingFileName] = useState("")
  const [showFileDropdown, setShowFileDropdown] = useState(false)

  const handleCreateFile = () => {
    setIsCreatingFile(true)
    setNewFileName("")
  }

  const handleCreateFileSubmit = (e) => {
    e.preventDefault()
    if (!newFileName.trim()) return

    // Determine language based on file extension
    const extension = newFileName.split(".").pop()
    let language = "javascript"

    if (extension === "html") language = "html"
    else if (extension === "css") language = "css"
    else if (extension === "json") language = "json"
    else if (extension === "md") language = "markdown"
    else if (["js", "jsx"].includes(extension)) language = "javascript"
    else if (["ts", "tsx"].includes(extension)) language = "typescript"
    else if (["py"].includes(extension)) language = "python"
    else if (["c", "cpp", "h"].includes(extension)) language = "cpp"

    onCreateFile(newFileName, language)
    setIsCreatingFile(false)
  }

  const handleCreateFolder = () => {
    setIsCreatingFolder(true)
    setNewFolderName("")
  }

  const handleCreateFolderSubmit = (e) => {
    e.preventDefault()
    if (!newFolderName.trim()) return

    onCreateFolder(newFolderName)
    setIsCreatingFolder(false)
  }

  const handleStartRename = (file) => {
    setEditingFileId(file.id)
    setEditingFileName(file.name)
  }

  const handleRenameSubmit = (e) => {
    e.preventDefault()
    if (!editingFileName.trim()) return

    onRenameFile(editingFileId, editingFileName)
    setEditingFileId(null)
  }

  const getFileIcon = (fileName, isFolder = false) => {
    if (isFolder) return "📁"; // Folder icon

    const extension = fileName.split(".").pop();

    if (extension === "html") return "🌐";
    if (extension === "css") return "🎨";
    if (extension === "js") return "📜";
    if (extension === "jsx") return "⚛️";
    if (extension === "ts" || extension === "tsx") return "📘";
    if (extension === "json") return "📋";
    if (extension === "md") return "📝";
    if (extension === "py") return "🐍";
    if (extension === "c" || extension === "cpp" || extension === "h") return "⚙️";

    return "📄";
  }

  const createQuickFile = (fileType) => {
    let fileName = "";
    switch(fileType) {
      case "html":
        fileName = `page${Date.now()}.html`;
        break;
      case "css":
        fileName = `styles${Date.now()}.css`;
        break;
      case "python":
        fileName = `main${Date.now()}.py`;
        break;
      case "c":
        fileName = `main${Date.now()}.c`;
        break;
      case "cpp":
        fileName = `main${Date.now()}.cpp`;
        break;
      default:
        fileName = `file${Date.now()}.txt`;
    }
    onCreateFile(fileName, fileType);
    setShowFileDropdown(false);
  };

  return (
    <motion.div
      className="sidebar"
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="sidebar-header">
        <div className="file-dropdown-container">
          <button 
            className="icon-button" 
            onClick={() => setShowFileDropdown(!showFileDropdown)} 
            title="Create new file"
          >
            <i className="fas fa-plus"></i> File <i className="fas fa-caret-down"></i>
          </button>
          {showFileDropdown && (
            <div className="file-dropdown">
              <button onClick={() => handleCreateFile()}>Custom File...</button>
              <button onClick={() => createQuickFile("html")}>
                <span className="file-icon">🌐</span> HTML File
              </button>
              <button onClick={() => createQuickFile("css")}>
                <span className="file-icon">🎨</span> CSS File
              </button>
              <button onClick={() => createQuickFile("python")}>
                <span className="file-icon">🐍</span> Python File
              </button>
              <button onClick={() => createQuickFile("c")}>
                <span className="file-icon">⚙️</span> C File
              </button>
              <button onClick={() => createQuickFile("cpp")}>
                <span className="file-icon">⚙️</span> C++ File
              </button>
            </div>
          )}
        </div>
        <button className="icon-button" onClick={handleCreateFolder} title="Create new folder">
          <i className="fas fa-folder-plus"></i> Folder
        </button>
      </div>

      <div className="files-list">
        {files.map((file) => (
          <div key={file.id} className={`file-item ${activeFile?.id === file.id ? "active" : ""}`}>
            {editingFileId === file.id ? (
              <form onSubmit={handleRenameSubmit} className="rename-form">
                <input
                  type="text"
                  value={editingFileName}
                  onChange={(e) => setEditingFileName(e.target.value)}
                  autoFocus
                  onBlur={handleRenameSubmit}
                />
              </form>
            ) : (
              <>
                <div className="file-name" onClick={() => onFileSelect(file)}>
                  <span className="file-icon">{getFileIcon(file.name, file.type === "folder")}</span>
                  {file.name}
                </div>
                <div className="file-actions">
                  <button className="icon-button small" onClick={() => handleStartRename(file)} title="Rename file">
                    <i className="fas fa-edit"></i>
                  </button>
                  <button className="icon-button small" onClick={() => onDeleteFile(file.id)} title="Delete file">
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        {isCreatingFile && (
          <form onSubmit={handleCreateFileSubmit} className="new-file-form">
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="filename.ext"
              autoFocus
              onBlur={() => setIsCreatingFile(false)}
            />
          </form>
        )}
        {isCreatingFolder && (
          <form onSubmit={handleCreateFolderSubmit} className="new-folder-form">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="foldername"
              autoFocus
              onBlur={() => setIsCreatingFolder(false)}
            />
          </form>
        )}
      </div>
    </motion.div>
  )
}

export default Sidebar

