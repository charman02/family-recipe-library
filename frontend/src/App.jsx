import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import PublicOnlyRoute from './components/PublicOnlyRoute'
import BottomNav from './components/BottomNav'
import Login from './pages/Login'
import Welcome from './pages/Welcome'
import Home from './pages/Home'
import Browse from './pages/Browse'
import MyRecipes from './pages/MyRecipes'
import RecipePage from './pages/RecipePage'
import PlantRecipe from './pages/PlantRecipe'
import EditRecipe from './pages/EditRecipe'
import HandoffPage from './pages/HandoffPage'
import SharedWithMe from './pages/SharedWithMe'
import Profile from './pages/Profile'
import InviteLanding from './pages/InviteLanding'

function Layout({ children }) {
  return (
    <div className="max-w-app mx-auto min-h-screen pb-28">
      {children}
      <BottomNav />
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        }
      />
      <Route path="/invite/:token" element={<InviteLanding />} />
      {/* The post-signup welcome. Protected (it's for an account that exists,
          and a signed-out visitor has nothing to be welcomed to) but pointedly
          NOT wrapped in Layout: no bottom nav, because a two-panel intro whose
          own buttons lead out doesn't need a second set of exits, and tab bars
          invite wandering off mid-explanation. Welcome self-redirects to Home
          once seen, so nobody can be stranded here. */}
      <Route
        path="/welcome"
        element={
          <ProtectedRoute>
            <Welcome />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <Home />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/browse"
        element={
          <ProtectedRoute>
            <Layout>
              <Browse />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-recipes"
        element={
          <ProtectedRoute>
            <Layout>
              <MyRecipes />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/recipes/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <RecipePage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/recipes/:id/edit"
        element={
          <ProtectedRoute>
            <Layout>
              <EditRecipe />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/recipes/:id/handoff"
        element={
          <ProtectedRoute>
            <Layout>
              <HandoffPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/shared"
        element={
          <ProtectedRoute>
            <Layout>
              <SharedWithMe />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/add"
        element={
          <ProtectedRoute>
            <Layout>
              <PlantRecipe />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Layout>
              <Profile />
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
