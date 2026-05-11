export type TripStatus = "OPEN" | "GENERATING" | "LOCKED" | "COMPLETED";
export type Role = "PASSENGER" | "DRIVER" | "ADMIN";

export interface TripWithCounts {
  id: string;
  date: string;
  status: TripStatus;
  notes?: string | null;
  passengerCount: number;
  driverCount: number;
  totalSeats: number;
}

export interface PassengerWithAttendance {
  id: string; // attendanceId
  userId: string;
  name: string;
  phone: string;
  dropoffAddress: string;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  notes?: string | null;
  attending: boolean;
  assignmentId?: string | null;
}

export interface DriverWithSession {
  id: string; // driverSessionId
  userId: string;
  name: string;
  phone: string;
  carType?: string | null;
  seats: number;
  available: boolean;
  notes?: string | null;
  assignmentId?: string | null;
}

export interface AssignmentWithDetails {
  id: string;
  tripId: string;
  driver: {
    sessionId: string;
    userId: string;
    name: string;
    phone: string;
    carType?: string | null;
    seats: number;
  };
  passengers: PassengerWithAttendance[];
  stopOrder?: string[] | null;
  mapsUrl?: string | null;
  estimatedMinutes?: number | null;
  isLocked: boolean;
}
