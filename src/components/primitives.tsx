import { createContext, type ComponentProps, type PropsWithChildren, type ReactNode, useContext } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

const ModalOverlayContext = createContext<ReactNode>(null);

export function ModalOverlayProvider({ children, overlay }: PropsWithChildren<{ overlay: ReactNode }>) {
  return <ModalOverlayContext.Provider value={overlay}>{children}</ModalOverlayContext.Provider>;
}

type BottomSheetProps = PropsWithChildren<{ visible: boolean; title: string; onClose: () => void; dismissible?: boolean; closeIcon?: 'close' | 'back'; animationType?: 'none' | 'slide' | 'fade'; inline?: boolean }>;

export function BottomSheet({ visible, title, onClose, dismissible = true, closeIcon = 'close', animationType = 'slide', inline = false, children }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const overlay = useContext(ModalOverlayContext);
  if (inline) return visible ? <>{children}</> : null;
  const close = () => { if (dismissible) onClose(); };
  const safeArea = { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 0), paddingBottom: insets.bottom };

  return <Modal animationType={animationType} onRequestClose={close} presentationStyle="fullScreen" visible={visible}>
    <View style={[styles.modalScreen, safeArea]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalScreen}>
        <View style={styles.modalHeader}>
          <TouchableOpacity accessibilityLabel={closeIcon === 'back' ? 'Zurück' : 'Schließen'} accessibilityRole="button" disabled={!dismissible} onPress={close} style={[styles.back, !dismissible && styles.disabled]}>
            <Ionicons color={colors.ink} name={closeIcon === 'back' ? 'chevron-back' : 'close'} size={27} />
          </TouchableOpacity>
          <Text numberOfLines={1} style={styles.modalTitle}>{title}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ScrollView contentContainerStyle={styles.modalBody} keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
      </KeyboardAvoidingView>
      {overlay}
    </View>
  </Modal>;
}

export function Toast({ message, action, onAction, actionDisabled = false }: { message: string | null; action?: string; onAction?: () => void; actionDisabled?: boolean }) {
  if (!message) return null;
  return <View style={styles.toast}><Text style={styles.toastText}>{message}</Text>{action ? <TouchableOpacity disabled={actionDisabled} onPress={onAction} style={actionDisabled && styles.disabled}><Text style={styles.toastAction}>{action}</Text></TouchableOpacity> : null}</View>;
}

const styles = StyleSheet.create({
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadow },
  card: { backgroundColor: colors.card, borderRadius: 22, padding: 16, gap: 14, ...shadow },
  button: { minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  primaryButton: { backgroundColor: colors.accent }, softButton: { backgroundColor: colors.accentSoft }, lineButton: { backgroundColor: colors.soft }, dangerButton: { backgroundColor: colors.badSoft },
  buttonText: { fontFamily: font.extraBold, fontSize: 15.5 }, primaryText: { color: '#FFF' }, softText: { color: colors.accentDeep }, lineText: { color: colors.ink }, dangerText: { color: colors.bad }, disabled: { opacity: 0.4 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  sectionTitle: { fontFamily: font.extraBold, color: colors.ink, fontSize: 20, letterSpacing: -0.4 },
  modalScreen: { flex: 1, backgroundColor: colors.card },
  modalHeader: { minHeight: 62, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 8 },
  back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { flex: 1, fontFamily: font.extraBold, color: colors.ink, fontSize: 20, letterSpacing: -0.3, textAlign: 'center' },
  headerSpacer: { width: 48 },
  modalBody: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: 16, paddingHorizontal: 18, paddingTop: 20, paddingBottom: 36 },
  toast: { position: 'absolute', left: 16, right: 16, bottom: 96, zIndex: 40, borderRadius: 16, paddingVertical: 13, paddingHorizontal: 16, backgroundColor: colors.ink, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 14, ...shadow },
  toastText: { color: '#FFF', fontFamily: font.semiBold, fontSize: 14, flex: 1 }, toastAction: { color: '#9FB4FF', fontFamily: font.extraBold, fontSize: 14 },
});
