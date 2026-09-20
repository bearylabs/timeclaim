import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { BottomSheet, Button } from './primitives';
import { colors, employmentColors, font } from '@/constants/theme';
import type { AppState, Employment } from '@/domain/model';

export function JobsSheet({ visible, state, onClose, onChange, onAdd, onDelete }: { visible: boolean; state: AppState; onClose: () => void; onChange: (id: string, patch: Partial<Employment>) => void; onAdd: () => void; onDelete: (id: string) => void }) {
  return <BottomSheet onClose={onClose} title="Arbeitsverhältnisse" visible={visible}>
    <Text style={styles.hint}>Jeder Job wird für sich ausgewertet: Zeiten, Zulagen und Abgleich bleiben getrennt. Oben wechselst du zwischen ihnen.</Text>
    <View>{state.employments.map((employment) => {
      const days = Object.keys(employment.days).length;
      const allowances = employment.allowances.length;
      return <View key={employment.id} style={styles.row}>
        <View style={styles.top}><TextInput onChangeText={(name) => onChange(employment.id, { name: name.trim() || 'Job' })} style={styles.input} value={employment.name} />{state.employments.length > 1 ? <TouchableOpacity onPress={() => Alert.alert(`„${employment.name}“ löschen?`, 'Alle zugehörigen Einträge werden gelöscht.', [{ text: 'Abbrechen' }, { text: 'Löschen', style: 'destructive', onPress: () => onDelete(employment.id) }])} style={styles.delete}><Text style={styles.deleteText}>Löschen</Text></TouchableOpacity> : null}</View>
        <View style={styles.bottom}><View style={styles.colors}>{employmentColors.map((color, index) => <TouchableOpacity accessibilityLabel={`Farbe ${index + 1}`} key={color.main} onPress={() => onChange(employment.id, { color: index })} style={[styles.color, { backgroundColor: color.main }, employment.color === index && styles.colorActive]} />)}</View><Text style={styles.stats}>{days || allowances ? `${days} Arbeitstage${allowances ? ` · ${allowances} Zulagen` : ''} insgesamt` : 'Noch keine Einträge'}</Text></View>
      </View>;
    })}</View>
    <Button kind="line" onPress={onAdd}>＋ Arbeitsverhältnis hinzufügen</Button>
  </BottomSheet>;
}
const styles = StyleSheet.create({
  hint: { color: colors.muted, fontFamily: font.medium, fontSize: 13, lineHeight: 19 }, row: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.line, gap: 10 }, top: { flexDirection: 'row', gap: 10 }, input: { flex: 1, height: 48, borderRadius: 14, paddingHorizontal: 14, backgroundColor: colors.soft, color: colors.ink, fontFamily: font.bold, fontSize: 16 }, delete: { height: 48, borderRadius: 14, backgroundColor: colors.badSoft, justifyContent: 'center', paddingHorizontal: 14 }, deleteText: { color: colors.bad, fontFamily: font.extraBold, fontSize: 13 }, bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, colors: { flexDirection: 'row', gap: 8 }, color: { width: 30, height: 30, borderRadius: 15, borderWidth: 3, borderColor: 'transparent' }, colorActive: { borderColor: colors.ink }, stats: { flex: 1, textAlign: 'right', color: colors.muted, fontFamily: font.bold, fontSize: 12 },
});
