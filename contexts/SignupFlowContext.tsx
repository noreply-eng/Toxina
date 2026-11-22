import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { SubscriptionTier } from '../features/entitlements/planCatalog';
import {
  clearSignupDraft,
  readSignupDraft,
  saveSignupDraft,
  type PracticeType,
} from '../services/onboardingService';

export interface SignupFlowState {
  fullName: string;
  email: string;
  password: string;
  termsAccepted: boolean;
  privacySensitiveAccepted: boolean;
  secondaryPurposesAccepted: boolean;
  practiceType: PracticeType;
  clinicTeamSize: number;
  clinicName: string;
  selectedPlanTier: SubscriptionTier;
  billingInterval: 'monthly' | 'annual';
  promoCode: string;
}

interface SignupFlowContextValue {
  state: SignupFlowState;
  isFinalizingSignup: boolean;
  setIsFinalizingSignup: (active: boolean) => void;
  updateState: (patch: Partial<SignupFlowState>) => void;
  resetFlow: () => void;
}

const DEFAULT_STATE: SignupFlowState = {
  fullName: '',
  email: '',
  password: '',
  termsAccepted: false,
  privacySensitiveAccepted: false,
  secondaryPurposesAccepted: false,
  practiceType: 'individual',
  clinicTeamSize: 3,
  clinicName: '',
  selectedPlanTier: 'premium',
  billingInterval: 'monthly',
  promoCode: '',
};

const SignupFlowContext = createContext<SignupFlowContextValue>({
  state: DEFAULT_STATE,
  isFinalizingSignup: false,
  setIsFinalizingSignup: () => {},
  updateState: () => {},
  resetFlow: () => {},
});

function loadInitialState(): SignupFlowState {
  const draft = readSignupDraft();
  if (!draft) return DEFAULT_STATE;
  return {
    ...DEFAULT_STATE,
    fullName: draft.fullName || '',
    email: draft.email || '',
    practiceType: draft.practiceType === 'clinic' ? 'clinic' : 'individual',
    clinicTeamSize:
      typeof draft.clinicTeamSize === 'number' && draft.clinicTeamSize >= 2
        ? draft.clinicTeamSize
        : 3,
    clinicName: draft.clinicName || '',
    selectedPlanTier:
      draft.planTier === 'free' || draft.planTier === 'plus' || draft.planTier === 'premium'
        ? draft.planTier
        : 'premium',
    billingInterval: draft.billingInterval === 'annual' ? 'annual' : 'monthly',
    promoCode: draft.promoCode || '',
    termsAccepted: Boolean(draft.termsAccepted),
    privacySensitiveAccepted: Boolean(draft.privacySensitiveAccepted),
    secondaryPurposesAccepted: Boolean(draft.secondaryPurposesAccepted),
  };
}

export const SignupFlowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<SignupFlowState>(loadInitialState);
  const [isFinalizingSignup, setIsFinalizingSignup] = useState(false);

  const updateState = useCallback((patch: Partial<SignupFlowState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      // Persist only non-sensitive draft data (NEVER store password in web storage)
      saveSignupDraft({
        fullName: next.fullName,
        email: next.email,
        practiceType: next.practiceType,
        clinicTeamSize: next.clinicTeamSize,
        clinicName: next.clinicName,
        planTier: next.selectedPlanTier,
        billingInterval: next.billingInterval,
        promoCode: next.promoCode,
        termsAccepted: next.termsAccepted,
        privacySensitiveAccepted: next.privacySensitiveAccepted,
        secondaryPurposesAccepted: next.secondaryPurposesAccepted,
      });
      return next;
    });
  }, []);

  const resetFlow = useCallback(() => {
    clearSignupDraft();
    setState(DEFAULT_STATE);
    setIsFinalizingSignup(false);
  }, []);

  const value = useMemo(
    () => ({
      state,
      isFinalizingSignup,
      setIsFinalizingSignup,
      updateState,
      resetFlow,
    }),
    [state, isFinalizingSignup, updateState, resetFlow]
  );

  return <SignupFlowContext.Provider value={value}>{children}</SignupFlowContext.Provider>;
};

export function useSignupFlow(): SignupFlowContextValue {
  return useContext(SignupFlowContext);
}
