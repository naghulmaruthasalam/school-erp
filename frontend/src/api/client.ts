import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { authStore } from "../auth/store";
import { getDemoResponse } from "./demoData";
import { getDemoSyllabusResponse, postDemoResponse } from "./demoSyllabus";
import { getDemoCopilotToolsResponse, mutateDemoCopilotTools } from "./demoCopilotTools";

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

export const api = axios.create({ baseURL: apiBaseUrl });

api.interceptors.request.use((config) => {
  const { accessToken, isDemo } = authStore.getState();

  if (isDemo && (config.method === "post" || config.method === "patch" || config.method === "delete")) {
    const created = mutateDemoCopilotTools(config.method, config.url || "", config.data) ?? (config.method === "post" ? postDemoResponse(config.url || "", config.data) : null);
    if (created) return Promise.reject({ __isDemo: true, data: created, config });
  }
  if (isDemo && config.method === "get") {
    const demoData = getDemoCopilotToolsResponse(config.url || "", config.params) ?? getDemoSyllabusResponse(config.url || "", config.params) ?? getDemoResponse(config.url || "");
    if (demoData) {
      return Promise.reject({ __isDemo: true, data: demoData, config });
    }
  }

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = authStore.getState().refreshToken;
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post(`${apiBaseUrl}/auth/refresh`, {
      refresh_token: refreshToken,
    });
    authStore.setState({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      isAuthenticated: true,
    });
    return data.access_token as string;
  } catch {
    authStore.setState({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
    });
    return null;
  }
}

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError & { __isDemo?: boolean; data?: unknown }) => {
    if (error.__isDemo) {
      return { data: error.data, status: 200, statusText: "OK", headers: {}, config: error.config };
    }

    // FastAPI returns validation errors (422) as an array of objects; every form renders
    // `detail` directly as text, so flatten it to a readable string here.
    const data = error.response?.data as { detail?: unknown } | undefined;
    if (data && Array.isArray(data.detail)) {
      data.detail = data.detail
        .map((d: { loc?: unknown[]; msg?: string }) => {
          const field = Array.isArray(d?.loc) ? d.loc.filter((p) => p !== "body").join(".") : "";
          return field ? `${field}: ${d?.msg ?? "invalid"}` : (d?.msg ?? "invalid");
        })
        .join("; ");
    }

    // Surface the server's explanation (instead of "Request failed with status code 4xx") to
    // forms that display `err.message`.
    if (typeof data?.detail === "string" && data.detail && error.response && error.response.status !== 401) {
      error.message = data.detail;
    }

    const config = error.config as RetriableConfig | undefined;
    if (error.response?.status === 401 && config && !config._retried && !config.url?.includes("/auth/")) {
      config._retried = true;
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      const newToken = await refreshPromise;
      if (newToken) {
        config.headers.Authorization = `Bearer ${newToken}`;
        return api(config);
      }
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);
