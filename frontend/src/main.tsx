import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import App from "./App.tsx";
import { ThemeProvider } from "./theme/ThemeContext.tsx";
import { LanguageProvider } from "./i18n/LanguageContext.tsx";
import "./api/client";
import "./index.css";

// A static, backend-less build (VITE_STANDALONE_DEMO=true) is hosted from a sub-path, so it routes by hash.
const Router = import.meta.env.VITE_STANDALONE_DEMO ? HashRouter : BrowserRouter;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <ThemeProvider>
          <Router>
            <App />
          </Router>
        </ThemeProvider>
      </LanguageProvider>
    </QueryClientProvider>
  </StrictMode>,
);
