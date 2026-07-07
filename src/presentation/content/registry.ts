import type { ContentDocument, ContentKey } from './types';

const LAST_UPDATED = '2026-06-08';

export const CONTENT_REGISTRY: Record<ContentKey, ContentDocument> = {
  consent: {
    titleKey: 'content.consent.title',
    lastUpdatedISO: LAST_UPDATED,
    blocks: [
      { type: 'paragraph', textKey: 'content.consent.intro' },
      { type: 'heading', level: 2, textKey: 'content.consent.flerrTitle' },
      { type: 'bullet', textKey: 'content.consent.flerrFree' },
      { type: 'bullet', textKey: 'content.consent.flerrInformed' },
      { type: 'bullet', textKey: 'content.consent.flerrExplicit' },
      { type: 'bullet', textKey: 'content.consent.flerrRevocable' },
      { type: 'bullet', textKey: 'content.consent.flerrRenewable' },
      { type: 'heading', level: 2, textKey: 'content.consent.importantTitle' },
      { type: 'paragraph', textKey: 'content.consent.importantBody' },
    ],
  },

  legalFramework: {
    titleKey: 'content.legalFramework.title',
    lastUpdatedISO: LAST_UPDATED,
    blocks: [
      { type: 'paragraph', textKey: 'content.legalFramework.intro' },
      { type: 'heading', level: 2, textKey: 'content.legalFramework.frenchLawTitle' },
      { type: 'paragraph', textKey: 'content.legalFramework.frenchLawBody' },
      { type: 'paragraph', textKey: 'content.legalFramework.frenchLawArticle' },
      { type: 'heading', level: 2, textKey: 'content.legalFramework.importantTitle' },
      { type: 'paragraph', textKey: 'content.legalFramework.importantBody' },
    ],
  },

  helpline: {
    titleKey: 'content.helpline.title',
    lastUpdatedISO: LAST_UPDATED,
    blocks: [
      { type: 'paragraph', textKey: 'content.helpline.intro' },

      { type: 'heading', level: 2, textKey: 'content.helpline.frTitle' },
      { type: 'phone', labelKey: 'content.helpline.fr3919', number: '3919' },
      { type: 'phone', labelKey: 'content.helpline.frPolice', number: '17' },
      { type: 'phone', labelKey: 'content.helpline.frSos', number: '116006' },

      { type: 'heading', level: 2, textKey: 'content.helpline.enTitle' },
      { type: 'phone', labelKey: 'content.helpline.usRainn', number: '+18006564673' },
      { type: 'phone', labelKey: 'content.helpline.ukRefuge', number: '+448082000247' },

      { type: 'paragraph', textKey: 'content.helpline.internationalNote' },
    ],
  },

  privacy: {
    titleKey: 'content.privacy.title',
    lastUpdatedISO: LAST_UPDATED,
    blocks: [
      { type: 'paragraph', textKey: 'content.privacy.intro' },
      { type: 'heading', level: 2, textKey: 'content.privacy.e2eTitle' },
      { type: 'paragraph', textKey: 'content.privacy.e2eBody' },
      { type: 'heading', level: 2, textKey: 'content.privacy.storageTitle' },
      { type: 'paragraph', textKey: 'content.privacy.storageBody' },
      { type: 'heading', level: 2, textKey: 'content.privacy.rightsTitle' },
      { type: 'paragraph', textKey: 'content.privacy.rightsBody' },
    ],
  },

  terms: {
    titleKey: 'content.terms.title',
    lastUpdatedISO: LAST_UPDATED,
    blocks: [
      { type: 'paragraph', textKey: 'content.terms.preamble' },

      { type: 'heading', level: 2, textKey: 'content.terms.objectTitle' },
      { type: 'paragraph', textKey: 'content.terms.objectBody' },

      { type: 'heading', level: 2, textKey: 'content.terms.eligibilityTitle' },
      { type: 'paragraph', textKey: 'content.terms.eligibilityBody' },
      { type: 'bullet', textKey: 'content.terms.eligibilityBullet1' },
      { type: 'bullet', textKey: 'content.terms.eligibilityBullet2' },

      { type: 'heading', level: 2, textKey: 'content.terms.accountTitle' },
      { type: 'paragraph', textKey: 'content.terms.accountBody' },

      { type: 'heading', level: 2, textKey: 'content.terms.serviceTitle' },
      { type: 'paragraph', textKey: 'content.terms.serviceBody' },

      { type: 'heading', level: 2, textKey: 'content.terms.conductTitle' },
      { type: 'paragraph', textKey: 'content.terms.conductBody' },
      { type: 'bullet', textKey: 'content.terms.conductBullet1' },
      { type: 'bullet', textKey: 'content.terms.conductBullet2' },
      { type: 'bullet', textKey: 'content.terms.conductBullet3' },

      { type: 'heading', level: 2, textKey: 'content.terms.liabilityTitle' },
      { type: 'paragraph', textKey: 'content.terms.liabilityBody' },

      { type: 'heading', level: 2, textKey: 'content.terms.ipTitle' },
      { type: 'paragraph', textKey: 'content.terms.ipBody' },

      { type: 'heading', level: 2, textKey: 'content.terms.terminationTitle' },
      { type: 'paragraph', textKey: 'content.terms.terminationBody' },

      { type: 'heading', level: 2, textKey: 'content.terms.changesTitle' },
      { type: 'paragraph', textKey: 'content.terms.changesBody' },

      { type: 'heading', level: 2, textKey: 'content.terms.jurisdictionTitle' },
      { type: 'paragraph', textKey: 'content.terms.jurisdictionBody' },

      { type: 'heading', level: 2, textKey: 'content.terms.contactTitle' },
      { type: 'email', labelKey: 'content.terms.contactEmail', address: 'contact@jeleveux.app' },
    ],
  },

  privacyPolicy: {
    titleKey: 'content.privacyPolicy.title',
    lastUpdatedISO: LAST_UPDATED,
    blocks: [
      { type: 'paragraph', textKey: 'content.privacyPolicy.preamble' },

      { type: 'heading', level: 2, textKey: 'content.privacyPolicy.controllerTitle' },
      { type: 'paragraph', textKey: 'content.privacyPolicy.controllerBody' },

      { type: 'heading', level: 2, textKey: 'content.privacyPolicy.dataTitle' },
      { type: 'paragraph', textKey: 'content.privacyPolicy.dataBody' },
      { type: 'bullet', textKey: 'content.privacyPolicy.dataBullet1' },
      { type: 'bullet', textKey: 'content.privacyPolicy.dataBullet2' },
      { type: 'bullet', textKey: 'content.privacyPolicy.dataBullet3' },
      { type: 'bullet', textKey: 'content.privacyPolicy.dataBullet4' },

      { type: 'heading', level: 2, textKey: 'content.privacyPolicy.purposeTitle' },
      { type: 'paragraph', textKey: 'content.privacyPolicy.purposeBody' },

      { type: 'heading', level: 2, textKey: 'content.privacyPolicy.basisTitle' },
      { type: 'paragraph', textKey: 'content.privacyPolicy.basisBody' },

      { type: 'heading', level: 2, textKey: 'content.privacyPolicy.retentionTitle' },
      { type: 'paragraph', textKey: 'content.privacyPolicy.retentionBody' },

      { type: 'heading', level: 2, textKey: 'content.privacyPolicy.sharingTitle' },
      { type: 'paragraph', textKey: 'content.privacyPolicy.sharingBody' },

      { type: 'heading', level: 2, textKey: 'content.privacyPolicy.rightsTitle' },
      { type: 'paragraph', textKey: 'content.privacyPolicy.rightsBody' },
      { type: 'bullet', textKey: 'content.privacyPolicy.rightsAccess' },
      { type: 'bullet', textKey: 'content.privacyPolicy.rightsRectify' },
      { type: 'bullet', textKey: 'content.privacyPolicy.rightsErasure' },
      { type: 'bullet', textKey: 'content.privacyPolicy.rightsPortability' },
      { type: 'bullet', textKey: 'content.privacyPolicy.rightsOppose' },

      { type: 'heading', level: 2, textKey: 'content.privacyPolicy.securityTitle' },
      { type: 'paragraph', textKey: 'content.privacyPolicy.securityBody' },

      { type: 'heading', level: 2, textKey: 'content.privacyPolicy.contactTitle' },
      { type: 'email', labelKey: 'content.privacyPolicy.contactEmail', address: 'privacy@jeleveux.app' },
    ],
  },

  legalMentions: {
    titleKey: 'content.legalMentions.title',
    lastUpdatedISO: LAST_UPDATED,
    blocks: [
      { type: 'heading', level: 2, textKey: 'content.legalMentions.editorTitle' },
      { type: 'paragraph', textKey: 'content.legalMentions.editorBody' },

      { type: 'heading', level: 2, textKey: 'content.legalMentions.directorTitle' },
      { type: 'paragraph', textKey: 'content.legalMentions.directorBody' },

      { type: 'heading', level: 2, textKey: 'content.legalMentions.hostTitle' },
      { type: 'paragraph', textKey: 'content.legalMentions.hostBody' },

      { type: 'heading', level: 2, textKey: 'content.legalMentions.contactTitle' },
      { type: 'email', labelKey: 'content.legalMentions.contactEmail', address: 'contact@jeleveux.app' },
    ],
  },
};

export function getContentDocument(key: ContentKey): ContentDocument {
  return CONTENT_REGISTRY[key];
}
