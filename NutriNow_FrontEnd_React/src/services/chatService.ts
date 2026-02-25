import api from './api';

export interface ChatResponse {
  success: boolean;
  session_id?: string;
  response?: string;
  error?: string;
}

export const chatService = {
  setSessionId: (sid: string) => {
    localStorage.setItem('nutrinow_session_id', sid);
  },

  getSessionId: () => {
    return localStorage.getItem('nutrinow_session_id');
  },

  sendMessage: async (message: string) => {
    const session_id = chatService.getSessionId();
    const headers: any = {};
    if (session_id) headers['X-Session-ID'] = session_id;

    const response = await api.post<ChatResponse>(
      '/chat',
      { message },
      { headers }
    );
    return response.data;
  },

  getChatHistory: async () => {
    const session_id = chatService.getSessionId();
    const params: any = {};
    if (session_id) params['session_id'] = session_id;

    const response = await api.get('/chat_history', { params });
    return response.data;
  },

  analyzeImage: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/analyze_image', formData);
    return response.data;
  }
};
