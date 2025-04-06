import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { useSelector } from 'react-redux';
import LoadingScreen from 'shared/LoadingScreen';
import { RootState } from 'store/store';

// Lazy load components for code-splitting
const AuthPage = lazy(() => import('features/auth/pages/AuthPage'));
const BlogApp = lazy(() => import('features/blogs/pages/MyBlogs'));
const ChatApp = lazy(() => import('features/chats/ChatApp'));
const OAuthCallback = lazy(() => import('features/auth/pages/OAuthCallback'));
const MyBlogs = lazy(() => import('features/blogs/pages/MyBlogs'));
const BlogRedirect = lazy(() => import('features/blogs/pages/BlogRedirect'));

function App() {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  // Log authentication state for debugging
  console.log('App render - Authentication state:', isAuthenticated);
  
  // Log current URL for debugging
  useEffect(() => {
    console.log('Current URL:', window.location.href);
    console.log('Search params:', window.location.search);
  }, []);

  return (
    <Router>
      <Suspense>
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
            element={isAuthenticated ? <ChatApp /> : <Navigate to="/" replace />}
          />

          {/* Catch-all route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
