export interface SectionConfig {
  slideDirection: "left" | "right" | "top" | "bottom";
  slideDuration: number;
  sourceType?: "multimedia" | "web" | "youtube" | "template";
  sourceUrl?: string;
  inputSourceType?: "multimedia" | "web" | "youtube" | "template";
  inputSourceUrl?: string;
  templateConfig?: any;
  templatePlaylist?: any[];
}

export interface TickerConfig {
  text: string;
  color: string;
  bgColor: string;
  speed: number;
  fontSize: number;
  fontFamily?: string;
  position: "top" | "bottom";
}

export interface CacheConfig {
  videoMB?: number;
}

export interface AppConfig {
  layout: "fullscreen" | "grid2" | "grid3";
  orientation:
    | "horizontal"
    | "vertical"
    | "reverse-horizontal"
    | "reverse-vertical";
  slideDuration: number;
  animation: "slide";
  bgColor: string;
  sections: SectionConfig[];
  ticker: TickerConfig;
  cache?: CacheConfig;
}
