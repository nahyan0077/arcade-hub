import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import { Hub } from './pages/hub/Hub'
import { Home } from './pages/home/Home'
import { Start } from './pages/start/Start'
import { ConnectFour } from './pages/connect-four/ConnectFour'
import { Lobby } from './pages/lobby/Lobby'
import { Queue } from './pages/queue/Queue'
import { OnlineSessionProvider, useOnlineSession } from './net/OnlineSessionContext'

function RoomRouter() {
  const { session } = useOnlineSession()
  if (session?.getSnapshot().game === 'connect-four') {
    return <ConnectFour />
  }
  return <Home />
}

function App() {


  return (
    <OnlineSessionProvider>
      <Router>
        <Routes>
          <Route path='/' element={<Hub />} />
          <Route path='/start' element={<Start />} />
          <Route path='/game' element={<Home />} />
          <Route path='/connect-four' element={<ConnectFour />} />
          <Route path='/lobby' element={<Lobby />} />
          <Route path='/room' element={<RoomRouter />} />
          <Route path='/queue' element={<Queue />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </OnlineSessionProvider>
  )
}

export default App