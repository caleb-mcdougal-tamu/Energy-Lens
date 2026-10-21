import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import ReauthDialog from '@/components/ReauthDialog';
// Add page imports here
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import SignIn from '@/pages/SignIn';
import SetupRequired from '@/pages/SetupRequired';
import AssessmentDetail from '@/pages/AssessmentDetail';
import EquipmentTypeDetail from '@/pages/EquipmentTypeDetail';
import EquipmentDetail from '@/pages/EquipmentDetail';

const AuthenticatedApp = () => {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (status === 'unconfigured') return <SetupRequired />;
  if (status === 'signedOut') return <SignIn />;

  // Render the main app
  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/assessment/:assessmentId" element={<AssessmentDetail />} />
          <Route path="/assessment/:assessmentId/type/:typeId" element={<EquipmentTypeDetail />} />
          <Route path="/assessment/:assessmentId/type/:typeId/equipment/:equipmentId" element={<EquipmentDetail />} />
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
      <ReauthDialog />
    </>
  );
};


function App() {

  return (
    <QueryClientProvider client={queryClientInstance}>
      <AuthProvider>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
