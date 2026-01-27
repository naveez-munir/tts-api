import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Client,
  // PlaceAutocompleteType,
  TravelMode,
  UnitSystem,
} from '@googlemaps/google-maps-services-js';

export interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  postcode: string | null;
}

export interface DistanceResult {
  distanceMeters: number;
  distanceMiles: number;
  durationSeconds: number;
  durationMinutes: number;
  durationText: string;
  distanceText: string;
}

export interface WaypointLocation {
  lat: number;
  lng: number;
}

@Injectable()
export class GoogleMapsService {
  private readonly logger = new Logger(GoogleMapsService.name);
  private readonly client: Client;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.client = new Client({});
    this.apiKey = this.configService.get<string>('GOOGLE_MAPS_API_KEY') || '';

    if (!this.apiKey || this.apiKey === 'your_google_maps_api_key_here') {
      this.logger.warn('Google Maps API key not configured - using mock data');
    }
  }

  /**
   * Get place autocomplete suggestions for address input
   */
  async getPlaceAutocomplete(
    input: string,
    sessionToken?: string,
  ): Promise<PlacePrediction[]> {
    if (!this.isApiKeyValid()) {
      return this.getMockAutocompletePredictions(input);
    }

    try {
      const response = await this.client.placeAutocomplete({
        params: {
          input,
          key: this.apiKey,
          components: ['country:gb'], // Restrict to UK
          sessiontoken: sessionToken,
        },
      });

      return response.data.predictions.map((prediction) => ({
        placeId: prediction.place_id,
        description: prediction.description,
        mainText: prediction.structured_formatting.main_text,
        secondaryText: prediction.structured_formatting.secondary_text || '',
      }));
    } catch (error) {
      this.logger.error('Place autocomplete failed', error);
      return this.getMockAutocompletePredictions(input);
    }
  }

  /**
   * Get geocoding details from a place ID
   */
  async getPlaceDetails(placeId: string): Promise<GeocodingResult | null> {
    if (!this.isApiKeyValid()) {
      return this.getMockGeocodingResult();
    }

    try {
      const response = await this.client.placeDetails({
        params: {
          place_id: placeId,
          key: this.apiKey,
          fields: ['geometry', 'formatted_address', 'address_components'],
        },
      });

      const result = response.data.result;
      const location = result.geometry?.location;

      if (!location) {
        return null;
      }

      const postcodeComponent = result.address_components?.find((component) =>
        (component.types as string[]).includes('postal_code'),
      );

      return {
        lat: location.lat,
        lng: location.lng,
        formattedAddress: result.formatted_address || '',
        postcode: postcodeComponent?.long_name || null,
      };
    } catch (error) {
      this.logger.error('Place details failed', error);
      return this.getMockGeocodingResult();
    }
  }

  /**
   * Calculate distance and duration between two points
   */
  async calculateDistance(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ): Promise<DistanceResult | null> {
    if (!this.isApiKeyValid()) {
      return this.getMockDistanceResult(originLat, originLng, destLat, destLng);
    }

    try {
      const response = await this.client.distancematrix({
        params: {
          origins: [{ lat: originLat, lng: originLng }],
          destinations: [{ lat: destLat, lng: destLng }],
          key: this.apiKey,
          mode: TravelMode.driving,
          units: UnitSystem.imperial,
        },
      });

      const element = response.data.rows[0]?.elements[0];

      if (!element || element.status !== 'OK') {
        this.logger.warn('Distance matrix returned non-OK status');
        return null;
      }

      const distanceMeters = element.distance.value;
      const durationSeconds = element.duration.value;

      return {
        distanceMeters,
        distanceMiles: distanceMeters / 1609.344,
        durationSeconds,
        durationMinutes: Math.ceil(durationSeconds / 60),
        durationText: element.duration.text,
        distanceText: element.distance.text,
      };
    } catch (error) {
      this.logger.error('Distance matrix calculation failed', error);
      return this.getMockDistanceResult(originLat, originLng, destLat, destLng);
    }
  }

  /**
   * Calculate distance and duration for a route with intermediate stops (waypoints)
   * Uses Google Directions API to get the total route distance through all points
   */
  async calculateDistanceWithWaypoints(
    origin: WaypointLocation,
    destination: WaypointLocation,
    waypoints: WaypointLocation[],
  ): Promise<DistanceResult | null> {
    // If no waypoints, use the simpler distance matrix
    if (!waypoints || waypoints.length === 0) {
      return this.calculateDistance(origin.lat, origin.lng, destination.lat, destination.lng);
    }

    if (!this.isApiKeyValid()) {
      return this.getMockDistanceWithWaypoints(origin, destination, waypoints);
    }

    try {
      const response = await this.client.directions({
        params: {
          origin: { lat: origin.lat, lng: origin.lng },
          destination: { lat: destination.lat, lng: destination.lng },
          waypoints: waypoints.map(wp => ({ lat: wp.lat, lng: wp.lng })),
          optimize: false, // Keep the order as specified by user
          key: this.apiKey,
          mode: TravelMode.driving,
          units: UnitSystem.imperial,
        },
      });

      const route = response.data.routes[0];
      if (!route || !route.legs) {
        this.logger.warn('Directions API returned no route');
        return null;
      }

      // Sum up distance and duration from all legs
      let totalDistanceMeters = 0;
      let totalDurationSeconds = 0;

      for (const leg of route.legs) {
        totalDistanceMeters += leg.distance?.value || 0;
        totalDurationSeconds += leg.duration?.value || 0;
      }

      const totalDistanceMiles = totalDistanceMeters / 1609.344;
      const totalDurationMinutes = Math.ceil(totalDurationSeconds / 60);

      return {
        distanceMeters: totalDistanceMeters,
        distanceMiles: totalDistanceMiles,
        durationSeconds: totalDurationSeconds,
        durationMinutes: totalDurationMinutes,
        durationText: `${totalDurationMinutes} mins`,
        distanceText: `${totalDistanceMiles.toFixed(1)} mi`,
      };
    } catch (error) {
      this.logger.error('Directions API calculation failed', error);
      return this.getMockDistanceWithWaypoints(origin, destination, waypoints);
    }
  }

  private isApiKeyValid(): boolean {
    return !!this.apiKey && this.apiKey !== 'your_google_maps_api_key_here';
  }

  // Mock data methods for development without API key
  private getMockAutocompletePredictions(input: string): PlacePrediction[] {
    const mockAddresses = [
      {
        placeId: 'mock_heathrow',
        description: 'London Heathrow Airport (LHR), Longford TW6, UK',
        mainText: 'London Heathrow Airport (LHR)',
        secondaryText: 'Longford TW6, UK',
      },
      {
        placeId: 'mock_gatwick',
        description: 'London Gatwick Airport (LGW), Horley RH6, UK',
        mainText: 'London Gatwick Airport (LGW)',
        secondaryText: 'Horley RH6, UK',
      },
      {
        placeId: 'mock_stansted',
        description: 'London Stansted Airport (STN), Stansted CM24, UK',
        mainText: 'London Stansted Airport (STN)',
        secondaryText: 'Stansted CM24, UK',
      },
      {
        placeId: 'mock_kings_cross',
        description: "King's Cross Station, Euston Rd, London N1C, UK",
        mainText: "King's Cross Station",
        secondaryText: 'Euston Rd, London N1C, UK',
      },
    ];

    return mockAddresses.filter((addr) =>
      addr.description.toLowerCase().includes(input.toLowerCase()),
    );
  }

  private getMockGeocodingResult(): GeocodingResult {
    return {
      lat: 51.4700223,
      lng: -0.4542955,
      formattedAddress: 'London Heathrow Airport (LHR), Longford TW6, UK',
      postcode: 'TW6',
    };
  }

  private getMockDistanceResult(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ): DistanceResult {
    // Simple Haversine formula for mock calculation
    const R = 3958.8; // Earth radius in miles
    const dLat = this.toRad(destLat - originLat);
    const dLng = this.toRad(destLng - originLng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(originLat)) *
        Math.cos(this.toRad(destLat)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceMiles = R * c;
    const distanceMeters = distanceMiles * 1609.344;

    // Estimate duration: ~30 mph average
    const durationMinutes = Math.ceil((distanceMiles / 30) * 60);
    const durationSeconds = durationMinutes * 60;

    return {
      distanceMeters,
      distanceMiles,
      durationSeconds,
      durationMinutes,
      durationText: `${durationMinutes} mins`,
      distanceText: `${distanceMiles.toFixed(1)} mi`,
    };
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Mock distance calculation for routes with waypoints
   * Calculates total distance by summing distances between consecutive points
   */
  private getMockDistanceWithWaypoints(
    origin: WaypointLocation,
    destination: WaypointLocation,
    waypoints: WaypointLocation[],
  ): DistanceResult {
    // Build the full route: origin -> waypoints -> destination
    const allPoints = [origin, ...waypoints, destination];

    let totalDistanceMiles = 0;

    // Calculate distance between each consecutive pair of points
    for (let i = 0; i < allPoints.length - 1; i++) {
      const from = allPoints[i];
      const to = allPoints[i + 1];

      // Haversine formula
      const R = 3958.8; // Earth radius in miles
      const dLat = this.toRad(to.lat - from.lat);
      const dLng = this.toRad(to.lng - from.lng);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(this.toRad(from.lat)) *
          Math.cos(this.toRad(to.lat)) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      totalDistanceMiles += R * c;
    }

    const totalDistanceMeters = totalDistanceMiles * 1609.344;

    // Estimate duration: ~30 mph average
    const durationMinutes = Math.ceil((totalDistanceMiles / 30) * 60);
    const durationSeconds = durationMinutes * 60;

    return {
      distanceMeters: totalDistanceMeters,
      distanceMiles: totalDistanceMiles,
      durationSeconds,
      durationMinutes,
      durationText: `${durationMinutes} mins`,
      distanceText: `${totalDistanceMiles.toFixed(1)} mi`,
    };
  }
}

