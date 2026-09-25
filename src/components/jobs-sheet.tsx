import { useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { BottomSheet, Button } from './primitives';
import { colors, employmentColors, font } from '@/constants/theme';
import type { AppState, Employment } from '@/domain/model';
import { INPUT_LIMITS } from '@/domain/validation';

type EmploymentPatch = Partial<Pick<Employment, 'name' | 'color'>>;
type Props = {
  visible: boolean;
  state: AppState;
  onClose: () => void;
  onChange: (id: string, patch: EmploymentPatch) => Promise<boolean>;
  onAdd: () => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
};

export function JobsSheet({ visible, state, onClose, onChange, onAdd, onDelete }: Props) {
  const [adding, setAdding] = useState(false);
  const addingRef = useRef(false);

  const add = async () => {
    if (addingRef.current) return;
    addingRef.current = true;
    setAdding(true);
    try { await onAdd(); }
    finally { addingRef.current = false; setAdding(false); }
  };

  return <BottomSheet onClose={adding ? () => undefined : onClose} title="Arbeitsverhältnisse" visible={visible}>
    <Text style={styles.hint}>Jeder Job wird für sich ausgewertet: Zeiten, Zulagen und Abgleich bleiben getrennt. Oben wechselst du zwischen ihnen.</Text>
    <View>{state.employments.map((employment) => <EmploymentRow employment={employment} key={employment.id} onChange={onChange} onDelete={onDelete} showDelete={state.employments.length > 1} />)}</View>
    <Button disabled={adding} kind="line" onPress={() => { void add(); }}>＋ Arbeitsverhältnis hinzufügen</Button>
  </BottomSheet>;
}

function EmploymentRow({ employment, showDelete, onChange, onDelete }: { employment: Employment; showDelete: boolean; onChange: Props['onChange']; onDelete: Props['onDelete'] }) {
  const [name, setName] = useState(employment.name);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const days = Object.keys(employment.days).length;
  const allowances = employment.allowances.length;

  const change = async (patch: EmploymentPatch) => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    try { return await onChange(employment.id, patch); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const saveName = async () => {
    const normalized = name.trim();
    if (!normalized) { Alert.alert('Eingabe prüfen', 'Name: Bitte einen Namen für das Arbeitsverhältnis eingeben.'); setName(employment.name); return; }
    if (normalized.length > INPUT_LIMITS.employmentName) { Alert.alert('Eingabe prüfen', `Name: Maximal ${INPUT_LIMITS.employmentName} Zeichen sind erlaubt.`); setName(employment.name); return; }
    if (normalized === employment.name) { setName(normalized); return; }
    if (!await change({ name: normalized })) setName(employment.name);
  };
  const remove = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try { await onDelete(employment.id); }
    finally { savingRef.current = false; setSaving(false); }
  };

  return <View style={styles.row}>
    <View style={styles.top}>
      <TextInput editable={!saving} maxLength={INPUT_LIMITS.employmentName} onChangeText={setName} onEndEditing={() => { void saveName(); }} style={styles.input} value={name} />
      {showDelete ? <TouchableOpacity disabled={saving} onPress={() => Alert.alert(`„${employment.name}“ löschen?`, 'Alle zugehörigen Einträge werden gelöscht.', [{ text: 'Abbrechen' }, { text: 'Löschen', style: 'destructive', onPress: () => { void remove(); } }])} style={[styles.delete, saving && styles.disabled]}><Text style={styles.deleteText}>Löschen</Text></TouchableOpacity> : null}
    </View>
    <View style={styles.bottom}>
      <View style={styles.colors}>{employmentColors.map((color, index) => <TouchableOpacity accessibilityLabel={`Farbe ${index + 1}`} disabled={saving} key={color.main} onPress={() => { void change({ color: index }); }} style={[styles.color, { backgroundColor: color.main }, employment.color === index && styles.colorActive, saving && styles.disabled]} />)}</View>
      <Text style={styles.stats}>{days || allowances ? `${days} Arbeitstage${allowances ? ` · ${allowances} Zulagen` : ''} insgesamt` : 'Noch keine Einträge'}</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  hint: { color: colors.muted, fontFamily: font.medium, fontSize: 13, lineHeight: 19 }, row: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.line, gap: 10 }, top: { flexDirection: 'row', gap: 10 }, input: { flex: 1, height: 48, borderRadius: 14, paddingHorizontal: 14, backgroundColor: colors.soft, color: colors.ink, fontFamily: font.bold, fontSize: 16 }, delete: { height: 48, borderRadius: 14, backgroundColor: colors.badSoft, justifyContent: 'center', paddingHorizontal: 14 }, deleteText: { color: colors.bad, fontFamily: font.extraBold, fontSize: 13 }, bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, colors: { flexDirection: 'row', gap: 8 }, color: { width: 30, height: 30, borderRadius: 15, borderWidth: 3, borderColor: 'transparent' }, colorActive: { borderColor: colors.ink }, stats: { flex: 1, textAlign: 'right', color: colors.muted, fontFamily: font.bold, fontSize: 12 }, disabled: { opacity: 0.45 },
});
