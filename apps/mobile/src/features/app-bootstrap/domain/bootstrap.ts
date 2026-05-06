export interface AppBootstrapUser {
  id: string;
  email: string;
  displayName: string | null;
}

export interface AppBootstrapProfileState {
  exists: boolean;
  isComplete: boolean;
  isDiscoverable: boolean;
  isPaused: boolean;
  onboardingRequired: boolean;
  nextOnboardingStep: string | null;
}

export interface AppBootstrap {
  user: AppBootstrapUser;
  profile: AppBootstrapProfileState;
}
