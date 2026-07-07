import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import PlanPage from './pages/PlanPage'
import ProfilePage from './pages/ProfilePage'
import ExclusionsPage from './pages/ExclusionsPage'
import DigestPage from './pages/DigestPage'
import ComingSoonPage from './pages/ComingSoonPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { currentMember, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-400">
        Loading…
      </div>
    )
  }
  if (!currentMember) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/plan" element={<PlanPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/exclusions" element={<ExclusionsPage />} />
        <Route path="/digest" element={<DigestPage />} />
        <Route path="/calendar" element={<ComingSoonPage title="Training Calendar" phase="Phase 4" description="Once the companion workout app ships, training sessions will flow in here and automatically shift carb timing and calorie totals around your workouts." />} />
        <Route path="/pantry" element={<ComingSoonPage title="Pantry & Shopping List" phase="Phase 5" description="Take a photo of the fridge/pantry to get meal suggestions from what's on hand, plus an auto-generated shopping list for anything missing." />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
