import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import { Home } from './pages/home/Home'
import { Start } from './pages/start/Start'
import { Lobby } from './pages/lobby/Lobby'
import { Queue } from './pages/queue/Queue'
import { OnlineSessionProvider } from './net/OnlineSessionContext'

function App() {


  return (
    <OnlineSessionProvider>
      <Router>
        <Routes>
          <Route path='/' element={<Start />} />
          <Route path='/game' element={<Home />} />
          <Route path='/lobby' element={<Lobby />} />
          <Route path='/room' element={<Home />} />
          <Route path='/queue' element={<Queue />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </OnlineSessionProvider>
  )
}

export default App