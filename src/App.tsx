/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
        <Route path="/ecosystem" element={<EcosystemHome />} />
        <Route path="/feed" element={<VideoFeed />} />
        <Route path="/market" element={<MarketHome />} />
        <Route path="/wallet" element={<WalletDashboard />} />
        <Route path="/chat" element={<ChatRoom />} />
        <Route path="/scan" element={<ScannerScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
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
