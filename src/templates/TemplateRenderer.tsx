import React, { useMemo, useState } from "react";
import { Image, LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import type { TemplateInstance, TemplateRow } from "./templateTypes";

const TEMPLATE_ROW_GAP_MAX = 12;
const TEMPLATE_ROW_BOX_MAX = 7.6;
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
  };
}

function normalizeTemplate(template: any): TemplateInstance | null {
  if (!template || typeof template !== "object") return null;
  const templateId = String(template?.templateId || template?.id || "").trim();
  if (!templateId) return null;
  return {
    templateId,
    category: String(template?.category || ""),
    name: String(template?.name || "Template"),
    layout: String(template?.layout || "list-focus") as any,
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
    rowTextScale: Math.max(0.7, Math.min(2.6, Number(template?.rowTextScale || 1))),
    rowMetaScale: Math.max(0.7, Math.min(2.6, Number(template?.rowMetaScale || 1))),
    rowValueScale: Math.max(0.7, Math.min(2.8, Number(template?.rowValueScale || 1))),
    rowImageScale: Math.max(0.7, Math.min(2.4, Number(template?.rowImageScale || 1))),
    rowGapScale: Math.max(0.7, Math.min(TEMPLATE_ROW_GAP_MAX, Number(template?.rowGapScale || 1))),
    rowBoxScale: Math.max(0.7, Math.min(TEMPLATE_ROW_BOX_MAX, Number(template?.rowBoxScale || 1))),
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
  const bodyGap = Math.round((ultraCompact ? 10 : veryCrowded ? 12 : crowded ? 14 : sparseRows ? 16 : compact ? 16 : 18) * Number(safeTemplate.rowGapScale || 1));
  const rowBoxScale = Number(safeTemplate.rowBoxScale || 1);
  const rowVerticalPadding = Math.round((ultraCompact ? 7 : crowded ? 9 : 10) * Math.min(2.8, 0.92 + rowBoxScale * 0.26 + rowMetaScale * 0.08));
  const rowHorizontalPadding = ultraCompact ? 10 : crowded ? 12 : 14;
  const rowRadius = ultraCompact ? 10 : crowded ? 12 : 16;
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
  const rows = safeTemplate.rows.slice(0, 5);
  const nativeFontFamily = resolveNativeFontFamily(String(safeTemplate.fontFamily || "system"));
  const logoUri = String(safeTemplate.logoUrl || safeTemplate.imageUrl || "").trim();
  const backgroundImageUri = String(safeTemplate.backgroundImageUrl || "").trim();
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
  const rootPaddingH = ultraCompact ? 7 : crowded ? (compact ? 8 : 12) : compact ? 10 : 16;
  const rootPaddingV = ultraCompact ? 6 : crowded ? (compact ? 7 : 10) : compact ? 10 : 14;
  const headerMarginBottom = ultraCompact ? 6 : crowded ? (compact ? 6 : 8) : 10;
  const bodyTopGap = ultraCompact ? 4 : crowded ? (compact ? 6 : 8) : compact ? 8 : 12;
  const rowLabelLines = ultraCompact ? 1 : rowTextScale >= 2.6 ? 4 : rowTextScale >= 1.6 ? 3 : 2;
  const rowMetaLines = ultraCompact ? 1 : rowMetaScale >= 2.4 ? 5 : rowMetaScale >= 1.6 ? 4 : rowMetaScale >= 1.15 ? 3 : 2;
  const rowStatusLines = compact ? (rowMetaScale >= 1.5 ? 2 : 1) : rowMetaScale >= 2 ? 3 : rowMetaScale >= 1.2 ? 2 : 1;
  const titleLines = veryCrowded ? 2 : compact ? 3 : 4;
  const subtitleLines = veryCrowded ? 1 : ultraCompact ? 2 : compact ? 3 : 4;
  const metricColumns = singleColumnMetrics || (portrait && desiredRows >= 5) ? 1 : 2;
  const metricCardWidth = metricColumns === 1 ? "100%" : "48.6%";
  const headerEstimate = Math.max(
    logoSize,
    titleSize * titleLines * 1.05 + (safeTemplate.subtitleText ? subtitleSize * subtitleLines * 1.25 : 0)
  );
  const availableBodyHeight = Math.max(140, height - rootPaddingV * 2 - headerEstimate - headerMarginBottom - 8);
  const scheduleRowHeight = rows.length
    ? clamp(
        ((availableBodyHeight - bodyGap * Math.max(0, rows.length - 1)) / rows.length) * rowBoxScale,
        ultraCompact ? 58 : 92,
        compact ? 220 : 320
      )
    : 0;
  const metricRowsPerColumn = Math.max(1, Math.ceil(rows.length / metricColumns));
  const metricCardHeight = rows.length
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
              ? "rgba(4, 10, 16, 0.12)"
              : withAlpha(safeTemplate.backgroundColor, 0),
          },
        ]}
      />
      <View style={[styles.header, compact ? styles.headerCompact : null, { marginBottom: headerMarginBottom }]}>
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
          {logoUri ? (
            <Image source={{ uri: logoUri }} resizeMode="contain" style={styles.logoImage} />
          ) : (
            <Text style={[styles.logoFallback, { color: colors.secondary, fontSize: 12 * baseScale, fontFamily: nativeFontFamily }]}>
              {safeTemplate.category.slice(0, 3).toUpperCase()}
            </Text>
          )}
        </View>

        <View style={[styles.headerCopy, compact ? styles.headerCopyCompact : null]}>
          <Text numberOfLines={titleLines} style={[styles.title, { color: colors.primary, fontSize: titleSize, lineHeight: titleSize * 1.12, fontFamily: nativeFontFamily }]}>
            {safeTemplate.titleText}
          </Text>
          {!!safeTemplate.subtitleText && (
            <Text
              numberOfLines={subtitleLines}
              style={[styles.subtitle, { color: colors.muted, fontSize: subtitleSize, lineHeight: subtitleSize * 1.35, fontFamily: nativeFontFamily }]}
            >
              {safeTemplate.subtitleText}
            </Text>
          )}
        </View>

        {!!safeTemplate.badgeText && (
          <View
            style={[
              styles.badge,
              compact ? styles.badgeCompact : null,
              {
                backgroundColor: withAlpha(safeTemplate.primaryColor, 0.24),
                borderColor: colors.border,
              },
            ]}
          >
            <Text numberOfLines={1} style={[styles.badgeText, { color: colors.primary, fontSize: badgeSize, fontFamily: nativeFontFamily }]}>
              {safeTemplate.badgeText}
            </Text>
          </View>
        )}
      </View>

      {safeTemplate.layout === "schedule-board" ? (
        <View
          style={[
            styles.bodyWrap,
            styles.flowBody,
            { marginTop: bodyTopGap },
          ]}
        >
          {rows.map((row, index) => (
            <View
              key={`${row.label}-${index}`}
              style={[
                styles.boardRow,
                {
                  borderColor: colors.border,
                  borderRadius: rowRadius,
                  paddingHorizontal: rowHorizontalPadding,
                  paddingVertical: rowVerticalPadding,
                  minHeight: scheduleRowHeight,
                  marginBottom: index === rows.length - 1 ? 0 : bodyGap,
                },
              ]}
            >
              <View style={styles.rowMain}>
                <Text
                  numberOfLines={rowLabelLines}
                  style={[styles.rowLabel, { color: colors.secondary, fontSize: (compact ? 12 : 20) * baseScale * rowDensityScale * rowTextScale, lineHeight: (compact ? 12 : 20) * baseScale * rowDensityScale * rowTextScale * 1.15, fontFamily: nativeFontFamily }]}
                >
                  {row.label}
                </Text>
                <Text
                  numberOfLines={rowMetaLines}
                  style={[styles.rowMeta, { color: colors.muted, fontSize: (compact ? 8 : 12.5) * baseScale * rowDensityScale * rowMetaScale, lineHeight: (compact ? 8 : 12.5) * baseScale * rowDensityScale * rowMetaScale * 1.28, fontFamily: nativeFontFamily }]}
                >
                  {row.meta || " "}
                </Text>
              </View>
              <View style={[styles.rowSide, compact ? styles.rowSideCompact : null, { minWidth: rowSideWidth }]}>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.65}
                  style={[styles.rowValue, { color: colors.secondary, fontSize: (compact ? 13 : 22) * baseScale * rowDensityScale * rowValueScale, fontFamily: nativeFontFamily }]}
                >
                  {pickRowValue(row)}
                </Text>
                <Text
                  numberOfLines={rowStatusLines}
                  style={[styles.rowStatus, { color: colors.primary, fontSize: (compact ? 7.5 : 10.5) * baseScale * rowDensityScale * rowMetaScale, lineHeight: (compact ? 7.5 : 10.5) * baseScale * rowDensityScale * rowMetaScale * 1.15, fontFamily: nativeFontFamily }]}
                >
                  {row.status || " "}
                </Text>
              </View>
              {row.imageUrl ? (
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

      {(safeTemplate.layout === "list-focus" || safeTemplate.layout === "price-board") && (
        <View
          style={[
            styles.bodyWrap,
            styles.flowBody,
            { marginTop: bodyTopGap },
          ]}
        >
          {rows.map((row, index) => (
            <View
              key={`${row.label}-${index}`}
              style={[
                styles.listRow,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
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
                    style={[styles.listLabel, { color: colors.secondary, fontSize: (compact ? 11.5 : 18) * baseScale * rowDensityScale * rowTextScale, lineHeight: (compact ? 11.5 : 18) * baseScale * rowDensityScale * rowTextScale * 1.15, fontFamily: nativeFontFamily }]}
                  >
                    {row.label}
                  </Text>
                </View>
                <Text
                  numberOfLines={rowMetaLines}
                  style={[styles.listMeta, { color: colors.muted, fontSize: (compact ? 7.8 : 11.5) * baseScale * rowDensityScale * rowMetaScale, lineHeight: (compact ? 7.8 : 11.5) * baseScale * rowDensityScale * rowMetaScale * 1.28, fontFamily: nativeFontFamily }]}
                >
                  {row.meta || row.status || " "}
                </Text>
              </View>
              <View style={[styles.listSide, compact ? styles.rowSideCompact : null, { minWidth: rowSideWidth }]}>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.65}
                  style={[styles.listValue, { color: colors.primary, fontSize: (compact ? 12.5 : 20) * baseScale * rowDensityScale * rowValueScale, fontFamily: nativeFontFamily }]}
                >
                  {pickRowValue(row)}
                </Text>
                <Text
                  numberOfLines={rowStatusLines}
                  style={[styles.rowStatus, { color: colors.primary, fontSize: (compact ? 7.5 : 10.5) * baseScale * rowDensityScale * rowMetaScale, lineHeight: (compact ? 7.5 : 10.5) * baseScale * rowDensityScale * rowMetaScale * 1.15, fontFamily: nativeFontFamily }]}
                >
                  {row.status || " "}
                </Text>
              </View>
              {row.imageUrl ? (
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
      )}

      {safeTemplate.layout === "metric-cards" && (
        <View
          style={[
            styles.bodyWrap,
            styles.metricWrap,
            metricColumns === 1 ? styles.metricWrapSingle : null,
            { marginTop: bodyTopGap },
          ]}
        >
          {rows.map((row, index) => (
            <View
              key={`${row.label}-${index}`}
              style={[
                styles.metricCard,
                metricColumns === 1 ? styles.metricCardSingle : null,
                {
                  width: metricCardWidth,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  minHeight: metricCardHeight,
                  borderRadius: rowRadius + 2,
                  paddingHorizontal: rowHorizontalPadding,
                  paddingVertical: rowVerticalPadding,
                  marginBottom: index >= rows.length - metricColumns ? 0 : bodyGap,
                },
              ]}
            >
              <View style={styles.metricHead}>
                <Text
                  numberOfLines={rowMetaLines}
                  style={[styles.metricLabel, { color: colors.muted, fontSize: (compact ? 7.8 : 11.5) * baseScale * metricDensityScale * rowTextScale, lineHeight: (compact ? 7.8 : 11.5) * baseScale * metricDensityScale * rowTextScale * 1.15, fontFamily: nativeFontFamily }]}
                >
                  {row.label}
                </Text>
                {row.imageUrl ? (
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
                style={[styles.metricValue, { color: colors.secondary, fontSize: (ultraCompact ? 12 : compact ? 18 : 28) * baseScale * metricDensityScale * rowValueScale, fontFamily: nativeFontFamily }]}
              >
                {pickRowValue(row)}
              </Text>
              <Text
                numberOfLines={rowMetaLines}
                style={[styles.metricMeta, { color: colors.primary, fontSize: (compact ? 7.2 : 10.5) * baseScale * metricDensityScale * rowMetaScale, lineHeight: (compact ? 7.2 : 10.5) * baseScale * metricDensityScale * rowMetaScale * 1.28, fontFamily: nativeFontFamily }]}
              >
                {row.meta || row.status || " "}
              </Text>
            </View>
          ))}
        </View>
      )}
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
