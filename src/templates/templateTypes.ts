export type TemplateLayout =
  | "schedule-board"
  | "list-focus"
  | "metric-cards"
  | "price-board"
  | "welcome-guest";

export interface TemplateRow {
  label: string;
  value?: string;
  meta?: string;
  status?: string;
  price?: string;
  imageUrl?: string;
  hidden?: boolean;
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
  fontFamily?: string;
  fontScale?: number;
  titleScale?: number;
  subtitleScale?: number;
  badgeScale?: number;
  logoScale?: number;
  titleColor?: string;
  titleBgColor?: string;
  subtitleColor?: string;
  subtitleBgColor?: string;
  badgeColor?: string;
  badgeBgColor?: string;
  rowTitleColor?: string;
  rowMetaColor?: string;
  rowValueColor?: string;
  rowStatusColor?: string;
  rowBoxBgColor?: string;
  rowBoxBorderColor?: string;
  showHeader?: boolean;
  showTitle?: boolean;
  showSubtitle?: boolean;
  showLogo?: boolean;
  showBadge?: boolean;
  showRows?: boolean;
  showRowImages?: boolean;
  showFeatureImage?: boolean;
  showBackgroundImage?: boolean;
  rowTextScale?: number;
  rowMetaScale?: number;
  rowValueScale?: number;
  rowImageScale?: number;
  rowGapScale?: number;
  rowBoxScale?: number;
  rowAnchor?: "top" | "middle" | "bottom";
  rowPaddingScale?: number;
  rowRadiusScale?: number;
  headerSpacingScale?: number;
  bodyTopScale?: number;
  canvasPaddingScale?: number;
  backgroundZoom?: number;
  logoUrl?: string;
  imageUrl?: string;
  rows: TemplateRow[];
}
