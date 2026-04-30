import React, { useMemo, useState } from "react";
import { Image, LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import type { TemplateInstance, TemplateRow } from "./templateTypes";

const TEMPLATE_ROW_GAP_MAX = 12;
const TEMPLATE_ROW_BOX_MAX = 7.6;
const TEMPLATE_ROW_ANCHORS = ["top", "middle", "bottom"] as const;
const TEMPLATE_FONT_MAP: Record<string, string> = {
  system: "sans-serif",
  roboto: "Roboto",
  segoe: "sans-serif",
  helvetica: "sans-serif",
  georgia: "serif",
  times: "serif",
  verdana: "sans-serif",
  trebuchet: "sans-serif",
  courier: "monospace",
  casual: "casual",
};

function resolveNativeFontFamily(value: string): string {
  const key = String(value || "").trim().toLowerCase();
  return TEMPLATE_FONT_MAP[key] || "sans-serif";
}

function withAlpha(hex: string, alpha: number) {
  const raw = String(hex || "#2563eb").replace("#", "").trim();
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
      : raw.padEnd(6, "0").slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function normalizeRow(row: any): TemplateRow {
  return {
    label: String(row?.label || ""),
    value: String(row?.value || ""),
    meta: String(row?.meta || ""),
    status: String(row?.status || ""),
    price: String(row?.price || ""),
    imageUrl: String(row?.imageUrl || ""),
    hidden: row?.hidden === true,
  };
}

function normalizeTemplate(template: any): TemplateInstance | null {
  if (!template || typeof template !== "object") return null;
  const templateId = String(template?.templateId || template?.id || "").trim();
  if (!templateId) return null;
  const layout = String(template?.layout || "list-focus");
  return {
    templateId,
    category: String(template?.category || ""),
    name: String(template?.name || "Template"),
    layout: layout as any,
    titleText: String(template?.titleText || ""),
    subtitleText: String(template?.subtitleText || ""),
    badgeText: String(template?.badgeText || ""),
    primaryColor: String(template?.primaryColor || "#2563eb"),
    secondaryColor: String(template?.secondaryColor || "#f4f7fb"),
    backgroundColor: String(template?.backgroundColor || "#08121b"),
    backgroundImageUrl: String(template?.backgroundImageUrl || ""),
    fontFamily: String(template?.fontFamily || "system"),
    fontScale: Math.max(0.7, Math.min(2, Number(template?.fontScale || 1))),
    titleScale: Math.max(0.7, Math.min(2.4, Number(template?.titleScale || 1))),
    subtitleScale: Math.max(0.7, Math.min(2.4, Number(template?.subtitleScale || 1))),
    badgeScale: Math.max(0.7, Math.min(2.4, Number(template?.badgeScale || 1))),
    logoScale: Math.max(0.7, Math.min(2.4, Number(template?.logoScale || 1))),
    titleColor: String(template?.titleColor || ""),
    titleBgColor: String(template?.titleBgColor || ""),
    subtitleColor: String(template?.subtitleColor || ""),
    subtitleBgColor: String(template?.subtitleBgColor || ""),
    badgeColor: String(template?.badgeColor || ""),
    badgeBgColor: String(template?.badgeBgColor || ""),
    rowTitleColor: String(template?.rowTitleColor || ""),
    rowMetaColor: String(template?.rowMetaColor || ""),
    rowValueColor: String(template?.rowValueColor || ""),
    rowStatusColor: String(template?.rowStatusColor || ""),
    rowBoxBgColor: String(template?.rowBoxBgColor || ""),
    rowBoxBorderColor: String(template?.rowBoxBorderColor || ""),
    showHeader: template?.showHeader === undefined ? layout !== "welcome-guest" : template?.showHeader !== false,
    showTitle: template?.showTitle !== false,
    showSubtitle: template?.showSubtitle !== false,
    showLogo: template?.showLogo !== false,
    showBadge: template?.showBadge !== false,
    showRows: template?.showRows !== false,
    showRowImages: template?.showRowImages !== false,
    showFeatureImage: template?.showFeatureImage !== false,
    showBackgroundImage: template?.showBackgroundImage !== false,
    rowTextScale: Math.max(0.7, Math.min(2.6, Number(template?.rowTextScale || 1))),
    rowMetaScale: Math.max(0.7, Math.min(2.6, Number(template?.rowMetaScale || 1))),
    rowValueScale: Math.max(0.7, Math.min(2.8, Number(template?.rowValueScale || 1))),
    rowImageScale: Math.max(0.7, Math.min(2.4, Number(template?.rowImageScale || 1))),
    rowGapScale: Math.max(0.7, Math.min(TEMPLATE_ROW_GAP_MAX, Number(template?.rowGapScale || 1))),
    rowBoxScale: Math.max(0.7, Math.min(TEMPLATE_ROW_BOX_MAX, Number(template?.rowBoxScale || 1))),
    rowAnchor: normalizeRowAnchor(template?.rowAnchor),
    rowPaddingScale: Math.max(0.7, Math.min(2.6, Number(template?.rowPaddingScale || 1))),
    rowRadiusScale: Math.max(0.7, Math.min(2.8, Number(template?.rowRadiusScale || 1))),
    headerSpacingScale: Math.max(0.6, Math.min(2.5, Number(template?.headerSpacingScale || 1))),
    bodyTopScale: Math.max(0.5, Math.min(3, Number(template?.bodyTopScale || 1))),
    canvasPaddingScale: Math.max(0.7, Math.min(2.4, Number(template?.canvasPaddingScale || 1))),
    backgroundZoom: Math.max(0.8, Math.min(1.8, Number(template?.backgroundZoom || 1))),
    logoUrl: String(template?.logoUrl || ""),
    imageUrl: String(template?.imageUrl || ""),
    rows: (Array.isArray(template?.rows) ? template.rows : []).slice(0, 5).map(normalizeRow),
  };
}

function pickRowValue(row: TemplateRow) {
  return row.value || row.price || "-";
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeRowAnchor(value: unknown): "top" | "middle" | "bottom" {
  const anchor = String(value || "top").trim().toLowerCase() as "top" | "middle" | "bottom";
  return TEMPLATE_ROW_ANCHORS.includes(anchor) ? anchor : "top";
}

function resolveVerticalJustify(anchor: "top" | "middle" | "bottom") {
  if (anchor === "bottom") return "flex-end";
  if (anchor === "middle") return "center";
  return "flex-start";
}

function getCategoryKicker(category: string) {
  const trimmed = String(category || "").trim();
  return trimmed || "Featured Template";
}

export default function TemplateRenderer({ template }: { template: any }) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const safeTemplate = useMemo(() => normalizeTemplate(template), [template]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const width = Math.max(0, Math.round(Number(event?.nativeEvent?.layout?.width || 0)));
    const height = Math.max(0, Math.round(Number(event?.nativeEvent?.layout?.height || 0)));
    setLayout((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  };

  if (!safeTemplate) {
    return (
      <View style={[styles.root, styles.emptyRoot]} onLayout={handleLayout}>
        <Text style={styles.emptyText}>Template unavailable</Text>
      </View>
    );
  }

  const width = layout.width || 1280;
  const height = layout.height || 720;
  const compact = width < 620 || height < 360;
  const ultraCompact = width < 400 || height < 250;
  const tall = height > width * 1.15;
  const singleColumnMetrics = ultraCompact || width < 460 || tall;
  const desiredRows = Math.min(5, Math.max(0, safeTemplate.rows.length));
  const crowded = desiredRows >= 4;
  const veryCrowded = desiredRows >= 5;
  const portrait = height > width;
  const spacious = width >= 1100 && height >= 620;
  const mediumLarge = width >= 840 && height >= 460;
  const sparseRows = desiredRows > 0 && desiredRows <= 3;
  const rowTextScale = Number(safeTemplate.rowTextScale || 1);
  const rowMetaScale = Number(safeTemplate.rowMetaScale || 1);
  const rowValueScale = Number(safeTemplate.rowValueScale || 1);
  const rowPaddingScale = Number(safeTemplate.rowPaddingScale || 1);
  const rowRadiusScale = Number(safeTemplate.rowRadiusScale || 1);
  const headerSpacingScale = Number(safeTemplate.headerSpacingScale || 1);
  const bodyTopScale = Number(safeTemplate.bodyTopScale || 1);
  const canvasPaddingScale = Number(safeTemplate.canvasPaddingScale || 1);
  const rowAnchor = normalizeRowAnchor(safeTemplate.rowAnchor);
  const bodyJustifyContent = resolveVerticalJustify(rowAnchor);
  const bodyGap = Math.round((ultraCompact ? 10 : veryCrowded ? 12 : crowded ? 14 : sparseRows ? 16 : compact ? 16 : 18) * Number(safeTemplate.rowGapScale || 1));
  const rowBoxScale = Number(safeTemplate.rowBoxScale || 1);
  const rowVerticalPadding = Math.round((ultraCompact ? 7 : crowded ? 9 : 10) * Math.min(2.8, 0.92 + rowBoxScale * 0.26 + rowMetaScale * 0.08) * rowPaddingScale);
  const rowHorizontalPadding = Math.round((ultraCompact ? 10 : crowded ? 12 : 14) * rowPaddingScale);
  const rowRadius = Math.round((ultraCompact ? 10 : crowded ? 12 : 16) * rowRadiusScale);
  const baseScale =
    Number(safeTemplate.fontScale || 1) *
    (ultraCompact ? 0.74 : compact ? 0.92 : tall ? 1.02 : spacious ? 1.28 : mediumLarge ? 1.14 : 1.02) *
    (veryCrowded ? (compact ? 0.82 : 0.9) : crowded ? (compact ? 0.9 : 0.98) : 1.08);
  const colors = {
    primary: safeTemplate.primaryColor,
    secondary: safeTemplate.secondaryColor,
    background: safeTemplate.backgroundColor,
    surface: withAlpha(safeTemplate.primaryColor, 0.16),
    border: withAlpha(safeTemplate.primaryColor, 0.34),
    muted: withAlpha(safeTemplate.secondaryColor, 0.72),
  };
  const customColors = {
    title: safeTemplate.titleColor || colors.primary,
    titleBg: safeTemplate.titleBgColor || "transparent",
    subtitle: safeTemplate.subtitleColor || colors.muted,
    subtitleBg: safeTemplate.subtitleBgColor || "transparent",
    badge: safeTemplate.badgeColor || colors.primary,
    badgeBg: safeTemplate.badgeBgColor || withAlpha(safeTemplate.primaryColor, 0.24),
    rowTitle: safeTemplate.rowTitleColor || colors.secondary,
    rowMeta: safeTemplate.rowMetaColor || colors.muted,
    rowValue: safeTemplate.rowValueColor || colors.secondary,
    rowStatus: safeTemplate.rowStatusColor || colors.primary,
    rowBoxBg: safeTemplate.rowBoxBgColor || colors.surface,
    rowBoxBorder: safeTemplate.rowBoxBorderColor || colors.border,
  };
  const rows = safeTemplate.rows.slice(0, 5).filter((row) => row.hidden !== true);
  const visibleRows = safeTemplate.showRows === false ? [] : rows;
  const nativeFontFamily = resolveNativeFontFamily(String(safeTemplate.fontFamily || "system"));
  const logoUri = String(safeTemplate.logoUrl || "").trim();
  const heroImageUri = safeTemplate.showFeatureImage === false ? "" : String(safeTemplate.imageUrl || safeTemplate.logoUrl || "").trim();
  const backgroundImageUri = safeTemplate.showBackgroundImage === false ? "" : String(safeTemplate.backgroundImageUrl || "").trim();
  const categoryKicker = getCategoryKicker(safeTemplate.category);
  const isWelcomeGuestLayout = safeTemplate.layout === "welcome-guest";
  const headerLogoUri = safeTemplate.showLogo === false ? "" : (logoUri || (!isWelcomeGuestLayout ? heroImageUri : ""));
  const logoSize = clamp((ultraCompact
    ? 26
    : veryCrowded
    ? (compact ? 42 : 56)
    : crowded
    ? (compact ? 50 : 64)
    : spacious
    ? 92
    : compact
    ? 58
    : tall
    ? 68
    : 76) * Number(safeTemplate.logoScale || 1), 28, 140);
  const titleSize = clamp((ultraCompact ? 16 : compact ? 22 : 30) * baseScale * Number(safeTemplate.titleScale || 1), 14, 72);
  const subtitleSize = clamp((ultraCompact ? 9.5 : compact ? 11.5 : 15) * baseScale * Number(safeTemplate.subtitleScale || 1), 8, 32);
  const badgeSize = clamp((ultraCompact ? 8.5 : 11) * baseScale * Number(safeTemplate.badgeScale || 1), 8, 24);
  const rootPaddingH = Math.round((ultraCompact ? 7 : crowded ? (compact ? 8 : 12) : compact ? 10 : 16) * canvasPaddingScale);
  const rootPaddingV = Math.round((ultraCompact ? 6 : crowded ? (compact ? 7 : 10) : compact ? 10 : 14) * canvasPaddingScale);
  const headerMarginBottom = Math.round((ultraCompact ? 6 : crowded ? (compact ? 6 : 8) : 10) * headerSpacingScale);
  const bodyTopGap = Math.round((ultraCompact ? 4 : crowded ? (compact ? 6 : 8) : compact ? 8 : 12) * bodyTopScale);
  const rowLabelLines = ultraCompact ? 1 : rowTextScale >= 2.6 ? 4 : rowTextScale >= 1.6 ? 3 : 2;
  const rowMetaLines = ultraCompact ? 1 : rowMetaScale >= 2.4 ? 5 : rowMetaScale >= 1.6 ? 4 : rowMetaScale >= 1.15 ? 3 : 2;
  const rowStatusLines = compact ? (rowMetaScale >= 1.5 ? 2 : 1) : rowMetaScale >= 2 ? 3 : rowMetaScale >= 1.2 ? 2 : 1;
  const titleLines = veryCrowded ? 2 : compact ? 3 : 4;
  const subtitleLines = veryCrowded ? 1 : ultraCompact ? 2 : compact ? 3 : 4;
  const metricColumns = singleColumnMetrics || (portrait && desiredRows >= 5) ? 1 : 2;
  const metricCardWidth = metricColumns === 1 ? "100%" : "48.6%";
  const headerEstimate = Math.max(
    safeTemplate.showLogo === false ? 0 : logoSize,
    titleSize * titleLines * 1.05 + (safeTemplate.subtitleText ? subtitleSize * subtitleLines * 1.25 : 0)
  );
  const availableBodyHeight = Math.max(140, height - rootPaddingV * 2 - headerEstimate - headerMarginBottom - 8);
      const scheduleRowHeight = visibleRows.length
    ? clamp(
        ((availableBodyHeight - bodyGap * Math.max(0, visibleRows.length - 1)) / visibleRows.length) * rowBoxScale,
        ultraCompact ? 58 : 92,
        compact ? 220 : 320
      )
    : 0;
  const metricRowsPerColumn = Math.max(1, Math.ceil(visibleRows.length / metricColumns));
  const metricCardHeight = visibleRows.length
    ? clamp(
        ((availableBodyHeight - bodyGap * Math.max(0, metricRowsPerColumn - 1)) / metricRowsPerColumn) * rowBoxScale,
        ultraCompact ? 64 : 96,
        compact ? 240 : 340
      )
    : 0;
  const rowDensityScale =
    scheduleRowHeight <= 70 ? 0.86 : scheduleRowHeight <= 92 ? 1 : scheduleRowHeight <= 120 ? 1.1 : 1.2;
  const metricDensityScale =
    metricCardHeight <= 76 ? 0.86 : metricCardHeight <= 104 ? 1 : metricCardHeight <= 148 ? 1.1 : 1.2;
  const rowImageSize = clamp((ultraCompact
    ? 32
    : compact
    ? crowded
      ? 62
      : 72
    : spacious
    ? crowded
      ? 88
      : 108
    : crowded
    ? 78
    : 92) * Number(safeTemplate.rowImageScale || 1), 36, 156);
  const rowSideWidth = clamp(
    (ultraCompact ? 70 : compact ? 94 : crowded ? 116 : 132) * Math.max(1, rowValueScale * 0.18 + rowMetaScale * 0.12),
    ultraCompact ? 70 : compact ? 94 : 116,
    compact ? 220 : 280
  );
  const guestImageWidth = clamp(width * (portrait ? 0.48 : compact ? 0.34 : 0.3), 120, portrait ? 320 : 360);
  const guestImageHeight = clamp(height * (portrait ? 0.34 : compact ? 0.54 : 0.66), 160, portrait ? 280 : 520);
  const detailCardWidth = portrait ? "100%" : heroImageUri ? "52%" : "100%";

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: backgroundImageUri ? "transparent" : colors.background,
          paddingHorizontal: rootPaddingH,
          paddingVertical: rootPaddingV,
        },
      ]}
      onLayout={handleLayout}
    >
      {backgroundImageUri ? (
        <Image
          source={{ uri: backgroundImageUri }}
          resizeMode="cover"
          style={[
            styles.backgroundImage,
            {
              transform: [{ scale: clamp(Number(safeTemplate.backgroundZoom || 1), 0.8, 1.8) }],
            },
          ]}
        />
      ) : null}
      <View
        style={[
          styles.backgroundScrim,
          {
            backgroundColor: backgroundImageUri
              ? "rgba(4, 10, 16, 0.2)"
              : withAlpha(safeTemplate.backgroundColor, 0.08),
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.posterGlow,
          {
            backgroundColor: withAlpha(safeTemplate.primaryColor, 0.18),
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.posterAccent,
          {
            backgroundColor: withAlpha(safeTemplate.primaryColor, 0.3),
          },
        ]}
      />
      {safeTemplate.showHeader !== false ? (
      <View style={[styles.header, compact ? styles.headerCompact : null, { marginBottom: headerMarginBottom }]}>
        {safeTemplate.showLogo !== false ? (
          <View
            style={[
              styles.logoWrap,
              {
                width: logoSize,
                height: logoSize,
                borderRadius: compact ? 14 : 18,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                marginRight: compact ? 10 : 14,
              },
            ]}
          >
            {headerLogoUri ? (
              <Image source={{ uri: headerLogoUri }} resizeMode="contain" style={styles.logoImage} />
            ) : (
              <Text style={[styles.logoFallback, { color: colors.secondary, fontSize: 12 * baseScale, fontFamily: nativeFontFamily }]}>
                {safeTemplate.category.slice(0, 3).toUpperCase()}
              </Text>
            )}
          </View>
        ) : null}

        <View style={[styles.headerCopy, compact ? styles.headerCopyCompact : null]}>
          <Text style={[styles.kicker, { color: colors.secondary, fontSize: badgeSize * 0.88, fontFamily: nativeFontFamily }]}>
            {categoryKicker}
          </Text>
          {safeTemplate.showTitle !== false ? (
          <Text numberOfLines={titleLines} style={[styles.title, { color: customColors.title, backgroundColor: customColors.titleBg, fontSize: titleSize, lineHeight: titleSize * 1.12, fontFamily: nativeFontFamily }]}>
            {safeTemplate.titleText}
          </Text>
          ) : null}
          {!!safeTemplate.subtitleText && safeTemplate.showSubtitle !== false && (
            <Text
              numberOfLines={subtitleLines}
              style={[styles.subtitle, { color: customColors.subtitle, backgroundColor: customColors.subtitleBg, fontSize: subtitleSize, lineHeight: subtitleSize * 1.35, fontFamily: nativeFontFamily }]}
            >
              {safeTemplate.subtitleText}
            </Text>
          )}
        </View>

        {!!safeTemplate.badgeText && safeTemplate.showBadge !== false && (
          <View
            style={[
              styles.badge,
              compact ? styles.badgeCompact : null,
              {
                backgroundColor: customColors.badgeBg,
                borderColor: colors.border,
              },
            ]}
          >
            <Text numberOfLines={1} style={[styles.badgeText, { color: customColors.badge, fontSize: badgeSize, fontFamily: nativeFontFamily }]}>
              {safeTemplate.badgeText}
            </Text>
          </View>
        )}
      </View>
      ) : null}

      {isWelcomeGuestLayout ? (
        <View
          style={[
            styles.bodyWrap,
            styles.guestPosterWrap,
            portrait ? styles.guestPosterWrapStack : null,
            { marginTop: bodyTopGap },
          ]}
        >
          <View style={[styles.guestPosterCopy, { width: detailCardWidth }]}>
            <View
              style={[
                styles.guestHeroCard,
                {
                  borderColor: colors.border,
                  backgroundColor: withAlpha(safeTemplate.backgroundColor, 0.32),
                  borderRadius: Math.round((compact ? 20 : 28) * rowRadiusScale),
                  paddingHorizontal: Math.round((compact ? 14 : 20) * rowPaddingScale),
                  paddingVertical: Math.round((compact ? 16 : 22) * rowPaddingScale),
                },
              ]}
            >
              {safeTemplate.showTitle !== false ? (
              <Text
                numberOfLines={compact ? 3 : 4}
                style={[
                  styles.guestHeroTitle,
                  {
                    color: customColors.title,
                    backgroundColor: customColors.titleBg,
                    fontSize: clamp(titleSize * 1.08, 20, 86),
                    lineHeight: clamp(titleSize * 1.08, 20, 86) * 1.05,
                    fontFamily: nativeFontFamily,
                  },
                ]}
              >
                {safeTemplate.titleText}
              </Text>
              ) : null}
              {!!safeTemplate.subtitleText && safeTemplate.showSubtitle !== false && (
                <Text
                  numberOfLines={compact ? 4 : 5}
                  style={[
                    styles.guestHeroSubtitle,
                    {
                      color: customColors.subtitle,
                      backgroundColor: customColors.subtitleBg,
                      fontSize: clamp(subtitleSize * 1.08, 10, 36),
                      lineHeight: clamp(subtitleSize * 1.08, 10, 36) * 1.34,
                      fontFamily: nativeFontFamily,
                    },
                  ]}
                >
                  {safeTemplate.subtitleText}
                </Text>
              )}
            </View>

            {visibleRows.length ? (
            <View style={[styles.guestDetailsShell, { justifyContent: bodyJustifyContent }]}>
              <View style={styles.guestDetailsGrid}>
              {visibleRows.map((row, index) => (
                <View
                  key={`${row.label}-${index}`}
                  style={[
                    styles.guestDetailCard,
                    {
                      borderColor: customColors.rowBoxBorder,
                      backgroundColor: customColors.rowBoxBg,
                      borderRadius: Math.round((compact ? 18 : 22) * rowRadiusScale),
                      paddingHorizontal: Math.round((compact ? 12 : 16) * rowPaddingScale),
                      paddingVertical: Math.round((compact ? 10 : 14) * rowPaddingScale),
                    },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.guestDetailLabel,
                      {
                        color: customColors.rowTitle,
                        fontSize: clamp((compact ? 10 : 12) * baseScale * rowMetaScale, 9, 26),
                        fontFamily: nativeFontFamily,
                      },
                    ]}
                  >
                    {row.label}
                  </Text>
                  <Text
                    numberOfLines={2}
                    style={[
                      styles.guestDetailValue,
                      {
                        color: customColors.rowValue,
                        fontSize: clamp((compact ? 13 : 20) * baseScale * rowValueScale, 11, 38),
                        lineHeight: clamp((compact ? 13 : 20) * baseScale * rowValueScale, 11, 38) * 1.12,
                        fontFamily: nativeFontFamily,
                      },
                    ]}
                  >
                    {pickRowValue(row)}
                  </Text>
                  {!!(row.meta || row.status) && (
                    <Text
                      numberOfLines={2}
                      style={[
                        styles.guestDetailMeta,
                        {
                          color: customColors.rowMeta,
                          fontSize: clamp((compact ? 8 : 11) * baseScale * rowMetaScale, 8, 24),
                          lineHeight: clamp((compact ? 8 : 11) * baseScale * rowMetaScale, 8, 24) * 1.3,
                          fontFamily: nativeFontFamily,
                        },
                      ]}
                    >
                      {row.meta || row.status}
                    </Text>
                  )}
                </View>
              ))}
              </View>
            </View>
            ) : null}
          </View>

          {heroImageUri ? (
            <View
              style={[
                styles.guestImageShell,
                {
                  width: guestImageWidth,
                  height: guestImageHeight,
                  borderColor: colors.border,
                  backgroundColor: withAlpha(safeTemplate.primaryColor, 0.12),
                },
              ]}
            >
              <Image source={{ uri: heroImageUri }} resizeMode="cover" style={styles.guestImage} />
              <View
                pointerEvents="none"
                style={[
                  styles.guestImageOverlay,
                  {
                    backgroundColor: withAlpha(safeTemplate.backgroundColor, 0.1),
                  },
                ]}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {safeTemplate.layout === "schedule-board" && visibleRows.length ? (
        <View
          style={[
            styles.bodyWrap,
            styles.flowBody,
            { marginTop: bodyTopGap, justifyContent: bodyJustifyContent },
          ]}
        >
          {visibleRows.map((row, index) => (
            <View
              key={`${row.label}-${index}`}
              style={[
                styles.boardRow,
                {
                  borderColor: customColors.rowBoxBorder,
                  borderRadius: rowRadius,
                  paddingHorizontal: rowHorizontalPadding,
                  paddingVertical: rowVerticalPadding,
                  minHeight: scheduleRowHeight,
                  backgroundColor: customColors.rowBoxBg,
                  marginBottom: index === rows.length - 1 ? 0 : bodyGap,
                },
              ]}
            >
              <View style={styles.rowMain}>
                <Text
                  numberOfLines={rowLabelLines}
                  style={[styles.rowLabel, { color: customColors.rowTitle, fontSize: (compact ? 12 : 20) * baseScale * rowDensityScale * rowTextScale, lineHeight: (compact ? 12 : 20) * baseScale * rowDensityScale * rowTextScale * 1.15, fontFamily: nativeFontFamily }]}
                >
                  {row.label}
                </Text>
                <Text
                  numberOfLines={rowMetaLines}
                  style={[styles.rowMeta, { color: customColors.rowMeta, fontSize: (compact ? 8 : 12.5) * baseScale * rowDensityScale * rowMetaScale, lineHeight: (compact ? 8 : 12.5) * baseScale * rowDensityScale * rowMetaScale * 1.28, fontFamily: nativeFontFamily }]}
                >
                  {row.meta || " "}
                </Text>
              </View>
              <View style={[styles.rowSide, compact ? styles.rowSideCompact : null, { minWidth: rowSideWidth }]}>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.65}
                  style={[styles.rowValue, { color: customColors.rowValue, fontSize: (compact ? 13 : 22) * baseScale * rowDensityScale * rowValueScale, fontFamily: nativeFontFamily }]}
                >
                  {pickRowValue(row)}
                </Text>
                <Text
                  numberOfLines={rowStatusLines}
                  style={[styles.rowStatus, { color: customColors.rowStatus, fontSize: (compact ? 7.5 : 10.5) * baseScale * rowDensityScale * rowMetaScale, lineHeight: (compact ? 7.5 : 10.5) * baseScale * rowDensityScale * rowMetaScale * 1.15, fontFamily: nativeFontFamily }]}
                >
                  {row.status || " "}
                </Text>
              </View>
              {safeTemplate.showRowImages !== false && row.imageUrl ? (
                <View
                  style={[
                    styles.rowImageWrap,
                    {
                      width: rowImageSize,
                      height: rowImageSize,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Image source={{ uri: row.imageUrl }} resizeMode="cover" style={styles.rowImage} />
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {(safeTemplate.layout === "list-focus" || safeTemplate.layout === "price-board") && visibleRows.length ? (
        <View
          style={[
            styles.bodyWrap,
            styles.flowBody,
            { marginTop: bodyTopGap, justifyContent: bodyJustifyContent },
          ]}
        >
          {visibleRows.map((row, index) => (
            <View
              key={`${row.label}-${index}`}
              style={[
                styles.listRow,
                {
                  backgroundColor: customColors.rowBoxBg,
                  borderColor: customColors.rowBoxBorder,
                  borderRadius: rowRadius,
                  paddingHorizontal: rowHorizontalPadding,
                  paddingVertical: rowVerticalPadding,
                  minHeight: scheduleRowHeight,
                  marginBottom: index === rows.length - 1 ? 0 : bodyGap,
                },
              ]}
            >
              <View style={styles.listMain}>
                <View style={styles.listTopRow}>
                  <Text
                    numberOfLines={rowLabelLines}
                    style={[styles.listLabel, { color: customColors.rowTitle, fontSize: (compact ? 11.5 : 18) * baseScale * rowDensityScale * rowTextScale, lineHeight: (compact ? 11.5 : 18) * baseScale * rowDensityScale * rowTextScale * 1.15, fontFamily: nativeFontFamily }]}
                  >
                    {row.label}
                  </Text>
                </View>
                <Text
                  numberOfLines={rowMetaLines}
                  style={[styles.listMeta, { color: customColors.rowMeta, fontSize: (compact ? 7.8 : 11.5) * baseScale * rowDensityScale * rowMetaScale, lineHeight: (compact ? 7.8 : 11.5) * baseScale * rowDensityScale * rowMetaScale * 1.28, fontFamily: nativeFontFamily }]}
                >
                  {row.meta || row.status || " "}
                </Text>
              </View>
              <View style={[styles.listSide, compact ? styles.rowSideCompact : null, { minWidth: rowSideWidth }]}>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.65}
                  style={[styles.listValue, { color: customColors.rowValue, fontSize: (compact ? 12.5 : 20) * baseScale * rowDensityScale * rowValueScale, fontFamily: nativeFontFamily }]}
                >
                  {pickRowValue(row)}
                </Text>
                <Text
                  numberOfLines={rowStatusLines}
                  style={[styles.rowStatus, { color: customColors.rowStatus, fontSize: (compact ? 7.5 : 10.5) * baseScale * rowDensityScale * rowMetaScale, lineHeight: (compact ? 7.5 : 10.5) * baseScale * rowDensityScale * rowMetaScale * 1.15, fontFamily: nativeFontFamily }]}
                >
                  {row.status || " "}
                </Text>
              </View>
              {safeTemplate.showRowImages !== false && row.imageUrl ? (
                <View
                  style={[
                    styles.rowImageWrap,
                    {
                      width: rowImageSize,
                      height: rowImageSize,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Image source={{ uri: row.imageUrl }} resizeMode="cover" style={styles.rowImage} />
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {safeTemplate.layout === "metric-cards" && visibleRows.length ? (
        <View
          style={[
            styles.bodyWrap,
            styles.metricWrap,
            metricColumns === 1 ? styles.metricWrapSingle : null,
            { marginTop: bodyTopGap, alignContent: rowAnchor === "middle" ? "center" : rowAnchor === "bottom" ? "flex-end" : "flex-start" },
          ]}
        >
          {visibleRows.map((row, index) => (
            <View
              key={`${row.label}-${index}`}
              style={[
                styles.metricCard,
                metricColumns === 1 ? styles.metricCardSingle : null,
                {
                  width: metricCardWidth,
                  borderColor: customColors.rowBoxBorder,
                  backgroundColor: customColors.rowBoxBg,
                  minHeight: metricCardHeight,
                  borderRadius: rowRadius + Math.max(1, Math.round(rowRadiusScale * 2)),
                  paddingHorizontal: rowHorizontalPadding,
                  paddingVertical: rowVerticalPadding,
                  marginBottom: index >= rows.length - metricColumns ? 0 : bodyGap,
                },
              ]}
            >
              <View style={styles.metricHead}>
                <Text
                  numberOfLines={rowMetaLines}
                  style={[styles.metricLabel, { color: customColors.rowTitle, fontSize: (compact ? 7.8 : 11.5) * baseScale * metricDensityScale * rowTextScale, lineHeight: (compact ? 7.8 : 11.5) * baseScale * metricDensityScale * rowTextScale * 1.15, fontFamily: nativeFontFamily }]}
                >
                  {row.label}
                </Text>
                {safeTemplate.showRowImages !== false && row.imageUrl ? (
                  <View
                    style={[
                      styles.metricImageWrap,
                      {
                        width: rowImageSize * 0.82,
                        height: rowImageSize * 0.82,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Image source={{ uri: row.imageUrl }} resizeMode="cover" style={styles.rowImage} />
                  </View>
                ) : null}
              </View>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.65}
                style={[styles.metricValue, { color: customColors.rowValue, fontSize: (ultraCompact ? 12 : compact ? 18 : 28) * baseScale * metricDensityScale * rowValueScale, fontFamily: nativeFontFamily }]}
              >
                {pickRowValue(row)}
              </Text>
              <Text
                numberOfLines={rowMetaLines}
                style={[styles.metricMeta, { color: customColors.rowMeta, fontSize: (compact ? 7.2 : 10.5) * baseScale * metricDensityScale * rowMetaScale, lineHeight: (compact ? 7.2 : 10.5) * baseScale * metricDensityScale * rowMetaScale * 1.28, fontFamily: nativeFontFamily }]}
              >
                {row.meta || row.status || " "}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  posterGlow: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 999,
    top: -80,
    right: -70,
    opacity: 0.9,
  },
  posterAccent: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 44,
    bottom: -70,
    left: -90,
    transform: [{ rotate: "-24deg" }],
    opacity: 0.45,
  },
  emptyRoot: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#08121b",
  },
  emptyText: {
    color: "#f4f7fb",
    fontSize: 18,
    fontWeight: "700",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  headerCompact: {
    marginBottom: 10,
  },
  logoWrap: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoImage: {
    width: "100%",
    height: "100%",
  },
  logoFallback: {
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    paddingTop: 2,
    paddingRight: 10,
  },
  headerCopyCompact: {
    paddingRight: 6,
  },
  kicker: {
    marginBottom: 6,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  title: {
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 4,
    fontWeight: "500",
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
    maxWidth: "42%",
  },
  badgeCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: "42%",
  },
  badgeText: {
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  bodyWrap: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  flowBody: {
    justifyContent: "flex-start",
  },
  guestPosterWrap: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: 18,
  },
  guestPosterWrapStack: {
    flexDirection: "column-reverse",
  },
  guestPosterCopy: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  },
  guestHeroCard: {
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 22,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  guestHeroTitle: {
    fontWeight: "900",
  },
  guestHeroSubtitle: {
    marginTop: 10,
    fontWeight: "500",
  },
  guestDetailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 16,
  },
  guestDetailsShell: {
    flex: 1,
    minHeight: 0,
  },
  guestDetailCard: {
    minWidth: 160,
    flexGrow: 1,
    flexBasis: "30%",
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  guestDetailLabel: {
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  guestDetailValue: {
    marginTop: 8,
    fontWeight: "800",
  },
  guestDetailMeta: {
    marginTop: 8,
    fontWeight: "500",
  },
  guestImageShell: {
    alignSelf: "flex-end",
    borderWidth: 1,
    borderRadius: 34,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.34,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  },
  guestImage: {
    width: "100%",
    height: "100%",
  },
  guestImageOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  balancedBody: {
    justifyContent: "flex-start",
    alignContent: "flex-start",
  },
  fillBody: {
    justifyContent: "space-between",
  },
  boardRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.02)",
    marginBottom: 6,
  },
  boardRowFill: {
    flex: 1,
    minHeight: 0,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
    justifyContent: "center",
  },
  rowLabel: {
    fontWeight: "700",
    flexShrink: 1,
  },
  rowMeta: {
    marginTop: 4,
    flexShrink: 1,
  },
  rowSide: {
    minWidth: 64,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowSideCompact: {
    minWidth: 52,
  },
  rowValue: {
    fontWeight: "800",
  },
  rowStatus: {
    marginTop: 4,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  listRow: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
    justifyContent: "center",
  },
  listRowFill: {
    flex: 1,
    minHeight: 0,
  },
  listTopRow: {
    minWidth: 0,
  },
  listMain: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  listSide: {
    minWidth: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  listLabel: {
    flex: 1,
    minWidth: 0,
    fontWeight: "700",
    flexShrink: 1,
  },
  listValue: {
    fontWeight: "800",
  },
  listMeta: {
    marginTop: 4,
    flexShrink: 1,
  },
  rowImageWrap: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  rowImage: {
    width: "100%",
    height: "100%",
  },
  metricWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignContent: "flex-start",
  },
  metricWrapSingle: {
    flexDirection: "column",
    flexWrap: "nowrap",
  },
  metricCard: {
    width: "48.2%",
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    justifyContent: "space-between",
  },
  metricCardFill: {
    flexGrow: 1,
    minHeight: 0,
  },
  metricCardSingle: {
    width: "100%",
  },
  metricLabel: {
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.75,
    flex: 1,
    flexShrink: 1,
  },
  metricHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  metricValue: {
    marginTop: 10,
    fontWeight: "800",
  },
  metricMeta: {
    marginTop: 8,
    fontWeight: "600",
    flexShrink: 1,
  },
  metricImageWrap: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
});
