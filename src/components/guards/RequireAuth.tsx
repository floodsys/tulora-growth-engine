/**
 * RequireAuth guard – redirects unauthenticated users to /auth.
 * Used to gate routes that must not be accessible without a session.
 */
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function RequireAuth({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        // While auth state is resolving, render nothing to avoid flicker
        return null;
    }

    if (!user) {
        // Redirect to /auth, preserving the intended destination
        return <Navigate to="/auth" state={{ from: location }} replace />;
    }

    return <>{children}</>;
}
