import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import { Home } from './pages/home/Home'
import { Start } from './pages/start/Start'

function App() {


  return (
    <>
      <Router>
        <Routes>
          <Route path='/' element={<Start />} />
          <Route path='/game' element={<Home />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </>
  )
}

export default App
