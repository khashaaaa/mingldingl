import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { parseUserProfile } from '../models/user';
import { queryKeys } from '../lib/api/queryKeys';
import { i18n } from '../lib/i18n';
import { useAuthStore } from '../store/authStore';
import { toDroppedItem } from '../lib/tiers';

interface OnboardingState {
  displayName: string;
  age: number;
  gender: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  bio: string;
  photoUrls: string[];
  referralCode: string;
  currentStep: number;
  loading: boolean;
  error: string | null;
}

const initial: OnboardingState = {
  displayName: '', age: 0, gender: '', city: '', latitude: null, longitude: null, bio: '',
  photoUrls: [], referralCode: '', currentStep: 0, loading: false, error: null,
};

export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>(initial);
  const queryClient = useQueryClient();

  const isComplete =
    state.displayName.length > 0 && state.age > 0 && state.gender.length > 0 &&
    state.city.length > 0 && state.bio.length > 0 && state.photoUrls.length >= 3;

  function update(fields: Partial<Omit<OnboardingState, 'currentStep' | 'loading'>>) {
    setState((s) => ({ ...s, ...fields }));
  }

  function updatePhotos(next: string[] | ((current: string[]) => string[])) {
    setState((s) => ({ ...s, photoUrls: typeof next === 'function' ? next(s.photoUrls) : next }));
  }

  function nextStep() { setState((s) => ({ ...s, currentStep: s.currentStep + 1 })); }
  function prevStep() { setState((s) => ({ ...s, currentStep: Math.max(0, s.currentStep - 1) })); }

  async function submit(): Promise<boolean> {
    if (!isComplete) return false;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await apiClient.users.upsert({
        displayName: state.displayName, age: state.age, gender: state.gender,
        city: state.city, bio: state.bio, photoUrls: state.photoUrls,
        latitude: state.latitude ?? undefined, longitude: state.longitude ?? undefined,
        referralCode: state.referralCode || undefined,
      });
      queryClient.setQueryData(queryKeys.userProfile, parseUserProfile(data));
      const referralDrop = toDroppedItem(data.referralRewardItem);
      if (referralDrop) {
        useAuthStore.getState().setPendingDrop(referralDrop);
      }
      return true;
    } catch {
      // A genuine server rejection (validation, conflict, 500, etc — pure
      // network failures never reach here, lib/api.ts's interceptor already
      // mocks those). Do NOT fabricate a local-only profile and pretend
      // success: app/_layout.tsx routes purely off `!!userProfile` in the
      // query cache, so writing a fake profile there would route the user
      // into the main app with no server-side row behind it. Surface the
      // error instead and let the user retry from the onboarding flow.
      setState((s) => ({ ...s, error: i18n.t('save_error') }));
      return false;
    } finally {
      setState((s) => ({ ...s, loading: false }));
    }
  }

  return { state, update, updatePhotos, nextStep, prevStep, submit, isComplete };
}
