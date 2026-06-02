/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReactNode, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom';
import PhoneWrapper from './components/PhoneWrapper';
import SplashScreen from './screens/SplashScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import LoginScreen from './screens/LoginScreen';
import AccountSetupScreen from './screens/AccountSetupScreen';
import EcosystemHome from './screens/EcosystemHome';
import AppsDirectoryScreen from './screens/AppsDirectoryScreen';
import SafariServicesScreen from './screens/SafariServicesScreen';
import ModuleSuiteScreen, { ModuleActionScreen } from './screens/ModuleSuiteScreen';
import VideoFeed from './screens/VideoFeed';
import MarketHome from './screens/MarketHome';
import ProductDetailScreen from './screens/ProductDetailScreen';
import MarketOrdersScreen from './screens/MarketOrdersScreen';
import SellerStandScreen from './screens/SellerStandScreen';
import WalletDashboard from './screens/WalletDashboard';
import ChatRoom from './screens/ChatRoom';
import ScannerScreen from './screens/ScannerScreen';
import ProfileScreen from './screens/ProfileScreen';
import BusinessDashboardScreen from './screens/BusinessDashboardScreen';
import { useFirebaseAuth } from './hooks/useFirebaseAuth';
import { realtimeDb } from './lib/firebase';
import { flushOfflineQueue } from './lib/offlineCache';

function OfflineQueueSync() {
  useEffect(() => {
    const sync = () => {
      void flushOfflineQueue(realtimeDb).catch((error) => {
        console.error('Synchronisation offline AfriSell impossible:', error);
      });
    };

    sync();
    window.addEventListener('online', sync);
    const timer = window.setInterval(sync, 30000);

    return () => {
      window.removeEventListener('online', sync);
      window.clearInterval(timer);
    };
  }, []);

  return null;
}

function RequireAuth({
  children
}: {
  children: ReactNode;
  requireCompletedProfile?: boolean;
}) {
  const { user, loading } = useFirebaseAuth();
  const location = useLocation();

  if (loading) {
    return <SplashScreen autoNavigate={false} showAction={false} />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ next: location.pathname + location.search }} />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const location = useLocation();
  const [isBooting, setIsBooting] = useState(window.location.pathname !== '/');
  const hasSeenOnboarding = window.localStorage.getItem('afrisell:onboarding-seen') === '1';

  useEffect(() => {
    if (!isBooting) return;
    const timer = window.setTimeout(() => setIsBooting(false), 1600);
    return () => window.clearTimeout(timer);
  }, [isBooting]);

  if (!hasSeenOnboarding && !['/', '/onboarding', '/login'].includes(location.pathname)) {
    return (
      <PhoneWrapper>
        <Navigate to="/onboarding" replace />
      </PhoneWrapper>
    );
  }

  if (isBooting) {
    return (
      <PhoneWrapper>
        <SplashScreen autoNavigate={false} showAction={false} />
      </PhoneWrapper>
    );
  }

  return (
    <PhoneWrapper>
      <Routes>
        <Route path="/" element={<SplashScreen />} />
        <Route path="/onboarding" element={<OnboardingScreen />} />
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/account-setup" element={<RequireAuth requireCompletedProfile={false}><AccountSetupScreen /></RequireAuth>} />
        <Route path="/ecosystem" element={<EcosystemHome />} />
        <Route path="/apps" element={<AppsDirectoryScreen />} />
        <Route path="/safari" element={<SafariServicesScreen />} />
        <Route path="/safari/:serviceId" element={<SafariServicesScreen />} />
        <Route path="/school" element={<ModuleSuiteScreen moduleId="school" />} />
        <Route path="/school/:actionId" element={<ModuleActionScreen moduleId="school" />} />
        <Route path="/med" element={<ModuleSuiteScreen moduleId="med" />} />
        <Route path="/med/:actionId" element={<ModuleActionScreen moduleId="med" />} />
        <Route path="/freelance" element={<ModuleSuiteScreen moduleId="freelance" />} />
        <Route path="/freelance/:actionId" element={<ModuleActionScreen moduleId="freelance" />} />
        <Route path="/biashara" element={<ModuleSuiteScreen moduleId="biashara" />} />
        <Route path="/biashara/:actionId" element={<ModuleActionScreen moduleId="biashara" />} />
        <Route path="/afriai" element={<ModuleSuiteScreen moduleId="afriai" />} />
        <Route path="/afriai/:actionId" element={<ModuleActionScreen moduleId="afriai" />} />
        <Route path="/fpp" element={<ModuleSuiteScreen moduleId="fpp" />} />
        <Route path="/fpp/:actionId" element={<ModuleActionScreen moduleId="fpp" />} />
        <Route path="/feed" element={<VideoFeed />} />
        <Route path="/market" element={<MarketHome />} />
        <Route path="/market/orders" element={<MarketOrdersScreen />} />
        <Route path="/market/stand/:sellerId" element={<SellerStandScreen />} />
        <Route path="/market/:productId" element={<ProductDetailScreen />} />
        <Route path="/wallet" element={<RequireAuth><WalletDashboard /></RequireAuth>} />
        <Route path="/chat" element={<RequireAuth><ChatRoom /></RequireAuth>} />
        <Route path="/scan" element={<RequireAuth><ScannerScreen /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><ProfileScreen /></RequireAuth>} />
        <Route path="/business" element={<RequireAuth><BusinessDashboardScreen /></RequireAuth>} />
      </Routes>
    </PhoneWrapper>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <OfflineQueueSync />
      <AppRoutes />
    </BrowserRouter>
  );
}
