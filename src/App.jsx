import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Fertilisation from './pages/Fertilisation.jsx'
import PlanCulture from './pages/PlanCulture.jsx'
import TravailSol from './pages/TravailSol.jsx'
import Planning from './pages/Planning.jsx'
import Historique from './pages/Historique.jsx'
import Parametres from './pages/Parametres.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="plan" element={<PlanCulture />} />
          <Route path="fertilisation" element={<Fertilisation />} />
          <Route path="sol" element={<TravailSol />} />
          <Route path="planning" element={<Planning />} />
          <Route path="historique" element={<Historique />} />
          <Route path="parametres" element={<Parametres />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}