
import { useState, useEffect } from 'react';

export interface MuscleSelection {
  id: string;
  name: string;
  side: 'Izquierdo' | 'Derecho' | 'Ambos';
  doseOption: 'min' | 'max';
  customDose?: number;
}

export interface Patient {
  id: string;
  full_name: string;
  age?: number;
  weight?: number;
}

interface CalculatorState {
  selectedBrand: string;
  dilution: string;
  selectedPatient: Patient | null;
  patientName: string;
  patientAge: string;
  patientWeight: string;
  selectedPathology: string | null;
  selectedMuscles: MuscleSelection[];
  adjustmentFactor: number;
}

const DEFAULT_STATE: CalculatorState = {
  selectedBrand: '',
  dilution: '',
  selectedPatient: null,
  patientName: '',
  patientAge: '',
  patientWeight: '',
  selectedPathology: null,
  selectedMuscles: [],
  adjustmentFactor: 1
};

export const useCalculatorState = () => {
  const [state, setState] = useState<CalculatorState>(DEFAULT_STATE);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('calculator_state');
      if (stored) {
        setState({ ...DEFAULT_STATE, ...JSON.parse(stored) });
      }
    } catch (e) {
      console.error('Error loading calculator state:', e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('calculator_state', JSON.stringify(state));
    }
  }, [state, isLoaded]);

  const updateState = (updates: Partial<CalculatorState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const resetState = () => {
    setState(DEFAULT_STATE);
    localStorage.removeItem('calculator_state');
  };

  return {
    state,
    updateState,
    resetState,
    isLoaded
  };
};
