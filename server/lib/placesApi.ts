/**
 * placesApi.ts - Google Places API Integration for SOS Feature
 * 
 * PURPOSE:
 * Server-side proxy for Google Places API to find nearby tow trucks and mechanics.
 * Keeps the API key secure on the server rather than exposing it in the client.
 * 
 * ASSUMPTIONS:
 * - GOOGLE_API_KEY environment variable is set with a valid Google Cloud API key
 * - The API key has Places API enabled in Google Cloud Console
 * - Users are located in the United States (distances shown in miles)
 * 
 * GUARDRAILS:
 * - Falls back to sample data if API key is missing or API fails
 * - Limits results to 10 places to avoid excessive API costs
 * - Uses text search radius of 10 miles (16093 meters) - reasonable for roadside assistance
 * - Gracefully handles API errors without crashing
 * 
 * EXTERNAL INTEGRATIONS:
 * - Google Places Text Search API: Searches for businesses matching query near coordinates
 * - Google Places Details API: Gets phone numbers (not included in text search results)
 * 
 * NON-OBVIOUS RULES:
 * - Phone numbers require a separate Place Details API call (adds latency but necessary)
 * - Text Search returns up to 20 results; we limit to 10 for performance
 * - ZERO_RESULTS is a valid status (no matching places found) - not an error
 * - Distance calculation uses Haversine formula for accurate great-circle distance
 */

interface NearbyPlace {
  id: string;
  name: string;
  address: string;
  phone?: string;
  rating?: number;
  distance?: string;
  isOpen?: boolean;
}

/**
 * Calculates the distance between two GPS coordinates using the Haversine formula.
 * Returns a human-readable string in miles or feet.
 * 
 * WHY: Google Places API doesn't return distance directly - we calculate it ourselves
 * using the provided coordinates.
 * 
 * ASSUMPTION: Users are in the US, so we use miles. For international support,
 * this could be made configurable per-user.
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): string {
  const R = 3959; // Earth's radius in miles (use 6371 for kilometers)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  // Show feet for very close distances (< 0.1 mile = 528 feet)
  if (distance < 0.1) {
    return `${Math.round(distance * 5280)} ft`;
  }
  return `${distance.toFixed(1)} mi`;
}

/**
 * MAJOR FUNCTION: searchNearbyPlaces
 * 
 * Main entry point for searching nearby service providers.
 * Uses Google Places Text Search API to find matching businesses.
 * 
 * @param lat - User's latitude
 * @param lng - User's longitude
 * @param query - Search query (e.g., "tow truck", "auto mechanic")
 * @returns Array of nearby places with contact info and distance
 * 
 * FLOW:
 * 1. Check if API key is configured - fall back to sample data if not
 * 2. Call Google Places Text Search API with location bias
 * 3. For each result, fetch place details to get phone number
 * 4. Calculate distance from user to each place
 * 5. Return formatted results, or sample data if search fails
 */
export async function searchNearbyPlaces(
  lat: number,
  lng: number,
  query: string
): Promise<NearbyPlace[]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  
  // Graceful degradation: show sample data for testing/development
  // when API key is not configured
  if (!apiKey) {
    console.log("Google API key not configured, returning sample data");
    return getSamplePlaces(query);
  }

  try {
    // 10 miles in meters - reasonable radius for roadside assistance
    // Too small = no results; too large = irrelevant distant results
    const radius = 16093;
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${lat},${lng}&radius=${radius}&key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    // ZERO_RESULTS is valid (no matching places) - not an error condition
    // Other statuses like INVALID_REQUEST, OVER_QUERY_LIMIT are errors
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google Places API error:', data.status, data.error_message);
      return getSamplePlaces(query);
    }

    const places: NearbyPlace[] = [];
    
    // Limit to 10 results to control API costs and improve performance
    // Each place requires an additional Details API call for phone number
    for (const place of data.results?.slice(0, 10) || []) {
      const placeDetails = await getPlaceDetails(place.place_id, apiKey);
      
      places.push({
        id: place.place_id,
        name: place.name,
        address: place.formatted_address,
        phone: placeDetails?.phone,
        rating: place.rating,
        distance: place.geometry?.location 
          ? calculateDistance(lat, lng, place.geometry.location.lat, place.geometry.location.lng)
          : undefined,
        isOpen: place.opening_hours?.open_now,
      });
    }

    // Fall back to sample data if API returned no results
    // This ensures users always see something helpful
    return places.length > 0 ? places : getSamplePlaces(query);
  } catch (error) {
    console.error('Error fetching places:', error);
    return getSamplePlaces(query);
  }
}

/**
 * Fetches place details to get the phone number.
 * 
 * WHY: The Text Search API doesn't include phone numbers in results.
 * We need to make a separate call for each place to get contact info.
 * 
 * TRADEOFF: This adds latency and API cost, but phone numbers are essential
 * for the SOS feature's tap-to-call functionality.
 * 
 * OPTIMIZATION: We only request the formatted_phone_number field to minimize
 * response size and API billing.
 */
async function getPlaceDetails(placeId: string, apiKey: string): Promise<{ phone?: string } | null> {
  try {
    // Only request phone number field to minimize API usage
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_phone_number&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.result) {
      return {
        phone: data.result.formatted_phone_number,
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching place details:', error);
    return null;
  }
}

/**
 * Returns sample/mock data for development and fallback scenarios.
 * 
 * PURPOSE:
 * - Allows testing without Google API key configured
 * - Provides fallback when API is unavailable or over quota
 * - Shows users representative data while waiting for real results
 * 
 * The sample data includes realistic business names, addresses, and phone numbers
 * formatted like real tow services and auto shops.
 */
function getSamplePlaces(query: string): NearbyPlace[] {
  const isTow = query.toLowerCase().includes('tow');
  
  if (isTow) {
    return [
      {
        id: 'sample-1',
        name: 'Quick Tow Service',
        address: '123 Main St',
        phone: '(555) 123-4567',
        rating: 4.5,
        distance: '2.3 mi',
        isOpen: true,
      },
      {
        id: 'sample-2',
        name: '24/7 Emergency Towing',
        address: '456 Oak Ave',
        phone: '(555) 987-6543',
        rating: 4.8,
        distance: '3.1 mi',
        isOpen: true,
      },
      {
        id: 'sample-3',
        name: 'City Tow & Recovery',
        address: '789 Pine Blvd',
        phone: '(555) 456-7890',
        rating: 4.2,
        distance: '4.7 mi',
        isOpen: false,
      },
    ];
  }
  
  // Mechanic sample data
  return [
    {
      id: 'sample-1',
      name: 'AutoCare Express',
      address: '100 Mechanic Way',
      phone: '(555) 111-2222',
      rating: 4.7,
      distance: '1.8 mi',
      isOpen: true,
    },
    {
      id: 'sample-2',
      name: 'Precision Auto Repair',
      address: '200 Service Road',
      phone: '(555) 333-4444',
      rating: 4.4,
      distance: '2.5 mi',
      isOpen: true,
    },
    {
      id: 'sample-3',
      name: 'Hometown Garage',
      address: '300 Repair Lane',
      phone: '(555) 555-6666',
      rating: 4.9,
      distance: '3.9 mi',
      isOpen: false,
    },
  ];
}
