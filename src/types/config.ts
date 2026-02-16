export interface SectionConfig {
  slideDirection: 'left' | 'right' | 'top' | 'bottom';
}

export interface TickerConfig {
  text: string;
  color: string;
  bgColor: string;
  speed: number;
  fontSize: number;
  position: 'top' | 'bottom';
}

export interface AppConfig {
  layout: 'fullscreen' | 'grid2' | 'grid3';
  orientation: 'horizontal' | 'vertical'; // ⭐ ADD THIS
  slideDuration: number;
  animation: 'slide';
  bgColor: string;

  sections: SectionConfig[];
  ticker: TickerConfig;
}
