import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { authStore } from "./auth-store";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(authStore.getState());

  useEffect(() => {
    return authStore.subscribe(setState);
  }, []);

  if (!state.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
