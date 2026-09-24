import React, { createContext, useState, useEffect, useContext } from 'react';
import apiClient from '../api/client';
import { AuthContext } from './AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ChildContext = createContext();

export const ChildProvider = ({ children }) => {
  const { userToken } = useContext(AuthContext);
  const [childrenList, setChildrenList] = useState([]);
  const [activeChild, setActiveChild] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchChildren = async () => {
    if (!userToken) return;
    try {
      setIsLoading(true);
      const response = await apiClient.get('/children/');
      setChildrenList(response.data);
      
      // Auto-select a child if none is active
      const savedChildId = await AsyncStorage.getItem('activeChildId');
      if (savedChildId) {
        const found = response.data.find(c => c.child_id.toString() === savedChildId);
        if (found) setActiveChild(found);
      } else if (response.data.length > 0) {
        setActiveChild(response.data[0]);
        await AsyncStorage.setItem('activeChildId', response.data[0].child_id.toString());
      }
    } catch (e) {
      console.log('Error fetching children', e);
    } finally {
      setIsLoading(false);
    }
  };

  const selectChild = async (child) => {
    setActiveChild(child);
    await AsyncStorage.setItem('activeChildId', child.child_id.toString());
  };

  useEffect(() => {
    if (userToken) {
      fetchChildren();
    } else {
      setChildrenList([]);
      setActiveChild(null);
    }
  }, [userToken]);

  return (
    <ChildContext.Provider value={{ childrenList, activeChild, selectChild, fetchChildren, isLoading }}>
      {children}
    </ChildContext.Provider>
  );
};
