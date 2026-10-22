export interface UserProfile {
  id: string;
  name: string;
  email: string;
  passwordHash?: string;
  createdAt: string;
  
  // Onboarding questionnaire answers
  onboardingCompleted: boolean;
  age?: number;
  weightKg?: number;
  heightCm?: number;
  experienceLevel?: 'PRINCIPIANTE' | 'INTERMEDIO' | 'AVANZADO' | 'COMPETICION';
  weeklyDaysTarget?: number;
  weeklyHoursTarget?: number;
  knownMaxHr?: number;
  knownFtp?: number;

  // Dedicated Strava integration per user
  stravaAuth?: string;
  stravaAthleteName?: string;
  stravaAthleteId?: string;
  stravaClientId?: string;
  stravaClientSecret?: string;
}

export interface AuthSession {
  user: UserProfile;
  token: string;
}
