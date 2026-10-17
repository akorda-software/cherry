export interface LegalStatus {
  required: boolean;
  accepted: boolean;
  ready: boolean;
  version: string;
  fingerprint: string;
}

export interface LegalDocument {
  slug: string;
  title: string;
  intro: string;
  sections: [string, string][];
}

export interface LegalPublication {
  version: string;
  fingerprint: string;
  ready: boolean;
  termsText: string;
  sensitiveText: string;
  adulthoodText: string;
  documents: LegalDocument[];
}

export interface LegalDeclarations {
  termsAccepted: boolean;
  sensitiveConsent: boolean;
  adulthoodConfirmed: boolean;
}

export const emptyDeclarations: LegalDeclarations = {
  termsAccepted: false,
  sensitiveConsent: false,
  adulthoodConfirmed: false
};

export function canAccept(publication: LegalPublication, declarations: LegalDeclarations) {
  return publication.ready && publication.documents.length > 0 &&
    declarations.termsAccepted && declarations.sensitiveConsent && declarations.adulthoodConfirmed;
}

export function needsLegalAcceptance(status: LegalStatus | undefined) {
  return status?.required === true && status.accepted !== true;
}
