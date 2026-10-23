import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Public tunnel URL for backend when running Expo on phone / hotspot
const TUNNEL_URL = 'https://freely-river-orlando-amplifier.trycloudflare.com';
const CURRENT_LAN_URL = 'http://192.0.0.2:8000';

const getCandidateUrls = () => {
  const list = [];

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.hostname && window.location.hostname !== 'localhost') {
      list.push(`http://${window.location.hostname}:8000`);
    }
    list.push('http://localhost:8000');
    return list;
  }

  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.debuggerHost || Constants.manifest2?.extra?.expoGo?.developer?.tool;
  
  // If running via Expo tunnel
  if (TUNNEL_URL) {
    list.push(TUNNEL_URL);
  }

  // If host IP is available from Expo Metro bundler
  if (hostUri) {
    const hostIp = hostUri.split(':')[0];
    if (hostIp && hostIp !== 'localhost' && hostIp !== '127.0.0.1' && !hostIp.includes('exp.direct')) {
      const expoLanUrl = `http://${hostIp}:8000`;
      if (!list.includes(expoLanUrl)) list.push(expoLanUrl);
    }
  }

  // Mac's current Wi-Fi LAN IP
  if (!list.includes(CURRENT_LAN_URL)) {
    list.push(CURRENT_LAN_URL);
  }

  if (Platform.OS === 'android') {
    list.push('http://10.0.2.2:8000');
  }

  list.push('http://localhost:8000');
  return list;
};

const candidateUrls = getCandidateUrls();
let activeBaseUrl = candidateUrls[0] || 'http://localhost:8000';

console.log('[NutriTrack API Client] Initial Candidate URLs:', candidateUrls);
console.log('[NutriTrack API Client] Active Target Backend URL:', activeBaseUrl);

const apiClient = axios.create({
  baseURL: activeBaseUrl,
  timeout: 10000,
  headers: {
    'Bypass-Tunnel-Reminder': 'true',
  },
});

apiClient.interceptors.request.use(
  async (config) => {
    config.baseURL = activeBaseUrl;
    config.headers['Bypass-Tunnel-Reminder'] = 'true';
    const token = await AsyncStorage.getItem('userToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

let unauthorizedHandler = null;

export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = handler;
};

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const config = error.config;

    // Auto-failover to next candidate backend URL if network error or timeout occurs
    const isNetworkError = !error.response && (error.code === 'ERR_NETWORK' || error.message === 'Network Error' || error.code === 'ECONNABORTED');
    if (isNetworkError && config && (!config._retryCount || config._retryCount < candidateUrls.length)) {
      config._retryCount = (config._retryCount || 0) + 1;
      const nextIndex = config._retryCount % candidateUrls.length;
      const nextUrl = candidateUrls[nextIndex];

      console.warn(`[NutriTrack API Client] Network failed for ${activeBaseUrl}. Switching to candidate ${nextIndex + 1}/${candidateUrls.length}: ${nextUrl}`);
      activeBaseUrl = nextUrl;
      config.baseURL = nextUrl;

      // Retry request with next candidate URL
      return apiClient(config);
    }

    if (error.response && error.response.status === 401) {
      await AsyncStorage.removeItem('userToken');
      if (typeof unauthorizedHandler === 'function') {
        unauthorizedHandler();
      }
    }
    return Promise.reject(error);
  }
);

export const formatApiError = (err, fallbackMessage = 'An unexpected error occurred.') => {
  if (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error') {
    return 'Cannot connect to backend server. Make sure the FastAPI server is running on port 8000 (uvicorn app.main:app --reload).';
  }
  if (err?.response?.status === 401 || err?.response?.data?.detail === 'Not authenticated' || err?.response?.data?.detail === 'Could not validate credentials') {
    return 'Your session has expired or you are not logged in. Please log in again.';
  }
  if (err?.response?.data?.detail) {
    const detail = err.response.data.detail;
    if (typeof detail === 'string') {
      return detail;
    }
    if (Array.isArray(detail)) {
      return detail.map(d => (typeof d === 'string' ? d : d.msg || JSON.stringify(d))).join(', ');
    }
    if (typeof detail === 'object') {
      return detail.msg || JSON.stringify(detail);
    }
  }
  if (err?.message) {
    return err.message;
  }
  return fallbackMessage;
};

export default apiClient;

