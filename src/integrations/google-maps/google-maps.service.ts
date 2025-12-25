import { Injectable } from '@nestjs/common';

export interface DistanceResult {
  distanceMiles: number;
  durationMinutes: number;
}

export interface Location {
  lat: number;
  lng: number;
}

@Injectable()
export class GoogleMapsService {
  /**
   * Calculate distance between two points
   * MOCK IMPLEMENTATION - Returns calculated distance based on coordinates
   * TODO: Replace with real Google Maps Distance Matrix API
   */
  async calculateDistance(
    origin: Location,
    destination: Location,
    viaPoints?: Location[],
  ): Promise<DistanceResult> {
    // Calculate straight-line distance using Haversine formula
    // Add 30% for road routing factor
    const straightLineDistance = this.haversineDistance(origin, destination);

    // Add distance for via points
    let totalDistance = straightLineDistance;
    if (viaPoints && viaPoints.length > 0) {
      let prevPoint = origin;
      for (const viaPoint of viaPoints) {
        totalDistance += this.haversineDistance(prevPoint, viaPoint);
        prevPoint = viaPoint;
      }
      totalDistance += this.haversineDistance(
        viaPoints[viaPoints.length - 1],
        destination,
      );
      // Subtract original straight line since we calculated the route through via points
      totalDistance -= straightLineDistance;
    }

    // Apply road routing factor (roads are ~30% longer than straight line)
    const roadDistance = totalDistance * 1.3;

    // Estimate duration: average 30 mph in urban areas
    const durationMinutes = Math.ceil((roadDistance / 30) * 60);

    return {
      distanceMiles: Math.round(roadDistance * 100) / 100,
      durationMinutes,
    };
  }

  /**
   * Haversine formula to calculate straight-line distance in miles
   */
  private haversineDistance(point1: Location, point2: Location): number {
    const R = 3958.8; // Earth's radius in miles
    const dLat = this.toRad(point2.lat - point1.lat);
    const dLon = this.toRad(point2.lng - point1.lng);
    const lat1 = this.toRad(point1.lat);
    const lat2 = this.toRad(point2.lat);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
