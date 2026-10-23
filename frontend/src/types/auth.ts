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

  // Equipment & Bicycle Discipline profile
  primaryDiscipline?: 'MTB' | 'CARRETERA' | 'GRAVEL' | 'MIXTO';
  hasPowerMeter?: boolean;
  hasHeartRateMonitor?: boolean;
  heartRateSensorType?: 'PECHO' | 'RELOJ' | 'NINGUNO';
  hasCadenceSensor?: boolean;
  bikeComputer?: 'GARMIN' | 'WAHOO' | 'BRYTON' | 'HAMMERHEAD' | 'MOVIL' | 'NINGUNO' | 'OTRO';

  // Dedicated Strava & AI integration per user
  stravaAuth?: string;
  stravaAthleteName?: string;
  stravaAthleteId?: string;
  stravaClientId?: string;
  stravaClientSecret?: string;
  n8nWebhookUrl?: string;
}

export interface AuthSession {
  user: UserProfile;
  token: string;
}
