import { type ComponentProps, type PropsWithChildren, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, shadow } from '@/constants/theme';

export function RoundButton({ icon, onPress, label }: { icon: ComponentProps<typeof Ionicons>['name']; onPress: () => void; label: string }) {
  return <TouchableOpacity accessibilityLabel={label} activeOpacity={0.7} onPress={onPress} style={styles.round}><Ionicons color={colors.ink2} name={icon} size={21} /></TouchableOpacity>;
}

export function Card({ children, style }: PropsWithChildren<{ style?: object }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({ children, kind = 'primary', onPress, disabled = false }: PropsWithChildren<{ kind?: 'primary' | 'soft' | 'line' | 'danger'; onPress: () => void; disabled?: boolean }>) {
  return <TouchableOpacity activeOpacity={0.75} disabled={disabled} onPress={onPress} style={[styles.button, styles[`${kind}Button`], disabled && styles.disabled]}><Text style={[styles.buttonText, styles[`${kind}Text`]]}>{children}</Text></TouchableOpacity>;
}

export function SectionHeading({ children, right }: PropsWithChildren<{ right?: ReactNode }>) {
  return <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{children}</Text>{right}</View>;
}

export function BottomSheet({ visible, title, onClose, children }: PropsWithChildren<{ visible: boolean; title: string; onClose: () => void }>) {
  return <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.backdrop}>
      <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
      <View style={styles.sheet}>
        <View style={styles.grab} />
        <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>{title}</Text><TouchableOpacity onPress={onClose} style={styles.close}><Text style={styles.closeText}>Schließen</Text></TouchableOpacity></View>
        <ScrollView contentContainerStyle={styles.sheetBody} keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

export function Toast({ message, action, onAction }: { message: string | null; action?: string; onAction?: () => void }) {
  if (!message) return null;
  return <View style={styles.toast}><Text style={styles.toastText}>{message}</Text>{action ? <TouchableOpacity onPress={onAction}><Text style={styles.toastAction}>{action}</Text></TouchableOpacity> : null}</View>;
}

const styles = StyleSheet.create({
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadow },
  card: { backgroundColor: colors.card, borderRadius: 22, padding: 16, gap: 14, ...shadow },
  button: { minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  primaryButton: { backgroundColor: colors.accent }, softButton: { backgroundColor: colors.accentSoft }, lineButton: { backgroundColor: colors.soft }, dangerButton: { backgroundColor: colors.badSoft },
  buttonText: { fontFamily: font.extraBold, fontSize: 15.5 }, primaryText: { color: '#FFF' }, softText: { color: colors.accentDeep }, lineText: { color: colors.ink }, dangerText: { color: colors.bad }, disabled: { opacity: 0.4 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  sectionTitle: { fontFamily: font.extraBold, color: colors.ink, fontSize: 20, letterSpacing: -0.4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(13,20,36,0.42)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '93%', backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 20 },
  grab: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#D5DBEA', alignSelf: 'center', marginBottom: 12 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 16 },
  sheetTitle: { flex: 1, fontFamily: font.extraBold, color: colors.ink, fontSize: 22, letterSpacing: -0.4 },
  close: { minHeight: 36, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 12 }, closeText: { fontFamily: font.extraBold, color: colors.accent, fontSize: 14 },
  sheetBody: { gap: 16, paddingBottom: 24 },
  toast: { position: 'absolute', left: 16, right: 16, bottom: 96, zIndex: 40, borderRadius: 16, paddingVertical: 13, paddingHorizontal: 16, backgroundColor: colors.ink, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 14, ...shadow },
  toastText: { color: '#FFF', fontFamily: font.semiBold, fontSize: 14, flex: 1 }, toastAction: { color: '#9FB4FF', fontFamily: font.extraBold, fontSize: 14 },
});
