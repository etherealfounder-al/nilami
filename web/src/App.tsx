import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { loadSession } from "./lib/session";
import { LoginPage } from "./routes/Login";
import { PendingPage } from "./routes/Pending";
import { Panel } from "./routes/Panel";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The panel is a working tool: data that changed in another tab, or by
      // another member of staff, should appear without a manual reload.
      staleTime: 15_000,
      retry: (count, error) =>
        // Retrying an authentication failure only delays the login screen.
        error instanceof Error && error.name === "ApiError" ? false : count < 2,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/admin">
        <Gate />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

/**
 * One query decides which of the three screens the whole app is on.
 *
 * It is a query rather than state so that signing in or out invalidates it and
 * every route re-reads the answer, instead of each page deciding for itself
 * and disagreeing.
 */
function Gate() {
  const { data, isPending, error } = useQuery({
    queryKey: ["session"],
    queryFn: loadSession,
    staleTime: 30_000,
  });

  if (isPending) return <Splash />;
  if (error) return <Splash message="The server could not be reached." />;

  return (
    <Routes>
      <Route
        path="/login"
        element={
          data.status === "active" ? <Navigate to="/" replace /> : <LoginPage />
        }
      />
      <Route
        path="/*"
        element={
          data.status === "anonymous" ? (
            <Navigate to="/login" replace />
          ) : data.status === "pending" ? (
            <PendingPage />
          ) : (
            <Panel viewer={data.viewer} />
          )
        }
      />
    </Routes>
  );
}

function Splash({ message }: { message?: string }) {
  return (
    <main class="grid min-h-dvh place-items-center bg-evergreen-950 px-5">
      <p class="text-sm text-ivory/60">{message ?? "Loading…"}</p>
    </main>
  );
}
