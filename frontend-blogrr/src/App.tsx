import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { useSelector } from 'react-redux';
import LoadingScreen from 'shared/LoadingScreen';
import { RootState } from 'store/store';
import AppShell from 'features/chats/components/layout/AppShell';

// Lazy load components for code-splitting
const AuthPage = lazy(() => import('features/auth/pages/AuthPage'));
const BlogApp = lazy(() => import('features/blogs/pages/MyBlogs'));
const ChatLayout = lazy(() => import('features/chats/components/layout/ChatLayout'));
const OAuthCallback = lazy(() => import('features/auth/pages/OAuthCallback'));
const MyBlogs = lazy(() => import('features/blogs/pages/MyBlogs'));
const BlogRedirect = lazy(() => import('features/blogs/pages/BlogRedirect'));

function App() {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  // Log current URL for debugging
  useEffect(() => {
    console.log('Current URL:', window.location.href);
    console.log('Authentication state:', isAuthenticated);
  }, [isAuthenticated]);

  return (
    <Router>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          {/* Root route - redirect based on authentication */}
          <Route
            path="/"
            element={isAuthenticated ? <Navigate to="/blogs" replace /> : <AuthPage />}
          />

          {/* OAuth routes - handle both direct /blogs and /auth/callback paths */}
          <Route path="/blogs" element={<BlogRedirect />} />
          <Route path="/oauth/callback" element={<OAuthCallback />} />
          <Route path="/auth/callback" element={<OAuthCallback />} />

          {/* Protected routes */}
          <Route
            path="/my-blogs"
            element={isAuthenticated ? <MyBlogs /> : <Navigate to="/" replace />}
          />
          <Route
            path="/chats"
            element={
              isAuthenticated ? (
                <AppShell>
                  <ChatLayout />
                </AppShell>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />

          {/* Catch-all route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
