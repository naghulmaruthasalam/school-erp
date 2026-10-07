import { api } from "../api/client";
import type { TokenResponse, User } from "../types/auth";

export async function loginRequest(
  username: string,
  password: string,
  schoolCode?: string,
): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>("/auth/login", {
    username,
    password,
    school_code: schoolCode || null,
  });
  return data;
}

export async function demoLoginRequest(role: string): Promise<TokenResponse> {
  // Standalone demo builds have no API: hand out a placeholder session (all reads are served from demoData).
  if (import.meta.env.VITE_STANDALONE_DEMO) {
    return { access_token: `demo-${role}`, refresh_token: `demo-${role}`, token_type: "bearer" } as TokenResponse;
  }
  const { data } = await api.post<TokenResponse>("/auth/demo-login", { role });
  return data;
}

export async function fetchMe(): Promise<User> {
  const { data } = await api.get<User>("/auth/me");
  return data;
}

export async function changePasswordRequest(currentPassword: string, newPassword: string): Promise<void> {
  await api.post("/auth/change-password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

export async function forgotPasswordRequest(username: string, schoolCode?: string): Promise<{ message: string; needs_admin?: boolean }> {
  const { data } = await api.post("/auth/forgot-password", { username, school_code: schoolCode || null });
  return data;
}

export async function resetPasswordRequest(token: string, newPassword: string): Promise<void> {
  await api.post("/auth/reset-password", { token, new_password: newPassword });
}

export interface RegisterSchoolRequest {
  name: string;
  code?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  phone?: string;
  email?: string;
  admin_full_name: string;
  admin_email: string;
  admin_phone?: string;
  admin_password: string;
  admin_confirm_password: string;
}

export interface RegisterSchoolResponse {
  school: { id: string; name: string; code: string };
  admin_user_id: string;
  admin_email: string;
}

export async function registerSchoolRequest(payload: RegisterSchoolRequest): Promise<RegisterSchoolResponse> {
  const { data } = await api.post<RegisterSchoolResponse>("/schools/register", payload);
  return data;
}
