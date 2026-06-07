import type { ConsentType, LegalDocumentType } from '../constants/legalVersions';

export interface UserComplianceProfile {
  id: string;
  full_name: string | null;
  general_license: string | null;
  terms_accepted_at: string | null;
  terms_version: string | null;
  privacy_sensitive_accepted_at: string | null;
  privacy_version: string | null;
  secondary_purposes_accepted_at: string | null;
  secondary_purposes_version: string | null;
  consent_revoked_at: string | null;
}

export interface ComplianceStatus {
  hasAcceptedTerms: boolean;
  hasAcceptedPrivacySensitive: boolean;
  needsReConsent: boolean;
  hasCompletedProfile: boolean;
  isRevoked: boolean;
  secondaryPurposesAccepted: boolean;
  termsVersion: string | null;
  privacyVersion: string | null;
}

export interface RecordConsentsPayload {
  termsVersion: string;
  privacyVersion: string;
  secondaryPurposes: boolean;
}

export interface ConsentEvent {
  id: string;
  user_id: string;
  document_type: LegalDocumentType;
  document_version: string;
  consent_type: ConsentType;
  granted: boolean;
  accepted_at: string;
  revoked_at: string | null;
}

export type ArcoRequestType = 'access' | 'rectification' | 'cancellation' | 'opposition';

export interface ArcoRequest {
  id: string;
  user_id: string;
  request_type: ArcoRequestType;
  description: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'rejected';
  created_at: string;
}
