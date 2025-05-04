"use client"
import { motion } from "framer-motion"
import PropTypes from 'prop-types'
import "../styles/UserPresence.css"

const UserPresence = ({ users = [], showCount = true }) => {
  const getRandomColor = (username) => {
    let hash = 0
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash)
    }
    const hue = hash % 360
    return `hsl(${hue}, 70%, 60%)`
  }

  if (!Array.isArray(users)) {
    return null
  }

  return (
    <motion.div
      className="user-presence"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="users-list">
        {users.slice(0, 3).map((user, index) => (
          <motion.div
            key={user.id}
            className="user-avatar"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3, delay: 0.1 * index }}
            style={{
              backgroundColor: getRandomColor(user.username),
              zIndex: users.length - index,
            }}
            title={user.username}
          >
            {user.username.charAt(0).toUpperCase()}
          </motion.div>
        ))}
      </div>
      {showCount && (
        <div className="users-count">
          {users.length} {users.length === 1 ? 'user' : 'users'} online
        </div>
      )}
    </motion.div>
  )
}

UserPresence.propTypes = {
  users: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
  })),
  showCount: PropTypes.bool
}

export default UserPresence

