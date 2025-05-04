import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import PrivateRoute from "./components/PrivateRoute"
import LandingPage from "./pages/LandingPage"
import Login from "./pages/Login"
import Signup from "./pages/Signup"
import ForgotPassword from "./pages/ForgotPassword"
import CreateRoom from "./pages/CreateRoom"
import JoinRoom from "./pages/JoinRoom"
import Editor from "./pages/Editor"
import BlogPage from "./pages/BlogPage"
import { Toaster } from "react-hot-toast"
import "./App.css"

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="app">
          <Toaster position="top-right" />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route
              path="/create"
              element={
                <PrivateRoute>
                  <CreateRoom />
                </PrivateRoute>
              }
            />
            <Route
              path="/join"
              element={
                <PrivateRoute>
                  <JoinRoom />
                </PrivateRoute>
              }
            />
            <Route
              path="/editor/:roomId"
              element={
                <PrivateRoute>
                  <Editor />
                </PrivateRoute>
              }
            />
            <Route path="/blog/:id" element={<BlogPage />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  )
}

export default App

