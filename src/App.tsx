/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReactNode, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import PhoneWrapper from './components/PhoneWrapper';
import SplashScreen from './screens/SplashScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import LoginScreen from './screens/LoginScreen';
import EcosystemHome from './screens/EcosystemHome';
import VideoFeed from './screens/VideoFeed';
import MarketHome from './screens/MarketHome';
import WalletDashboard from './screens/WalletDashboard';
import ChatRoom from './screens/ChatRoom';
import ScannerScreen from './screens/ScannerScreen';
import ProfileScreen from './screens/ProfileScreen';
import { useFirebaseAuth } from './hooks/useFirebaseAuth';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useFirebaseAuth();

  if (loading) {
    return <SplashScreen autoNavigate={false} showAction={false} />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const [isBooting, setIsBooting] = useState(window.location.pathname !== '/');

  useEffect(() => {
    if (!isBooting) return;
    const timer = window.setTimeout(() => setIsBooting(false), 1600);
    return () => window.clearTimeout(timer);
  }, [isBooting]);

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
        <Route path="/ecosystem" element={<RequireAuth><EcosystemHome /></RequireAuth>} />
        <Route path="/feed" element={<RequireAuth><VideoFeed /></RequireAuth>} />
        <Route path="/market" element={<RequireAuth><MarketHome /></RequireAuth>} />
        <Route path="/wallet" element={<RequireAuth><WalletDashboard /></RequireAuth>} />
        <Route path="/chat" element={<RequireAuth><ChatRoom /></RequireAuth>} />
        <Route path="/scan" element={<RequireAuth><ScannerScreen /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><ProfileScreen /></RequireAuth>} />
      </Routes>
    </PhoneWrapper>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
