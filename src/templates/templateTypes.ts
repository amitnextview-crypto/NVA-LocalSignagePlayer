export type TemplateLayout =
  | "schedule-board"
  | "list-focus"
  | "metric-cards"
  | "price-board";

export interface TemplateRow {
  label: string;
  value?: string;
  meta?: string;
  status?: string;
  price?: string;
  imageUrl?: string;
}

export interface TemplateInstance {
  templateId: string;
  category: string;
  name: string;
  layout: TemplateLayout;
  titleText: string;
  subtitleText: string;
  badgeText?: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  backgroundImageUrl?: string;
  fontScale?: number;
  titleScale?: number;
  subtitleScale?: number;
  badgeScale?: number;
  logoScale?: number;
  rowTextScale?: number;
  rowMetaScale?: number;
  rowValueScale?: number;
  rowImageScale?: number;
  rowGapScale?: number;
  rowBoxScale?: number;
  backgroundZoom?: number;
  logoUrl?: string;
  imageUrl?: string;
  rows: TemplateRow[];
}
