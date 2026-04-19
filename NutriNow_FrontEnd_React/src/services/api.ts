import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
});

// Interceptor para adicionar o token JWT em cada requisição
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('nutrinow_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
