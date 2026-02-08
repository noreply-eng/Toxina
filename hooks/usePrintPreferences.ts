
import { useState, useEffect } from 'react';

export interface PrintPreferences {
    // General settings
    includeClinicLogo: boolean;
    includeDoctorSignature: boolean;
    includeDate: boolean;
    
    // Patient information
    showPatientPhoto: boolean;
    showPatientAge: boolean;
    showPatientContact: boolean;
    showMedicalHistory: boolean;
    
    // Treatment details
    showDilution: boolean;
    showTotalUnits: boolean;
    showMuscleDetails: boolean;
    showProductBrand: boolean;
    showLotNumber: boolean;
    
    // **NEW** - Additional guides
    includeMotorPoints: boolean;
    includeUsgGuide: boolean;
    
    // Layout preferences
    paperSize: 'letter' | 'a4';
    orientation: 'portrait' | 'landscape';
    fontSize: 'small' | 'medium' | 'large';
    
    // Optional sections
    includeConsentForm: boolean;
    includeInstructions: boolean;
    includeFollowUpDate: boolean;
    includeNotes: boolean;
    
    // Branding
    headerStyle: 'modern' | 'classic' | 'minimal';
    colorScheme: 'blue' | 'green' | 'purple' | 'gray';
}

const DEFAULT_PREFERENCES: PrintPreferences = {
    includeClinicLogo: true,
    includeDoctorSignature: true,
    includeDate: true,
    
    showPatientPhoto: false,
    showPatientAge: true,
    showPatientContact: false,
    showMedicalHistory: true,
    
    showDilution: true,
    showTotalUnits: true,
    showMuscleDetails: true,
    showProductBrand: true,
    showLotNumber: false,
    
    includeMotorPoints: false, // Default false
    includeUsgGuide: false,    // Default false
    
    paperSize: 'letter',
    orientation: 'portrait',
    fontSize: 'medium',
    
    includeConsentForm: false,
    includeInstructions: true,
    includeFollowUpDate: true,
    includeNotes: true,
    
    headerStyle: 'modern',
    colorScheme: 'blue'
};

export const usePrintPreferences = () => {
  const [preferences, setPreferences] = useState<PrintPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('print_preferences');
      if (stored) {
        setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(stored) });
      }
    } catch (e) {
      console.error('Error loading print preferences:', e);
    }
  }, []);

  const updatePreferences = (newPrefs: Partial<PrintPreferences>) => {
    const updated = { ...preferences, ...newPrefs };
    setPreferences(updated);
    localStorage.setItem('print_preferences', JSON.stringify(updated));
  };
  
  const resetPreferences = () => {
      setPreferences(DEFAULT_PREFERENCES);
      localStorage.setItem('print_preferences', JSON.stringify(DEFAULT_PREFERENCES));
  }

  return { preferences, updatePreferences, resetPreferences };
};
