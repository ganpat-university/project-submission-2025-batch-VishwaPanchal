"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import UserPresence from "./UserPresence"
import "../styles/Toolbar.css"

const Toolbar = ({
  roomId,
  users,
  onRun,
  onToggleTerminal,
  onTogglePreview,
  onLeaveRoom,
  isTerminalOpen,
  isPreviewOpen,
  isRunning,
}) => {
  const [isCopied, setIsCopied] = useState(false)
  const [showPythonResources, setShowPythonResources] = useState(false)

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const pythonResources = [
    { name: "Python.org Official", url: "https://www.python.org/" },
    { name: "Python Documentation", url: "https://docs.python.org/3/" },
    { name: "Python Package Index (PyPI)", url: "https://pypi.org/" },
    { name: "Real Python Tutorials", url: "https://realpython.com/" },
    { name: "W3Schools Python", url: "https://www.w3schools.com/python/" },
  ]

  return (
    <motion.div
      className="toolbar"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="toolbar-left">
        <div className="room-info">
          <span className="room-label">Room:</span>
          <span className="room-id">{roomId}</span>
          <button className="icon-button small" onClick={copyRoomId} title="Copy Room ID">
            {isCopied ? <i className="fas fa-check"></i> : <i className="fas fa-copy"></i>}
          </button>
        </div>
      </div>

      <div className="toolbar-center">
        <button
          className={`toolbar-button ${isRunning ? "loading" : ""}`}
          onClick={onRun}
          title="Run Code"
          disabled={isRunning}
        >
          {isRunning ? (
            <>
              <i className="fas fa-spinner fa-spin"></i>
              <span>Running...</span>
            </>
          ) : (
            <>
              <i className="fas fa-play"></i>
              <span>Run</span>
            </>
          )}
        </button>

        <button
          className={`toolbar-button ${isTerminalOpen ? "active" : ""}`}
          onClick={onToggleTerminal}
          title="Toggle Terminal"
        >
          <i className="fas fa-terminal"></i>
          <span>Terminal</span>
        </button>

        <button
          className={`toolbar-button ${isPreviewOpen ? "active" : ""}`}
          onClick={onTogglePreview}
          title="Toggle Preview"
        >
          <i className="fas fa-eye"></i>
          <span>Preview</span>
        </button>
        
        <div className="python-resources-container">
          <button
            className="toolbar-button"
            onClick={() => setShowPythonResources(!showPythonResources)}
            title="Python Resources"
          >
            <i className="fas fa-book"></i>
            <span>Python</span>
          </button>
          
          {showPythonResources && (
            <div className="resources-dropdown">
              <h4>Python Resources</h4>
              <ul>
                {pythonResources.map((resource, index) => (
                  <li key={index}>
                    <a 
                      href={resource.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      {resource.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="toolbar-right">
        <UserPresence users={users} showCount={false} />
        <button className="toolbar-button leave-button" onClick={onLeaveRoom} title="Leave Room">
          <i className="fas fa-sign-out-alt"></i>
          <span>Leave</span>
        </button>
      </div>
    </motion.div>
  )
}

export default Toolbar

