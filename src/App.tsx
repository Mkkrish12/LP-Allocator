import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/ui/Sidebar'
import Dashboard from './pages/Dashboard'
import FundLibrary from './pages/FundLibrary'
import AnalyzeNewFund from './pages/AnalyzeNewFund'
import FundAnalysis from './pages/FundAnalysis'
import CompareFunds from './pages/CompareFunds'
import PortfolioView from './pages/PortfolioView'

export default function App() {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1280) setCollapsed(true)
      else setCollapsed(false)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <BrowserRouter>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'Inter, sans-serif' }}>
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#F7F8FA' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/library" element={<FundLibrary />} />
            <Route path="/analyze" element={<AnalyzeNewFund />} />
            <Route path="/fund/:id" element={<FundAnalysis />} />
            <Route path="/compare" element={<CompareFunds />} />
            <Route path="/portfolio" element={<PortfolioView />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
