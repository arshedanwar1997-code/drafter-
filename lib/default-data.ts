import {
  FeePreset,
  LegalClause,
  OrganizationSettings,
  ReportPayload,
  ReportTemplate,
} from './types';
import { generateDocumentId, generateReferenceNumber, todayIsoDate } from './text-utils';

export const DEFAULT_ORGANIZATION_SETTINGS: OrganizationSettings = {
  organizationName: 'LEGAL SUCCESS INDIA',
  subtitle: 'TRADEMARK & INTELLECTUAL PROPERTY SERVICES',
  advisoryDesignation: 'PRIVATE TRADEMARK ADVISORY REPORT',
  headerBannerImage: '',
  defaultJurisdiction: 'India',
  defaultPaymentMode: 'As specified in the service quotation',
  disclaimerText:
    'IMPORTANT: This is a privately prepared trademark advisory document for informational purposes. It is not an examination report, objection notice, refusal order, approval, acceptance letter or communication issued by the Trade Marks Registry or the Government of India. Trademark status and official requirements should be independently verified through the official IP India portal.',
  primaryColor: '#142F55',
  accentColor: '#B8A16A',
  footerLeft: 'LEGAL SUCCESS INDIA',
  footerCenter: 'Private Trademark Advisory Report',
};

export function createDefaultReportPayload(
  documentId = 'LSI-20261119-1001',
  reportReferenceNumber = 'TM/ADV/2026/10001',
  documentDate = todayIsoDate()
): ReportPayload {
  return {
    documentId,
    reportReferenceNumber,
    documentDate,
    headerLeftText: 'From: Legal Success India',
    preparedBy: 'Legal Success India',
    applicantName: '',
    organizationName: '',
    applicantAddress: '',

    brandName: 'ANZORA',
    applicationNumber: '8127206',
    trademarkClass: 'Class 35',
    applicationDate: '2026-10-14',
    applicationProvision: 'Section 11 – Relative Grounds for Refusal',
    currentStatus: 'Under Examination / Examiner Approval',
    subject: 'Section 11 – Relative Grounds for Refusal / Similarity Concern',
    examinationProcess: 'Examination and Response to Similarity Concern',
    applicableJurisdiction: 'India',
    examinerReference: '',

    earlierTrademarks: [
      {
        id: 'em-1',
        markName: 'ANZORA WITH DEVICE',
        applicationNumber: '3589553',
        registrationNumber: '3589553',
        trademarkClass: 'Class 35',
        proprietorName: 'Earlier Registered Proprietor',
        status: 'Registered',
        similarityType: 'Identical / Visual & Phonetic Similarity',
        similarityDescription:
          'Earlier mark contains the dominant element ANZORA in an overlapping goods/services class.',
      },
    ],

    heading: {
      text: 'TRADEMARK EXAMINATION & SECTION 11 ADVISORY NOTICE',
      fontSize: 16,
      bold: true,
      underline: true,
      alignment: 'left',
      uppercase: true,
    },

    salutation: 'Dear Proprietor,',
    openingParagraphs: [
      'This report has been prepared in connection with the trademark application for "[BRAND NAME]", bearing Application No. [APPLICATION NUMBER].',
      'The application details and potential similarity concern relating to the earlier trademark "[EARLIER TRADEMARK]", bearing Application No. [EARLIER APPLICATION NUMBER], are presented for the applicant\'s review.',
      'The information in this report is intended to explain the possible examination concerns and the supporting information that may be relevant when preparing a response.',
    ],

    sections: [
      {
        id: 'sec-1',
        number: '1',
        title: 'SECTION 11 – RELATIVE GROUNDS FOR REFUSAL',
        paragraphs: [
          'Under Section 11 of the Trade Marks Act, 1999, a trademark application may face an objection or refusal if the applied mark is identical or deceptively similar to an earlier registered or pending trademark and such similarity is likely to cause confusion or association among consumers.',
          'In the present case, the similarity between the marks [BRAND NAME] and [EARLIER TRADEMARK] requires appropriate examination and a legally supported response.',
        ],
        underlineHeading: true,
        isFeeSection: false,
      },
      {
        id: 'sec-2',
        number: '2',
        title: 'SUBMISSION OF SUPPORTING DOCUMENTS / CONSENT',
        paragraphs: [
          'The proprietor may consider providing relevant supporting documents, evidence of prior use, consent or authorization from the proprietor of the earlier trademark, where legally applicable, or other appropriate legal justification addressing the similarity concern.',
          'The submitted documents and response may be considered by the competent authority. Submission of supporting documents does not automatically guarantee withdrawal of an objection.',
        ],
        underlineHeading: true,
        isFeeSection: false,
      },
      {
        id: 'sec-3',
        number: '3',
        title: 'SECTION 11 – SERVICE CHARGES',
        paragraphs: [
          'Payment must be made only against an official quotation or invoice issued by the service provider. Government fees, if applicable, must be separately identified and supported by the relevant official payment particulars.',
        ],
        underlineHeading: true,
        isFeeSection: true,
      },
    ],

    adminVerified: true,

    fees: {
      professionalFee: 9500,
      governmentFee: 0,
      otherCharges: 0,
      discount: 0,
      gst: 0,
      amountPaid: 0,
      paymentReference: '',
      paymentDate: '',
      paymentMode: 'As specified in the service quotation',
      transactionId: '',
      paymentStatus: 'Unpaid',
    },

    styling: {
      includeHindiLabels: true,
      bodyFontSize: 9,
      lineSpacing: 1.2,
      primaryColor: '#142F55',
      accentColor: '#B8A16A',
      exportMode: 'standard',
    },

    reportStatus: 'Draft',
  };
}

export const INITIAL_TEMPLATES: Omit<ReportTemplate, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'tpl-sec11',
    name: 'Section 11 – Relative Grounds Advisory',
    description:
      'Standard A4 portrait advisory for Section 11 relative similarity concerns referencing earlier marks and service fees.',
    provision: 'Section 11 – Relative Grounds for Refusal',
    headingText: 'TRADEMARK EXAMINATION & SECTION 11 ADVISORY NOTICE',
    salutation: 'Dear Proprietor,',
    openingParagraphs: createDefaultReportPayload().openingParagraphs,
    sections: createDefaultReportPayload().sections,
    defaultProfessionalFee: 9500,
    defaultGovernmentFee: 0,
    isDefault: true,
  },
  {
    id: 'tpl-sec9',
    name: 'Section 9 – Absolute Grounds Advisory',
    description:
      'Advisory format for distinctiveness, descriptive character, or Section 9(1)(a)/(b) examination objections.',
    provision: 'Section 9 – Absolute Grounds for Refusal',
    headingText: 'TRADEMARK EXAMINATION & SECTION 9 ADVISORY NOTICE',
    salutation: 'Dear Proprietor,',
    openingParagraphs: [
      'This advisory report concerns the trademark application for "[BRAND NAME]", bearing Application No. [APPLICATION NUMBER], in respect of examination considerations under Section 9 of the Trade Marks Act, 1999.',
      'The key statutory requirements relating to distinctiveness and supporting evidence of acquired secondary meaning are outlined below for review.',
    ],
    sections: [
      {
        id: 'sec-9-1',
        number: '1',
        title: 'SECTION 9 – ABSOLUTE GROUNDS FOR REFUSAL',
        paragraphs: [
          'Under Section 9(1) of the Trade Marks Act, 1999, trademarks devoid of any distinctive character or consisting exclusively of marks or indications which designate kind, quality, quantity, intended purpose, or geographical origin may face examination objection.',
          'A structured reply demonstrating inherent distinctiveness or continuous prior commercial use of [BRAND NAME] may be prepared for submission.',
        ],
        underlineHeading: true,
        isFeeSection: false,
      },
      {
        id: 'sec-9-2',
        number: '2',
        title: 'SUPPORTING EVIDENCE OF USE & AFFIDAVIT',
        paragraphs: [
          'The applicant may compile invoices, promotional brochures, domain records, GST filings, and a duly notarized User Affidavit establishing continuous usage prior to the application date.',
          'All documents are subject to examination and verification by the competent authority.',
        ],
        underlineHeading: true,
        isFeeSection: false,
      },
      {
        id: 'sec-9-3',
        number: '3',
        title: 'SERVICE CHARGES',
        paragraphs: [
          'Professional legal drafting and reply filing charges are itemized below. Official government fees, if applicable, are billed separately with receipts.',
        ],
        underlineHeading: true,
        isFeeSection: true,
      },
    ],
    defaultProfessionalFee: 6500,
    defaultGovernmentFee: 0,
    isDefault: false,
  },
  {
    id: 'tpl-exam',
    name: 'Trademark Examination Advisory',
    description:
      'General examination stage advisory covering both formality compliance and substantive reply readiness.',
    provision: 'Section 18 – Application for Registration',
    headingText: 'TRADEMARK EXAMINATION ADVISORY REPORT',
    salutation: 'Dear Proprietor,',
    openingParagraphs: [
      'This private advisory summarizes the current examination posture of trademark application "[BRAND NAME]" (Application No. [APPLICATION NUMBER]).',
      'Recommended procedural steps and supporting documentation are detailed below.',
    ],
    sections: createDefaultReportPayload().sections,
    defaultProfessionalFee: 5500,
    defaultGovernmentFee: 0,
    isDefault: false,
  },
  {
    id: 'tpl-sim',
    name: 'Trademark Similarity Report',
    description:
      'Focused comparative similarity review comparing applied mark against cited earlier marks across phonetic and visual dimensions.',
    provision: 'Section 11 – Relative Grounds for Refusal',
    headingText: 'TRADEMARK SIMILARITY & SECTION 11 ADVISORY',
    salutation: 'Dear Proprietor,',
    openingParagraphs: createDefaultReportPayload().openingParagraphs,
    sections: createDefaultReportPayload().sections,
    defaultProfessionalFee: 9500,
    defaultGovernmentFee: 0,
    isDefault: false,
  },
  {
    id: 'tpl-gen',
    name: 'General Trademark Legal Advisory',
    description:
      'Flexible legal advisory report for Section 12 honest concurrent use, renewals, or general IP consultations.',
    provision: 'Section 12 – Honest Concurrent Use',
    headingText: 'PRIVATE TRADEMARK LEGAL ADVISORY REPORT',
    salutation: 'Dear Proprietor,',
    openingParagraphs: [
      'This report provides a structured trademark advisory for "[BRAND NAME]" (Application No. [APPLICATION NUMBER]) prepared by [PREPARED BY].',
      'Please review the statutory provisions, recommended documentation, and service fee schedule below.',
    ],
    sections: [
      {
        id: 'sec-g-1',
        number: '1',
        title: 'STATUTORY FRAMEWORK & CASE OVERVIEW',
        paragraphs: [
          'Under [APPLICABLE PROVISION] of the Trade Marks Act, 1999, applications undergo examination for compliance, distinctiveness, and potential conflict with earlier cited marks.',
          'Where honest concurrent use or distinct trade channels exist, detailed documentary justification strengthens the response.',
        ],
        underlineHeading: true,
        isFeeSection: false,
      },
      {
        id: 'sec-g-2',
        number: '2',
        title: 'DOCUMENTATION & CLIENT CONFIRMATION',
        paragraphs: [
          'Kindly share corroborating business records, prior-use invoices, or consent documentation as applicable for review prior to filing.',
        ],
        underlineHeading: true,
        isFeeSection: false,
      },
      {
        id: 'sec-g-3',
        number: '3',
        title: 'PROFESSIONAL & APPLICABLE CHARGES',
        paragraphs: [
          'Service charges apply strictly as per approved client quotation. Government statutory fees are accounted separately where applicable.',
        ],
        underlineHeading: true,
        isFeeSection: true,
      },
    ],
    defaultProfessionalFee: 7500,
    defaultGovernmentFee: 0,
    isDefault: false,
  },
];

export const INITIAL_LEGAL_CLAUSES: Omit<LegalClause, 'updatedAt'>[] = [
  {
    id: 'clause-1',
    title: 'Section 11 Relative Grounds Standard Explanation',
    category: 'Section 11',
    provision: 'Section 11 – Relative Grounds for Refusal',
    content:
      'Under Section 11 of the Trade Marks Act, 1999, a trademark application may face an objection or refusal if the applied mark is identical or deceptively similar to an earlier registered or pending trademark and such similarity is likely to cause confusion or association among consumers.',
  },
  {
    id: 'clause-2',
    title: 'Prior Use & Consent Justification',
    category: 'Evidence & Consent',
    provision: 'Section 11 – Relative Grounds for Refusal',
    content:
      'The proprietor may consider providing relevant supporting documents, evidence of prior use, consent or authorization from the proprietor of the earlier trademark, where legally applicable, or other appropriate legal justification addressing the similarity concern.',
  },
  {
    id: 'clause-3',
    title: 'No Guarantee of Automatic Withdrawal',
    category: 'Legal Caveat',
    provision: 'All Provisions',
    content:
      'The submitted documents and response may be considered by the competent authority. Submission of supporting documents does not automatically guarantee withdrawal of an objection.',
  },
  {
    id: 'clause-4',
    title: 'Section 9 Distinctiveness Explanation',
    category: 'Section 9',
    provision: 'Section 9 – Absolute Grounds for Refusal',
    content:
      'Under Section 9(1) of the Trade Marks Act, 1999, trademarks that lack distinctive character or describe the characteristics of goods or services require proof of acquired distinctiveness through extensive commercial use.',
  },
  {
    id: 'clause-5',
    title: 'Section 12 Honest Concurrent Use Clause',
    category: 'Section 12',
    provision: 'Section 12 – Honest Concurrent Use',
    content:
      'In case of honest concurrent use or other special circumstances, the Registrar may permit registration of identical or similar trademarks subject to appropriate conditions and limitations under Section 12.',
  },
  {
    id: 'clause-6',
    title: 'Fee Separation & Invoice Verification Clause',
    category: 'Fees & Billing',
    provision: 'All Provisions',
    content:
      'Payment must be made only against an official quotation or invoice issued by the service provider. Government fees, if applicable, must be separately identified and supported by the relevant official payment particulars.',
  },
];

export const INITIAL_FEE_PRESETS: Omit<FeePreset, 'updatedAt'>[] = [
  {
    id: 'fee-1',
    name: 'Section 11 Similarity Advisory & Reply Drafting',
    description: 'Standard professional advisory and examination reply drafting for Section 11 notices.',
    professionalFee: 9500,
    governmentFee: 0,
    otherCharges: 0,
    gst: 0,
  },
  {
    id: 'fee-2',
    name: 'Individual / MSME Trademark Filing + Advisory',
    description: 'Combined service fee with statutory MSME/Individual government filing fee (₹4,500).',
    professionalFee: 699,
    governmentFee: 4500,
    otherCharges: 0,
    gst: 0,
  },
  {
    id: 'fee-3',
    name: 'Show Cause Hearing Representation',
    description: 'Professional appearance and written submissions for trademark show-cause hearing.',
    professionalFee: 12500,
    governmentFee: 0,
    otherCharges: 0,
    gst: 0,
  },
  {
    id: 'fee-4',
    name: 'Corporate / Non-MSME Filing + Examination Reply',
    description: 'Standard corporate statutory filing fee (₹9,000) plus professional advisory fee.',
    professionalFee: 5500,
    governmentFee: 9000,
    otherCharges: 0,
    gst: 0,
  },
];
