import type { PropsWithChildren, ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing, type } from '../theme';

export function Screen({ children, scroll = true, padded = true }: PropsWithChildren<{ scroll?: boolean; padded?: boolean }>) {
  const content = padded ? <View style={styles.padded}>{children}</View> : children;
  return (
    <SafeAreaView style={styles.screen} edges={['bottom', 'left', 'right']}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

export function Title({ children }: PropsWithChildren) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Subtitle({ children }: PropsWithChildren) {
  return <Text style={styles.subtitle}>{children}</Text>;
}

export function Section({ title, hint, children, style }: PropsWithChildren<{ title?: string; hint?: string; style?: StyleProp<ViewStyle> }>) {
  return (
    <View style={[styles.section, style]}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      <View style={styles.card}>{children}</View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Row({
  label,
  value,
  onPress,
  right,
  destructive,
  accessibilityLabel,
}: {
  label: string;
  value?: string | null;
  onPress?: () => void;
  right?: ReactNode;
  destructive?: boolean;
  accessibilityLabel?: string;
}) {
  const inner = (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, destructive && { color: colors.danger }]} numberOfLines={2}>
        {label}
      </Text>
      <View style={styles.rowRight}>
        {value ? (
          <Text style={styles.rowValue} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        {right}
        {onPress ? <Text style={styles.chevron}>›</Text> : null}
      </View>
    </View>
  );
  if (!onPress) return inner;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {inner}
    </Pressable>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'spotify';

export function Button({
  title,
  onPress,
  variant = 'secondary',
  disabled,
  loading,
  accessibilityLabel,
  style,
}: {
  title: string;
  onPress: () => void | Promise<void>;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = buttonPalette(variant);
  return (
    <Pressable
      onPress={() => void onPress()}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: disabled || loading }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border },
        (disabled || loading) && styles.buttonDisabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={palette.text} /> : <Text style={[styles.buttonText, { color: palette.text }]}>{title}</Text>}
    </Pressable>
  );
}

function buttonPalette(variant: ButtonVariant): { bg: string; text: string; border: string } {
  switch (variant) {
    case 'primary':
      return { bg: colors.text, text: colors.bg, border: colors.text };
    case 'danger':
      return { bg: 'transparent', text: colors.danger, border: colors.danger };
    case 'spotify':
      return { bg: colors.spotify, text: '#04240F', border: colors.spotify };
    case 'ghost':
      return { bg: 'transparent', text: colors.accent, border: 'transparent' };
    case 'secondary':
    default:
      return { bg: colors.surface2, text: colors.text, border: colors.surface2 };
  }
}

export type PillStatus = 'ready' | 'attention' | 'blocked' | 'neutral' | 'active';

export function StatusPill({ status, label }: { status: PillStatus; label: string }) {
  const color =
    status === 'ready' ? colors.success : status === 'attention' ? colors.warning : status === 'blocked' ? colors.danger : status === 'active' ? colors.accent : colors.textMuted;
  return (
    <View style={[styles.pill, { borderColor: color }]} accessibilityLabel={`${label}: ${status}`}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

export function Mono({ children }: PropsWithChildren) {
  return (
    <Text selectable style={styles.mono}>
      {children}
    </Text>
  );
}

export function Note({ children, tone = 'dim' }: PropsWithChildren<{ tone?: 'dim' | 'warning' | 'danger' | 'success' }>) {
  const color = tone === 'warning' ? colors.warning : tone === 'danger' ? colors.danger : tone === 'success' ? colors.success : colors.textDim;
  return <Text style={[styles.note, { color }]}>{children}</Text>;
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { paddingBottom: spacing.xxl },
  padded: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.lg },
  title: { ...type.title, color: colors.text },
  subtitle: { ...type.body, color: colors.textDim, marginTop: spacing.xs },
  section: { gap: spacing.sm },
  sectionTitle: { ...type.caption, color: colors.textDim, textTransform: 'uppercase', letterSpacing: 1, marginLeft: spacing.xs },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' },
  hint: { ...type.caption, color: colors.textMuted, marginHorizontal: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, minHeight: 52, gap: spacing.md },
  rowLabel: { ...type.body, color: colors.text, flexShrink: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  rowValue: { ...type.body, color: colors.textDim, flexShrink: 1 },
  chevron: { color: colors.textMuted, fontSize: 22, marginTop: -2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: spacing.md },
  button: { minHeight: 50, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, borderWidth: 1 },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { ...type.body, fontWeight: '600' },
  pressed: { opacity: 0.7 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { ...type.caption, fontWeight: '600' },
  mono: { ...type.mono, color: colors.textDim, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), padding: spacing.md },
  note: { ...type.caption, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.md },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface2 },
  chipSelected: { backgroundColor: colors.text },
  chipText: { ...type.caption, color: colors.textDim, fontWeight: '600' },
  chipTextSelected: { color: colors.bg },
});
