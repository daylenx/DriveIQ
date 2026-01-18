interface NearbyPlace {
  id: string;
  name: string;
  address: string;
  phone?: string;
  rating?: number;
  distance?: string;
  isOpen?: boolean;
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): string {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  if (distance < 0.1) {
    return `${Math.round(distance * 5280)} ft`;
  }
  return `${distance.toFixed(1)} mi`;
}

export async function searchNearbyPlaces(
  lat: number,
  lng: number,
  query: string
): Promise<NearbyPlace[]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  
  if (!apiKey) {
    console.log("Google API key not configured, returning sample data");
    return getSamplePlaces(query);
  }

  try {
    const radius = 16093; // 10 miles in meters
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${lat},${lng}&radius=${radius}&key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google Places API error:', data.status, data.error_message);
      return getSamplePlaces(query);
    }

    const places: NearbyPlace[] = [];
    
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

    return places.length > 0 ? places : getSamplePlaces(query);
  } catch (error) {
    console.error('Error fetching places:', error);
    return getSamplePlaces(query);
  }
}

async function getPlaceDetails(placeId: string, apiKey: string): Promise<{ phone?: string } | null> {
  try {
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
