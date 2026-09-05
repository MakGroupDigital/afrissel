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
import IdentitySetupScreen from './screens/IdentitySetupScreen';
import EcosystemHome from './screens/EcosystemHome';
import AppsDirectoryScreen from './screens/AppsDirectoryScreen';
import SafariServicesScreen from './screens/SafariServicesScreen';
import ModuleSuiteScreen, { ModuleActionScreen } from './screens/ModuleSuiteScreen';
import VideoFeed from './screens/VideoFeed';
import CreateHubScreen from './screens/CreateHubScreen';
import CreatePostScreen from './screens/CreatePostScreen';
import AfriAiTalkScreen from './screens/AfriAiTalkScreen';
import QuickActionOffersScreen from './screens/QuickActionOffersScreen';
import ZandofyMarketplaceScreen, { ZandofyAboutScreen, ZandofyAffiliationScreen, ZandofyClientsScreen, ZandofyCreateProductScreen, ZandofyCreateStoreScreen, ZandofyDashboardScreen, ZandofyDomainScreen, ZandofyEditProductScreen, ZandofyProductsScreen, ZandofyPromosScreen, ZandofyPublicStoreScreen, ZandofyStatsScreen, ZikMartMarketplaceScreen } from './screens/ZandofyMarketplaceScreen';
import PromotionsScreen from './screens/PromotionsScreen';
import MarketHome from './screens/MarketHome';
import ProductDetailScreen from './screens/ProductDetailScreen';
import MarketOrdersScreen from './screens/MarketOrdersScreen';
import OrderVerificationScreen from './screens/OrderVerificationScreen';
import DigitalAccessScreen from './screens/DigitalAccessScreen';
import SellerStandScreen from './screens/SellerStandScreen';
import WalletDashboard from './screens/WalletDashboard';
import KycVerificationScreen from './screens/KycVerificationScreen';
import ChatRoom from './screens/ChatRoom';
import ScannerScreen from './screens/ScannerScreen';
import ProfileScreen from './screens/ProfileScreen';
import ProfileContentManagerScreen from './screens/ProfileContentManagerScreen';
import PublicProfileScreen from './screens/PublicProfileScreen';
import BusinessDashboardScreen from './screens/BusinessDashboardScreen';
import { useFirebaseAuth } from './hooks/useFirebaseAuth';
import { realtimeDb } from './lib/firebase';
import { flushOfflineQueue } from './lib/offlineCache';

function OfflineQueueSync() {
  useEffect(() => {
    const sync = () => {
      void flushOfflineQueue(realtimeDb).catch((error) => {
        console.error('Synchronisation offline AfriZia impossible:', error);
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
  children,
  allowAnonymous = false
}: {
  children: ReactNode;
  requireCompletedProfile?: boolean;
  allowAnonymous?: boolean;
}) {
  const { user, loading } = useFirebaseAuth();
  const location = useLocation();

  if (loading) {
    return <SplashScreen autoNavigate={false} showAction={false} />;
  }

  if (!user || (!allowAnonymous && user.isAnonymous)) {
    return <Navigate to="/login" replace state={{ next: location.pathname + location.search }} />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const location = useLocation();
  const { user, profile, loading } = useFirebaseAuth();
  const [isBooting, setIsBooting] = useState(window.location.pathname !== '/');
  const isPublicCommercePath = /^\/market\/[^/]+$/.test(location.pathname)
    || /^\/zandofy\/[^/]+(?:\/product\/[^/]+)?$/.test(location.pathname)
    || /^\/order\/[^/]+$/.test(location.pathname)
    || /^\/zandofy\/access\/[^/]+$/.test(location.pathname)
    || location.pathname === '/zikmart'
    || (user?.isAnonymous && location.pathname === '/market/orders');
  const hasSeenOnboarding = window.localStorage.getItem('afrisell:onboarding-seen') === '1';
  const currentHost = window.location.hostname.toLowerCase().replace(/^www\./, '');
  const isCustomStoreDomain = Boolean(
    currentHost &&
    currentHost !== 'localhost' &&
    currentHost !== '127.0.0.1' &&
    currentHost !== 'afri.afrisell.app' &&
    !currentHost.endsWith('.vercel.app') &&
    !currentHost.endsWith('.localhost')
  );

  useEffect(() => {
    if (!isBooting) return;
    const timer = window.setTimeout(() => setIsBooting(false), 1600);
    return () => window.clearTimeout(timer);
  }, [isBooting]);

  if (!isCustomStoreDomain && !hasSeenOnboarding && !isPublicCommercePath && !['/', '/onboarding', '/login', '/identity-setup'].includes(location.pathname)) {
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

  if (
    !isCustomStoreDomain &&
    !loading &&
    user &&
    !user.isAnonymous &&
    profile?.demographicsSetupRequired &&
    !profile.demographicsSetupCompleted &&
    location.pathname !== '/identity-setup'
  ) {
    return (
      <PhoneWrapper>
        <Navigate to="/identity-setup" replace state={{ next: location.pathname + location.search }} />
      </PhoneWrapper>
    );
  }

  return (
    <PhoneWrapper>
      <Routes>
        <Route path="/" element={isCustomStoreDomain ? <ZandofyPublicStoreScreen /> : <SplashScreen />} />
        <Route path="/onboarding" element={<OnboardingScreen />} />
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/identity-setup" element={<RequireAuth><IdentitySetupScreen /></RequireAuth>} />
        <Route path="/account-setup" element={<RequireAuth requireCompletedProfile={false}><AccountSetupScreen /></RequireAuth>} />
        <Route path="/ecosystem" element={<EcosystemHome />} />
        <Route path="/offers/:sectionId" element={<QuickActionOffersScreen />} />
        <Route path="/zandofy" element={<ZandofyMarketplaceScreen />} />
        <Route path="/zikmart" element={<ZikMartMarketplaceScreen />} />
        <Route path="/zandofy/create" element={<RequireAuth><ZandofyCreateStoreScreen /></RequireAuth>} />
        <Route path="/zandofy/dashboard" element={<RequireAuth><ZandofyDashboardScreen /></RequireAuth>} />
        <Route path="/zandofy/domain" element={<RequireAuth><ZandofyDomainScreen /></RequireAuth>} />
        <Route path="/zandofy/promos" element={<RequireAuth><ZandofyPromosScreen /></RequireAuth>} />
        <Route path="/zandofy/affiliation" element={<RequireAuth><ZandofyAffiliationScreen /></RequireAuth>} />
        <Route path="/zandofy/about" element={<ZandofyAboutScreen />} />
        <Route path="/zandofy/stats" element={<RequireAuth><ZandofyStatsScreen /></RequireAuth>} />
        <Route path="/zandofy/clients" element={<RequireAuth><ZandofyClientsScreen /></RequireAuth>} />
        <Route path="/zandofy/products" element={<RequireAuth><ZandofyProductsScreen /></RequireAuth>} />
        <Route path="/zandofy/products/new" element={<RequireAuth><ZandofyCreateProductScreen /></RequireAuth>} />
        <Route path="/zandofy/products/:productId/edit" element={<RequireAuth><ZandofyEditProductScreen /></RequireAuth>} />
        <Route path="/zandofy/product/:productId" element={<ProductDetailScreen />} />
        <Route path="/zandofy/:slug/product/:productId" element={<ProductDetailScreen />} />
        <Route path="/zandofy/:slug" element={<ZandofyPublicStoreScreen />} />
        <Route path="/promos" element={<PromotionsScreen />} />
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
        <Route path="/afriai/talk" element={<RequireAuth><AfriAiTalkScreen /></RequireAuth>} />
        <Route path="/afriai" element={<ModuleSuiteScreen moduleId="afriai" />} />
        <Route path="/afriai/:actionId" element={<ModuleActionScreen moduleId="afriai" />} />
        <Route path="/fpp" element={<ModuleSuiteScreen moduleId="fpp" />} />
        <Route path="/fpp/:actionId" element={<ModuleActionScreen moduleId="fpp" />} />
        <Route path="/feed" element={<VideoFeed />} />
        <Route path="/create/hub" element={<RequireAuth><CreateHubScreen /></RequireAuth>} />
        <Route path="/create" element={<RequireAuth><CreatePostScreen /></RequireAuth>} />
        <Route path="/market" element={<MarketHome />} />
        <Route path="/market/orders" element={<MarketOrdersScreen />} />
        <Route path="/order/:orderId" element={<OrderVerificationScreen />} />
        <Route path="/zandofy/access/:orderId" element={<RequireAuth allowAnonymous><DigitalAccessScreen /></RequireAuth>} />
        <Route path="/market/stand/:sellerId" element={<SellerStandScreen />} />
        <Route path="/market/:productId" element={<ProductDetailScreen />} />
        <Route path="/wallet" element={<RequireAuth><WalletDashboard /></RequireAuth>} />
        <Route path="/kyc" element={<RequireAuth><KycVerificationScreen /></RequireAuth>} />
        <Route path="/chat" element={<RequireAuth><ChatRoom /></RequireAuth>} />
        <Route path="/scan" element={<RequireAuth><ScannerScreen /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><ProfileScreen /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><ProfileScreen /></RequireAuth>} />
        <Route path="/profile/contents" element={<RequireAuth><ProfileContentManagerScreen kind="contents" /></RequireAuth>} />
        <Route path="/profile/storefronts" element={<RequireAuth><ProfileContentManagerScreen kind="storefronts" /></RequireAuth>} />
        <Route path="/u/:userId" element={<PublicProfileScreen />} />
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
