import { Ionicons } from '@expo/vector-icons';
import { type ComponentProps } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, font } from '@/constants/theme';
import { BottomSheet } from './primitives';

type MenuItemProps = {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
  onPress: () => void;
};

function MenuItem({ icon, title, description, onPress }: MenuItemProps) {
  return <TouchableOpacity accessibilityRole="button" activeOpacity={0.7} onPress={onPress} style={styles.item}>
    <View style={styles.icon}><Ionicons color={colors.accent} name={icon} size={22} /></View>
    <View style={styles.copy}><Text style={styles.title}>{title}</Text><Text style={styles.description}>{description}</Text></View>
    <Ionicons color={colors.muted} name="chevron-forward" size={20} />
  </TouchableOpacity>;
}

export function SettingsMenu({ visible, onClose, onOpenJobs, onOpenExport }: { visible: boolean; onClose: () => void; onOpenJobs: () => void; onOpenExport: () => void }) {
  return <BottomSheet onClose={onClose} title="Einstellungen" visible={visible}>
    <View style={styles.menu}>
      <MenuItem description="Jobs hinzufügen, umbenennen oder löschen" icon="briefcase-outline" onPress={onOpenJobs} title="Job-Einstellungen" />
      <View style={styles.divider} />
      <MenuItem description="Daten sichern, übertragen oder wiederherstellen" icon="download-outline" onPress={onOpenExport} title="Daten exportieren" />
    </View>
  </BottomSheet>;
}

const styles = StyleSheet.create({
  menu: { overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  item: { minHeight: 82, paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 13 },
  icon: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 3 },
  title: { color: colors.ink, fontFamily: font.extraBold, fontSize: 15.5 },
  description: { color: colors.muted, fontFamily: font.medium, fontSize: 12.5, lineHeight: 18 },
  divider: { height: 1, marginLeft: 71, backgroundColor: colors.line },
});
