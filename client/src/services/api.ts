import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';

type RetryRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

export const api = axios.create({
  baseURL: '/api/v1',
});

const showGlobalToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type } }));
};

const clearSessionWithNotification = (message: string) => {
  const authState = useAuthStore.getState();
  const hadSession = Boolean(authState.accessToken || authState.refreshToken);

  authState.clearSession();

  if (hadSession) {
    showGlobalToast(message, 'error');
  }
};

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryRequestConfig | undefined;

    if (!originalRequest || error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    const authState = useAuthStore.getState();
    const serverCode = (error.response?.data as { error?: { code?: string } } | undefined)?.error?.code;
    const sessionExpiredMessage =
      serverCode === 'TOKEN_EXPIRED'
        ? 'Сессия истекла. Войдите снова'
        : 'Сессия недействительна. Войдите снова';

    if (!authState.refreshToken) {
      clearSessionWithNotification(sessionExpiredMessage);
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const refreshResponse = await axios.post('/api/v1/auth/refresh', {
        refreshToken: authState.refreshToken,
      });

      const newAccessToken: string | undefined = refreshResponse.data?.data?.accessToken;

      if (!newAccessToken) {
        clearSessionWithNotification('Сессия истекла. Войдите снова');
        return Promise.reject(error);
      }

      authState.setAccessToken(newAccessToken);
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      clearSessionWithNotification('Сессия истекла. Войдите снова');
      return Promise.reject(refreshError);
    }
  }
);
