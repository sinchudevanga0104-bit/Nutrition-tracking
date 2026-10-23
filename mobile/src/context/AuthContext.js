import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient, { setUnauthorizedHandler } from '../api/client';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [userToken, setUserToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const login = async (token) => {
    setUserToken(token);
    await AsyncStorage.setItem('userToken', token);
  };

  const logout = async () => {
    setUserToken(null);
    await AsyncStorage.removeItem('userToken');
  };

  const checkToken = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        // Validate token with backend to avoid stale/expired sessions
        try {
          const res = await apiClient.get('/auth/profile', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.data) {
            setUserToken(token);
          } else {
            await logout();
          }
        } catch (authErr) {
          if (authErr.response?.status === 401) {
            console.log('[AuthContext] Stored token is invalid or expired. Resetting session.');
            await logout();
          } else {
            // Keep token in case backend is briefly unavailable / offline
            setUserToken(token);
          }
        }
      }
    } catch (e) {
      console.log('Error checking token', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
    });
    checkToken();
  }, []);

  return (
    <AuthContext.Provider value={{ login, logout, userToken, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};
