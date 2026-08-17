import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// ── Public storefront components ──────────────────────────────────────────
import TopBar from './components/TopBar';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import CategorySection from './components/CategorySection';
import WhyLeedsSection from './components/WhyLeedsSection';
import BestSellersSection from './components/BestSellersSection';
import AuthenticityBanner from './components/AuthenticityBanner';
import FocusBanner from './components/FocusBanner';
import TestimonialsSection from './components/TestimonialsSection';
import Footer from './components/Footer';


// ── Public pages ──────────────────────────────────────────────────────────
import CollectionPage from './pages/CollectionPage';
import BestSellersPage from './pages/BestSellersPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ProductDetailsPage from './pages/ProductDetailsPage';

// ── Admin ─────────────────────────────────────────────────────────────────
import AdminLoginPage from './pages/admin/AdminLoginPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import ProtectedAdminRoute from './components/ProtectedAdminRoute';

// ─── Storefront Home ──────────────────────────────────────────────────────
const StoreFront = () => (
  <div className="min-h-screen">
    <TopBar />
    <Navbar />
    <main>
      <HeroSection />
      <CategorySection />
      <WhyLeedsSection />
      <BestSellersSection />
      <AuthenticityBanner />
      <FocusBanner />
      <TestimonialsSection />
    </main>
    <Footer />
  </div>
);

// ─── App ──────────────────────────────────────────────────────────────────
const App = () => (
  <BrowserRouter>
    <Routes>
      {/* Public storefront */}
      <Route path="/" element={<StoreFront />} />
      <Route path="/collection" element={<CollectionPage />} />
      <Route path="/best-sellers" element={<BestSellersPage />} />
      <Route path="/product/:id" element={<ProductDetailsPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* Admin login — publicly accessible */}
      <Route path="/admin/login" element={<AdminLoginPage />} />

      {/* Protected admin area */}
      <Route element={<ProtectedAdminRoute />}>
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        {/* Add more /admin/* routes here — all auto-protected */}
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
);

export default App;
