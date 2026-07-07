/**
 * Block-level content types used by the ContentRegistry and ContentRenderer.
 * All text comes from i18n via textKey/labelKey; structure (block ordering
 * and type) is TypeScript code.
 */
export type ContentBlock =
  | { type: 'heading'; level: 1 | 2 | 3; textKey: string }
  | { type: 'paragraph'; textKey: string }
  | { type: 'bullet'; textKey: string }
  | { type: 'phone'; labelKey: string; number: string }
  | { type: 'email'; labelKey: string; address: string }
  | { type: 'link'; labelKey: string; url: string };

export interface ContentDocument {
  titleKey: string;
  /** ISO date (YYYY-MM-DD) of last edit, shown in the footer. */
  lastUpdatedISO: string;
  blocks: ContentBlock[];
}

export type ContentKey =
  | 'consent'
  | 'legalFramework'
  | 'helpline'
  | 'privacy'
  | 'terms'
  | 'privacyPolicy'
  | 'legalMentions';
