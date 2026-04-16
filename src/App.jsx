import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import AlbaChat from './pages/AlbaChat';
import ProdePredictions from './pages/ProdePredictions';
import Leaderboard from './pages/Leaderboard';
import AdminBadgesViewer from './pages/AdminBadgesViewer';
import AdminMatchSync from './pages/AdminMatchSync';
import AdminDataSync from './pages/AdminDataSync';
import ImportAFAData from './pages/ImportAFAData';
import SquadBuilder from './pages/SquadBuilder';
import Onboarding from './pages/Onboarding';
import Profile from './pages/Profile';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Show onboarding if user hasn't completed it
  if (user && !user.onboarding_completed) {
    return <Onboarding />;
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="/AlbaChat" element={<LayoutWrapper currentPageName="AlbaChat"><AlbaChat /></LayoutWrapper>} />
      <Route path="/ProdePredictions" element={<LayoutWrapper currentPageName="ProdePredictions"><ProdePredictions /></LayoutWrapper>} />
      <Route path="/Leaderboard" element={<LayoutWrapper currentPageName="Leaderboard"><Leaderboard /></LayoutWrapper>} />
      <Route path="/AdminBadgesViewer" element={<LayoutWrapper currentPageName="AdminBadgesViewer"><AdminBadgesViewer /></LayoutWrapper>} />
      <Route path="/AdminDataSync" element={<LayoutWrapper currentPageName="AdminDataSync"><AdminDataSync /></LayoutWrapper>} />
      <Route path="/ImportAFAData" element={<LayoutWrapper currentPageName="ImportAFAData"><ImportAFAData /></LayoutWrapper>} />
      <Route path="/SquadBuilder" element={<LayoutWrapper currentPageName="SquadBuilder"><SquadBuilder /></LayoutWrapper>} />
      <Route path="/Profile" element={<LayoutWrapper currentPageName="Profile"><Profile /></LayoutWrapper>} />
      <Route path="/AdminMatchSync" element={<LayoutWrapper currentPageName="AdminMatchSync"><AdminMatchSync /></LayoutWrapper>} />
      <Route path="/OnboardingTest" element={<Onboarding />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App