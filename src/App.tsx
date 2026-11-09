import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Hub } from './pages/hub/Hub'
import { Landing } from './pages/landing/Landing'
import { Home } from './pages/home/Home'
import { Start } from './pages/start/Start'
import { ConnectFour } from './pages/connect-four/ConnectFour'
import DirectionRush from './pages/direction-rush/DirectionRush'
import { Lobby } from './pages/lobby/Lobby'
import { Queue } from './pages/queue/Queue'
import { OnlineSessionProvider, useOnlineSession } from './net/OnlineSessionContext'
import { SettingsProvider } from './settings/SettingsContext'
import { SettingsModal } from './components/SettingsModal'
import { ErrorBoundary } from './components/ErrorBoundary'

function RoomRouter() {
  const { session } = useOnlineSession()
  const game = session?.getSnapshot().game
  if (game === 'connect-four') {
    return <ConnectFour />
  }
  return <Home />
}

function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="w-full h-full"
      >
        <Routes location={location}>
          <Route path="/" element={<Hub />} />
          <Route path="/landing" element={<Landing />} />
          <Route path="/start" element={<Start />} />
          <Route path="/game" element={<Home />} />
          <Route path="/connect-four" element={<ConnectFour />} />
          <Route path="/direction-rush" element={<DirectionRush />} />
          <Route path="/lobby" element={<Lobby />} />
          <Route path="/room" element={<RoomRouter />} />
          <Route path="/queue" element={<Queue />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <OnlineSessionProvider>
          <Router>
            <SettingsModal />
            <AnimatedRoutes />
          </Router>
        </OnlineSessionProvider>
      </SettingsProvider>
    </ErrorBoundary>
  )
}

export default App
