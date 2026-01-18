import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Linking,
  Share,
  Platform,
  Alert,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Card } from '@/components/Card';
import { useTheme } from '@/hooks/useTheme';
import { useData } from '@/context/DataContext';
import { Spacing, BorderRadius } from '@/constants/theme';
import { VehicleType } from '@/types';

type ServiceType = 'tow' | 'mechanic';

interface NearbyPlace {
  id: string;
  name: string;
  address: string;
  phone?: string;
  rating?: number;
  distance?: string;
  isOpen?: boolean;
}

export default function SOSScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { vehicles, activeVehicle } = useData();

  const [selectedService, setSelectedService] = useState<ServiceType | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const vehicleType: VehicleType = activeVehicle?.vehicleType || 'car';

  const getVehicleTypeLabel = (type: VehicleType): string => {
    switch (type) {
      case 'semi': return 'Semi-Truck';
      case 'pickup': return 'Pickup Truck';
      default: return 'Car';
    }
  };

  const handleFindNearby = useCallback(async (serviceType: ServiceType) => {
    setSearchError(null);
    setIsSearching(true);
    setNearbyPlaces([]);

    try {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setPermissionDenied(true);
        setIsSearching(false);
        if (!canAskAgain && Platform.OS !== 'web') {
          Alert.alert(
            'Location Required',
            'Please enable location access in Settings to find nearby services.',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Open Settings', 
                onPress: async () => {
                  try {
                    await Linking.openSettings();
                  } catch (e) {
                  }
                }
              },
            ]
          );
        }
        return;
      }

      setPermissionDenied(false);
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };
      setUserLocation(coords);

      const searchQuery = serviceType === 'tow' 
        ? `tow truck ${vehicleType === 'semi' ? 'heavy duty' : ''}`
        : `auto mechanic ${vehicleType === 'semi' ? 'truck repair' : 'car repair'}`;

      const response = await fetch(
        `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/places/nearby?lat=${coords.lat}&lng=${coords.lng}&query=${encodeURIComponent(searchQuery)}`
      );

      if (!response.ok) {
        throw new Error('Failed to search for nearby services');
      }

      const data = await response.json();
      setNearbyPlaces(data.places || []);

      if (!data.places || data.places.length === 0) {
        setSearchError('No nearby services found. Try expanding your search area.');
      }
    } catch (error: any) {
      console.error('Error finding nearby services:', error);
      setSearchError(error.message || 'Failed to find nearby services. Please try again.');
    } finally {
      setIsSearching(false);
    }
  }, [vehicleType]);

  const handleCall = useCallback((phone: string) => {
    const phoneUrl = Platform.select({
      ios: `tel:${phone}`,
      android: `tel:${phone}`,
      default: `tel:${phone}`,
    });
    Linking.openURL(phoneUrl).catch(() => {
      Alert.alert('Unable to Call', 'Phone calling is not available on this device.');
    });
  }, []);

  const handleShareLocation = useCallback(async () => {
    if (!userLocation) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Required', 'Please enable location access to share your location.');
        return;
      }

      try {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const coords = {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        };
        setUserLocation(coords);
        shareLocationWithCoords(coords);
      } catch (error) {
        Alert.alert('Error', 'Unable to get your location. Please try again.');
      }
    } else {
      shareLocationWithCoords(userLocation);
    }
  }, [userLocation]);

  const shareLocationWithCoords = async (coords: { lat: number; lng: number }) => {
    const appleMapsUrl = `https://maps.apple.com/?ll=${coords.lat},${coords.lng}&q=My%20Location`;
    const googleMapsUrl = `https://www.google.com/maps?q=${coords.lat},${coords.lng}`;

    const vehicleInfo = activeVehicle 
      ? `\n\nVehicle: ${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}`
      : '';

    try {
      await Share.share({
        message: `I need roadside assistance!${vehicleInfo}\n\nApple Maps: ${appleMapsUrl}\nGoogle Maps: ${googleMapsUrl}`,
        title: 'Share My Location',
      });
    } catch (error) {
      console.error('Error sharing location:', error);
    }
  };

  const renderServiceButton = (type: ServiceType, icon: string, label: string) => {
    const isSelected = selectedService === type;
    return (
      <Pressable
        style={[
          styles.serviceButton,
          {
            backgroundColor: isSelected ? theme.primary : theme.backgroundSecondary,
            borderColor: isSelected ? theme.primary : theme.border,
          },
        ]}
        onPress={() => setSelectedService(type)}
      >
        <Feather
          name={icon as any}
          size={32}
          color={isSelected ? '#FFFFFF' : theme.text}
        />
        <ThemedText
          style={[
            styles.serviceButtonLabel,
            isSelected && { color: '#FFFFFF' },
          ]}
        >
          {label}
        </ThemedText>
      </Pressable>
    );
  };

  const renderPlaceItem = ({ item }: { item: NearbyPlace }) => (
    <Card style={styles.placeCard}>
      <View style={styles.placeInfo}>
        <ThemedText style={styles.placeName}>{item.name}</ThemedText>
        <ThemedText style={[styles.placeAddress, { color: theme.textSecondary }]}>
          {item.address}
        </ThemedText>
        <View style={styles.placeDetails}>
          {item.rating && (
            <View style={styles.ratingContainer}>
              <Feather name="star" size={14} color={theme.accent} />
              <ThemedText style={styles.ratingText}>{item.rating.toFixed(1)}</ThemedText>
            </View>
          )}
          {item.distance && (
            <ThemedText style={[styles.distanceText, { color: theme.textSecondary }]}>
              {item.distance}
            </ThemedText>
          )}
          {item.isOpen !== undefined && (
            <ThemedText
              style={[
                styles.openStatus,
                { color: item.isOpen ? theme.success : theme.danger },
              ]}
            >
              {item.isOpen ? 'Open' : 'Closed'}
            </ThemedText>
          )}
        </View>
      </View>
      {item.phone && (
        <Pressable
          style={[styles.callButton, { backgroundColor: theme.success }]}
          onPress={() => handleCall(item.phone!)}
        >
          <Feather name="phone" size={20} color="#FFFFFF" />
          <ThemedText style={styles.callButtonText}>Call</ThemedText>
        </Pressable>
      )}
    </Card>
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + 100 },
        ]}
      >
        <View style={styles.header}>
          <View style={[styles.sosIcon, { backgroundColor: theme.danger + '20' }]}>
            <Feather name="alert-triangle" size={48} color={theme.danger} />
          </View>
          <ThemedText style={styles.title}>Roadside Assistance</ThemedText>
          {activeVehicle && (
            <ThemedText style={[styles.vehicleInfo, { color: theme.textSecondary }]}>
              {activeVehicle.nickname} ({getVehicleTypeLabel(vehicleType)})
            </ThemedText>
          )}
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>What do you need?</ThemedText>
          <View style={styles.serviceButtons}>
            {renderServiceButton('tow', 'truck', 'Call a Tow')}
            {renderServiceButton('mechanic', 'tool', 'Call a Mechanic')}
          </View>
        </View>

        {selectedService && (
          <Pressable
            style={[
              styles.findButton,
              { backgroundColor: theme.primary },
              isSearching && styles.findButtonDisabled,
            ]}
            onPress={() => handleFindNearby(selectedService)}
            disabled={isSearching}
          >
            {isSearching ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Feather name="map-pin" size={20} color="#FFFFFF" />
                <ThemedText style={styles.findButtonText}>Find Nearby</ThemedText>
              </>
            )}
          </Pressable>
        )}

        {permissionDenied && (
          <View style={[styles.warningCard, { backgroundColor: theme.danger + '15' }]}>
            <Feather name="alert-circle" size={24} color={theme.danger} />
            <ThemedText style={[styles.warningText, { color: theme.danger }]}>
              Location permission is required to find nearby services.
            </ThemedText>
          </View>
        )}

        {searchError && (
          <View style={[styles.warningCard, { backgroundColor: theme.accent + '15' }]}>
            <Feather name="info" size={24} color={theme.accent} />
            <ThemedText style={[styles.warningText, { color: theme.accent }]}>
              {searchError}
            </ThemedText>
          </View>
        )}

        {nearbyPlaces.length > 0 && (
          <View style={styles.resultsSection}>
            <ThemedText style={styles.sectionTitle}>
              Nearby {selectedService === 'tow' ? 'Tow Services' : 'Mechanics'}
            </ThemedText>
            {nearbyPlaces.map((place) => (
              <View key={place.id}>{renderPlaceItem({ item: place })}</View>
            ))}
          </View>
        )}

        <View style={styles.shareSection}>
          <ThemedText style={styles.sectionTitle}>Share Your Location</ThemedText>
          <Pressable
            style={[styles.shareButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
            onPress={handleShareLocation}
          >
            <Feather name="share-2" size={24} color={theme.primary} />
            <View style={styles.shareButtonContent}>
              <ThemedText style={styles.shareButtonTitle}>Share My Location</ThemedText>
              <ThemedText style={[styles.shareButtonSubtitle, { color: theme.textSecondary }]}>
                Send Apple/Google Maps link to someone
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={24} color={theme.textSecondary} />
          </Pressable>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  sosIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  vehicleInfo: {
    fontSize: 16,
    marginTop: Spacing.xs,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  serviceButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  serviceButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    gap: Spacing.sm,
  },
  serviceButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  findButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  findButtonDisabled: {
    opacity: 0.7,
  },
  findButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
  },
  resultsSection: {
    marginBottom: Spacing.xl,
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  placeInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  placeAddress: {
    fontSize: 14,
    marginBottom: Spacing.xs,
  },
  placeDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  distanceText: {
    fontSize: 14,
  },
  openStatus: {
    fontSize: 14,
    fontWeight: '500',
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  callButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  shareSection: {
    marginBottom: Spacing.xl,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  shareButtonContent: {
    flex: 1,
  },
  shareButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  shareButtonSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
});
