import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getBaseUrl = () => {
  // If running in Web browser
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      return `http://${window.location.hostname}:8000`;
    }
    return 'http://localhost:8000';
  }

  // Dynamically extract host IP from Expo Metro bundler when running via Expo Go / LAN
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.debuggerHost || Constants.manifest2?.extra?.expoGo?.developer?.tool;
  if (hostUri) {
    const hostIp = hostUri.split(':')[0];
    if (hostIp && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
      return `http://${hostIp}:8000`;
    }
  }
  
  // Fallbacks
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000'; // Android Emulator
  }
  
  // Default for iOS / Local Dev
  return 'http://localhost:8000';
};

const apiClient = axios.create({
  baseURL: getBaseUrl(),
  timeout: 10000, // 10s timeout to prevent hanging forever
});

apiClient.interceptors.request.use(
  async (config) => {
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

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      await AsyncStorage.removeItem('userToken');
    }
    return Promise.reject(error);
  }
);

export const formatApiError = (err, fallbackMessage = 'An unexpected error occurred.') => {
  if (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error') {
    return 'Cannot connect to backend server. Make sure the FastAPI server is running on port 8000 (uvicorn app.main:app --reload).';
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

