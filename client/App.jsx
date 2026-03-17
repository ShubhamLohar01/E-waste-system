import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";

import SmallUserDashboard from "./pages/dashboards/SmallUserDashboard";
import LocalCollectorDashboard from "./pages/dashboards/LocalCollectorDashboard";
import HubDashboard from "./pages/dashboards/HubDashboard";
import DeliveryWorkerDashboard from "./pages/dashboards/DeliveryWorkerDashboard";
import RecyclerDashboard from "./pages/dashboards/RecyclerDashboard";
import BulkGeneratorDashboard from "./pages/dashboards/BulkGeneratorDashboard";
import AdminDashboard from "./pages/dashboards/AdminDashboard";
import RewardWallet from "./pages/RewardWallet";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />

              {/* Auth Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Dashboard Routes - Protected */}
              <Route
                path="/dashboard/small-user"
                element={
                  <ProtectedRoute requiredRole="small_user">
                    <SmallUserDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/collector"
                element={
                  <ProtectedRoute requiredRole="local_collector">
                    <LocalCollectorDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/hub"
                element={
                  <ProtectedRoute requiredRole="hub">
                    <HubDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/delivery"
                element={
                  <ProtectedRoute requiredRole="delivery_worker">
                    <DeliveryWorkerDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/recycler"
                element={
                  <ProtectedRoute requiredRole="recycler">
                    <RecyclerDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/bulk-generator"
                element={
                  <ProtectedRoute requiredRole="bulk_generator">
                    <BulkGeneratorDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/admin"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Reward Wallet */}
              <Route
                path="/reward"
                element={
                  <ProtectedRoute requiredRole="small_user">
                    <RewardWallet />
                  </ProtectedRoute>
                }
              />

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
