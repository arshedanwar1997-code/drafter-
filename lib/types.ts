import { z } from 'zod';

export const ReportStatusEnum = z.enum(['Draft', 'Generated', 'Finalized', 'Archived']);
export type ReportStatus = z.infer<typeof ReportStatusEnum>;

export const PaymentStatusEnum = z.enum(['Unpaid', 'Partially Paid', 'Fully Paid']);
export type PaymentStatus = z.infer<typeof PaymentStatusEnum>;

export const ExportModeEnum = z.enum(['standard', 'fillable']);
export type ExportMode = z.infer<typeof ExportModeEnum>;

export const EarlierTrademarkSchema = z.object({
  id: z.string(),
  markName: z.string().default(''),
  applicationNumber: z.string().default(''),
  registrationNumber: z.string().default(''),
  trademarkClass: z.string().default(''),
  proprietorName: z.string().default(''),
  status: z.string().default('Registered'),
  similarityType: z.string().default('Phonetic & Visual Similarity'),
  similarityDescription: z.string().default(''),
});
export type EarlierTrademark = z.infer<typeof EarlierTrademarkSchema>;

export const LegalSectionSchema = z.object({
  id: z.string(),
  number: z.string(),
  title: z.string(),
  paragraphs: z.array(z.string()),
  underlineHeading: z.boolean().default(true),
  isFeeSection: z.boolean().default(false),
});
export type LegalSection = z.infer<typeof LegalSectionSchema>;

export const HeadingConfigSchema = z.object({
  text: z.string().min(1, 'Document heading is required'),
  fontSize: z.number().min(13).max(24).default(18),
  bold: z.boolean().default(true),
  underline: z.boolean().default(true),
  alignment: z.enum(['left', 'center']).default('left'),
  uppercase: z.boolean().default(true),
});
export type HeadingConfig = z.infer<typeof HeadingConfigSchema>;

export const FeeDetailsSchema = z.object({
  professionalFee: z.number().min(0).default(9500),
  governmentFee: z.number().min(0).default(0),
  otherCharges: z.number().min(0).default(0),
  discount: z.number().min(0).default(0),
  gst: z.number().min(0).default(0),
  amountPaid: z.number().min(0).default(0),
  paymentReference: z.string().default(''),
  paymentDate: z.string().default(''),
  paymentMode: z.string().default('As specified in the service quotation'),
  transactionId: z.string().default(''),
  paymentStatus: PaymentStatusEnum.default('Unpaid'),
});
export type FeeDetails = z.infer<typeof FeeDetailsSchema>;

export const DocumentStylingSchema = z.object({
  includeHindiLabels: z.boolean().default(true),
  bodyFontSize: z.number().min(8).max(11).default(9),
  lineSpacing: z.number().min(1.05).max(1.5).default(1.2),
  primaryColor: z.string().default('#142F55'),
  accentColor: z.string().default('#B8A16A'),
  exportMode: ExportModeEnum.default('standard'),
});
export type DocumentStyling = z.infer<typeof DocumentStylingSchema>;

export const ReportPayloadSchema = z.object({
  id: z.string().optional(),
  documentId: z.string().min(1),
  reportReferenceNumber: z.string().min(1),
  documentDate: z.string().min(1),
  headerLeftText: z.string().default('From: Legal Success India'),
  preparedBy: z.string().min(1).default('Legal Success India'),
  applicantName: z.string().default(''),
  organizationName: z.string().default(''),
  applicantAddress: z.string().default(''),

  brandName: z.string().min(1, 'Brand Name is required'),
  applicationNumber: z.string().min(1, 'Application Number is required'),
  trademarkClass: z.string().default(''),
  applicationDate: z.string().default(''),
  applicationProvision: z.string().default('Section 11 – Relative Grounds for Refusal'),
  currentStatus: z.string().default('Under Examination / Examiner Approval'),
  subject: z.string().default('Section 11 – Relative Grounds for Refusal / Similarity Concern'),
  examinationProcess: z.string().default('Examination and Response to Similarity Concern'),
  applicableJurisdiction: z.string().default('India'),
  examinerReference: z.string().default(''),

  earlierTrademarks: z.array(EarlierTrademarkSchema).min(1),
  heading: HeadingConfigSchema,

  salutation: z.string().default('Dear Proprietor,'),
  openingParagraphs: z.array(z.string()).min(1),
  sections: z.array(LegalSectionSchema),
  adminVerified: z.boolean().default(true),

  fees: FeeDetailsSchema,
  styling: DocumentStylingSchema,
  reportStatus: ReportStatusEnum.default('Draft'),
});
export type ReportPayload = z.infer<typeof ReportPayloadSchema>;

export interface SavedReport extends ReportPayload {
  id: string;
  pdfPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  provision: string;
  headingText: string;
  salutation: string;
  openingParagraphs: string[];
  sections: LegalSection[];
  defaultProfessionalFee: number;
  defaultGovernmentFee: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LegalClause {
  id: string;
  title: string;
  category: string;
  provision: string;
  content: string;
  updatedAt: string;
}

export interface FeePreset {
  id: string;
  name: string;
  description: string;
  professionalFee: number;
  governmentFee: number;
  otherCharges: number;
  gst: number;
  updatedAt: string;
}

export interface OrganizationSettings {
  organizationName: string;
  subtitle: string;
  advisoryDesignation: string;
  headerBannerImage?: string;
  defaultJurisdiction: string;
  defaultPaymentMode: string;
  disclaimerText: string;
  primaryColor: string;
  accentColor: string;
  footerLeft: string;
  footerCenter: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface DashboardStats {
  totalReports: number;
  reportsToday: number;
  reportsThisMonth: number;
  draftReports: number;
  completedReports: number;
  monthlySeries: { month: string; count: number }[];
  recentReports: SavedReport[];
  latestEditedReports: SavedReport[];
}
