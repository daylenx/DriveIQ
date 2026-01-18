/**
 * SOSScreen.tsx - Emergency Roadside Assistance Feature
 * 
 * PURPOSE:
 * Provides users with a quick way to find nearby tow trucks or mechanics
 * during vehicle emergencies. This is a critical safety feature.
 * 
 * ASSUMPTIONS:
 * - User has a mobile device with location capabilities
 * - User may be stressed during an emergency, so UI must be simple and clear
 * - Location permission will only be requested when explicitly needed (privacy-first)
 * - The active vehicle context helps tailor search results (e.g., semi-trucks need heavy-duty services)
 * 
 * GUARDRAILS:
 * - Location permission is ONLY requested when user taps "Find Nearby" - NO background tracking
 * - Falls back gracefully to sample data if Google Places API is unavailable
 * - Handles permission denial with clear guidance to Settings
 * - Validates phone numbers exist before showing call button
 * - Platform-specific handling for web vs native (tel: links, Settings access)
 * 
 * EXTERNAL INTEGRATIONS:
 * - expo-location: For requesting foreground location permission and getting GPS coordinates
 * - Google Places API (via server): Searches for nearby tow trucks and mechanics
 * - Native phone dialer: tel: URL scheme for tap-to-call
 * - Share API: For sharing location via Apple Maps and Google Maps links
 * 
 * NON-OBVIOUS RULES:
 * - Vehicle type affects search query: semi-trucks get "heavy duty" appended for tow searches
 * - Linking.openSettings() is NOT available on web and may fail on some Android variants
 * - Share API behavior differs between platforms (iOS uses share sheet, Android varies)
 */

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

  // Default to 'car' if no active vehicle - most common case
  const vehicleType: VehicleType = activeVehicle?.vehicleType || 'car';

  /**
   * Maps internal vehicle type codes to user-friendly labels
   * Used for display purposes in the UI
   */
  const getVehicleTypeLabel = (type: VehicleType): string => {
    switch (type) {
      case 'semi': return 'Semi-Truck';
      case 'pickup': return 'Pickup Truck';
      default: return 'Car';
    }
  };

  /**
   * MAJOR FUNCTION: handleFindNearby
   * 
   * Requests location permission, gets current position, and searches for nearby services.
   * This is the core functionality of the SOS feature.
   * 
   * Flow:
   * 1. Request foreground location permission (one-time, not background)
   * 2. If denied, show warning and optionally redirect to Settings
   * 3. Get current GPS coordinates with balanced accuracy (faster than high accuracy)
   * 4. Build search query based on service type and vehicle type
   * 5. Call server API which proxies to Google Places
   * 6. Handle errors gracefully with user-friendly messages
   */
  const handleFindNearby = useCallback(async (serviceType: ServiceType) => {
    setSearchError(null);
    setIsSearching(true);
    setNearbyPlaces([]);

    try {
      // Request permission only when user explicitly wants to search
      // This respects user privacy - no background or preemptive location access
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setPermissionDenied(true);
        setIsSearching(false);
        // Only offer Settings redirect if permission was permanently denied
        // and we're not on web (Linking.openSettings doesn't work on web)
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
                    // openSettings may not be available on all devices
                  }
                }
              },
            ]
          );
        }
        return;
      }

      setPermissionDenied(false);
      
      // Balanced accuracy is faster than High/Highest and sufficient for finding nearby businesses
      // We don't need meter-level precision for searching a 10-mile radius
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };
      setUserLocation(coords);

      // Tailor search query based on service type and vehicle type
      // Semi-trucks need specialized heavy-duty towing and truck repair shops
      // Using very specific terms to ensure Google Places returns appropriate results
      let searchQuery: string;
      
      if (serviceType === 'tow') {
        if (vehicleType === 'semi') {
          // Semi-trucks require heavy-duty/commercial towing - regular tow trucks can't handle them
          searchQuery = 'heavy duty towing semi truck commercial tow service';
        } else if (vehicleType === 'pickup') {
          // Pickup trucks can use regular towing but benefit from flatbed services
          searchQuery = 'tow truck flatbed towing service';
        } else {
          // Cars and other passenger vehicles
          searchQuery = 'tow truck roadside assistance';
        }
      } else {
        // Mechanic searches
        if (vehicleType === 'semi') {
          // Semi-trucks need diesel mechanics and truck service centers
          searchQuery = 'semi truck repair diesel mechanic commercial truck service';
        } else if (vehicleType === 'pickup') {
          searchQuery = 'truck repair auto mechanic';
        } else {
          searchQuery = 'auto mechanic car repair';
        }
      }
      
      console.log(`SOS Search: vehicleType=${vehicleType}, serviceType=${serviceType}, query="${searchQuery}"`);

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

  /**
   * Initiates a phone call using the native dialer
   * Uses tel: URL scheme which works across iOS and Android
   */
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

  /**
   * MAJOR FUNCTION: handleShareLocation
   * 
   * Shares the user's current location via the native share sheet.
   * Includes links to both Apple Maps and Google Maps for maximum compatibility.
   * Also includes vehicle info to help the person receiving the location.
   */
  const handleShareLocation = useCallback(async () => {
    // Reuse cached location if available, otherwise request fresh location
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

  /**
   * Creates and shares a message with map links
   * Includes both Apple Maps (for iOS users) and Google Maps (universal) links
   */
  const shareLocationWithCoords = async (coords: { lat: number; lng: number }) => {
    const appleMapsUrl = `https://maps.apple.com/?ll=${coords.lat},${coords.lng}&q=My%20Location`;
    const googleMapsUrl = `https://www.google.com/maps?q=${coords.lat},${coords.lng}`;

    // Include vehicle info to help identify which vehicle needs assistance
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
      {/* Only show call button if phone number is available */}
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

        {/* Find Nearby button only appears after service selection */}
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
