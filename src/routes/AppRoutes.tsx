import type { Dispatch, SetStateAction } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { LandingPage } from "../components/LandingPage";
import { Dashboard } from "../components/Dashboard";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { DASHBOARD_PATHS } from "../lib/dashboardRoutes";
import { AUTH_CALLBACK_PATH } from "../lib/authRoutes";
import { OAuthCallback } from "../components/OAuthCallback";

export interface AppRoutesProps {
  apiBase: string;
  token: string | null;
  currentUser: any;
  onLoginSuccess: (token: string, user: any) => void;
  onLogout: () => void;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  setCurrentUser: Dispatch<SetStateAction<any>>;
}

export function AppRoutes({
  apiBase,
  token,
  currentUser,
  onLoginSuccess,
  onLogout,
  showToast,
  setCurrentUser,
}: AppRoutesProps) {
  const isAuthenticated = Boolean(token && currentUser);

  const dashboardElement = (
    <Dashboard
      token={token!}
      currentUser={currentUser}
      setCurrentUser={setCurrentUser}
      apiBase={apiBase}
      onLogout={onLogout}
      showToast={showToast}
    />
  );

  return (
    <Routes>
      <Route
        path="/"
        element={
          isAuthenticated ? (
            <Navigate to={DASHBOARD_PATHS.home} replace />
          ) : (
            <LandingPage
              apiBase={apiBase}
              onLoginSuccess={onLoginSuccess}
              showToast={showToast}
            />
          )
        }
      />

      <Route path={AUTH_CALLBACK_PATH} element={<OAuthCallback />} />

      <Route element={<ProtectedRoute isAuthenticated={isAuthenticated} />}>
        <Route path="/dashboard/*" element={dashboardElement} />
        <Route
          path="/dashboard.html"
          element={<Navigate to={DASHBOARD_PATHS.home} replace />}
        />
      </Route>

      <Route
        path="*"
        element={
          <Navigate to={isAuthenticated ? DASHBOARD_PATHS.home : "/"} replace />
        }
      />
    </Routes>
  );
}
