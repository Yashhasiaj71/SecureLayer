import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  withCredentials: true, // For HTTP-only refresh cookies
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  }
});

// Response interceptor to handle token refresh logic globally (optional if using strict context)
// For MVP, we simply return the response or error

export default api;
