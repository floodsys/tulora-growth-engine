import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/contexts/AuthContext";
import App from "./App.tsx";
import "./index.css";
import { initializeSentry, captureDeployment } from "./lib/sentry";

// Initialize Sentry with release tracking (gated by environment variables)
initializeSentry();

// Capture deployment event for tracking
captureDeployment();

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </StrictMode>
);
