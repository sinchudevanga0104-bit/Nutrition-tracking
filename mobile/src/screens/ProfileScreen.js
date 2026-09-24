import React, { useEffect, useState, useContext } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { Button, Card, Avatar, Chip, Divider } from 'react-native-paper';
import { AuthContext } from '../context/AuthContext';
import { ChildContext } from '../context/ChildContext';
import apiClient from '../api/client';

export default function ProfileScreen({ navigation }) {
  const { logout } = useContext(AuthContext);
  const { childrenList, activeChild, selectChild, fetchChildren, isLoading: childLoading } = useContext(ChildContext);
  
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
    const unsubscribe = navigation.addListener('focus', () => {
      fetchChildren();
    });
    return unsubscribe;
  }, [navigation]);

  const fetchProfile = async () => {
    try {
      const response = await apiClient.get('/auth/profile');
      setProfile(response.data);
    } catch (e) {
      console.log('Failed to fetch profile', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = async () => {
    if (!activeChild) {
      alert("Please select a child to download their report.");
      return;
    }
    try {
      const response = await apiClient.get(`/reports/${activeChild.child_id}/export`, {
        responseType: 'text'
      });
      
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `health_report_${activeChild.name.replace(/\s+/g, '_')}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
      alert(`Report for ${activeChild.name} downloaded successfully!`);
    } catch (e) {
      console.log('Error downloading report', e);
      alert('Failed to download report.');
    }
  };

  const renderChildItem = ({ item }) => {
    const isActive = activeChild && activeChild.child_id === item.child_id;
    return (
      <TouchableOpacity onPress={() => selectChild(item)}>
        <Card style={[styles.childCard, isActive && styles.activeChildCard]}>
          <Card.Title
            title={item.name}
            subtitle={`${item.gender} • DOB: ${item.dob}`}
            left={(props) => (
              <Avatar.Icon 
                {...props} 
                icon="account" 
                style={{ backgroundColor: isActive ? '#2E7D32' : '#E0E0E0' }} 
                color={isActive ? '#FFF' : '#666'}
              />
            )}
            right={() => isActive ? <Chip style={styles.activeBadge} textStyle={styles.activeBadgeText}>Active</Chip> : null}
          />
        </Card>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return <View style={styles.container}><ActivityIndicator size="large" color="#2E7D32" /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Parent Card */}
      <Card style={styles.card}>
        <Card.Title
          title="Parent Account"
          subtitle={profile?.email || ''}
          left={(props) => <Avatar.Icon {...props} icon="account-circle" style={{ backgroundColor: '#E8F5E9' }} color="#2E7D32" />}
        />
        <Card.Content>
          <Text style={styles.parentName}>{profile?.name}</Text>
        </Card.Content>
      </Card>

      {/* Children Section Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>My Children</Text>
        <Button mode="contained-tonal" compact onPress={() => navigation.navigate('AddChild')} icon="plus">
          Add Child
        </Button>
      </View>

      {childLoading ? (
        <ActivityIndicator size="small" color="#2E7D32" style={{ marginVertical: 15 }} />
      ) : childrenList.length === 0 ? (
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.emptyText}>No children added yet. Tap "+ Add Child" above to create a profile.</Text>
          </Card.Content>
        </Card>
      ) : (
        <View>
          {childrenList.map((item) => (
            <React.Fragment key={item.child_id}>
              {renderChildItem({ item })}
            </React.Fragment>
          ))}
        </View>
      )}

      {/* Active Child Detailed Card */}
      {activeChild && (
        <Card style={[styles.card, styles.detailCard]}>
          <Card.Title 
            title={`${activeChild.name}'s Profile Details`}
            left={(props) => <Avatar.Icon {...props} icon="badge-account-horizontal" style={{ backgroundColor: '#E3F2FD' }} color="#1565C0" />}
          />
          <Card.Content>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Gender:</Text>
              <Text style={styles.detailValue}>{activeChild.gender}</Text>
            </View>
            <Divider style={styles.divider} />
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date of Birth:</Text>
              <Text style={styles.detailValue}>{activeChild.dob}</Text>
            </View>
            <Divider style={styles.divider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Blood Group:</Text>
              <Text style={styles.detailValue}>{activeChild.blood_group || 'Not specified'}</Text>
            </View>
            <Divider style={styles.divider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Food Preference:</Text>
              <Text style={styles.detailValue}>{activeChild.food_preferences || 'Not specified'}</Text>
            </View>
            <Divider style={styles.divider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Food Allergies:</Text>
              <Text style={styles.detailValue}>{activeChild.food_allergies || 'None reported'}</Text>
            </View>
            <Divider style={styles.divider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Activity Level:</Text>
              <Text style={styles.detailValue}>{activeChild.activity_level || 'Moderate'}</Text>
            </View>
          </Card.Content>
          <Card.Actions style={styles.cardActions}>
            <Button mode="outlined" onPress={() => navigation.navigate('Growth')} icon="chart-line">
              Track Height & Weight
            </Button>
          </Card.Actions>
        </Card>
      )}

      {/* Actions */}
      <View style={styles.actionsContainer}>
        <Button mode="contained" onPress={handleDownloadReport} style={styles.actionButton} icon="download" buttonColor="#2E7D32">
          Download PDF/CSV Health Report
        </Button>

        <Button mode="outlined" onPress={logout} style={styles.actionButton} textColor="#D32F2F">
          Logout Account
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: '#F5F5F5' },
  card: { marginBottom: 15, backgroundColor: '#FFFFFF' },
  parentName: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 5 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#2E7D32' },
  emptyText: { color: '#666', fontStyle: 'italic', textAlign: 'center', marginVertical: 10 },
  childCard: { marginBottom: 10, backgroundColor: '#FAFAFA' },
  activeChildCard: { borderColor: '#2E7D32', borderWidth: 2, backgroundColor: '#E8F5E9' },
  activeBadge: { backgroundColor: '#2E7D32', marginRight: 10 },
  activeBadgeText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  detailCard: { borderColor: '#BBDEFB', borderWidth: 1 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  detailLabel: { fontSize: 14, color: '#666', fontWeight: '500' },
  detailValue: { fontSize: 14, color: '#111', fontWeight: '600' },
  divider: { marginVertical: 2 },
  cardActions: { justifyContent: 'flex-end', paddingTop: 10 },
  actionsContainer: { marginTop: 10 },
  actionButton: { marginBottom: 15, paddingVertical: 4 }
});
