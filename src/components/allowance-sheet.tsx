import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { BottomSheet, Button } from './primitives';
import { colors, font } from '@/constants/theme';
import { MAIN_ALLOWANCES, type Allowance } from '@/domain/model';
import { parseNumber } from '@/domain/time';

type Props = {
  visible: boolean;
  initial: Allowance | null;
  initialDate: string;
  labels: string[];
  onClose: () => void;
  onSave: (allowance: Allowance) => void;
  onDelete: (allowance: Allowance) => void;
};

export function AllowanceSheet({ visible, initial, initialDate, labels, onClose, onSave, onDelete }: Props) {
  const [date, setDate] = useState(initial?.date ?? initialDate);
  const [label, setLabel] = useState(initial?.label ?? MAIN_ALLOWANCES[0]);
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? 1).replace('.', ','));
  const [amount, setAmount] = useState(initial?.amount?.toString().replace('.', ',') ?? '');
  const save = () => {
    const parsedQuantity = parseNumber(quantity) ?? 1;
    if (!date) return Alert.alert('Datum wählen');
    if (!label.trim()) return Alert.alert('Bezeichnung eintragen');
    if (parsedQuantity <= 0) return Alert.alert('Anzahl muss größer als 0 sein');
    onSave({ id: initial?.id ?? `${Date.now()}-${Math.random()}`, date, label: label.trim(), quantity: parsedQuantity, amount: parseNumber(amount) });
    onClose();
  };
  return <BottomSheet onClose={onClose} title={initial ? 'Zulage bearbeiten' : 'Zulage eintragen'} visible={visible}>
    <Field label="Datum"><TextInput onChangeText={setDate} placeholder="JJJJ-MM-TT" style={styles.input} value={date} /></Field>
    <Field label="Art der Zulage"><View style={styles.chips}>{labels.map((item) => <TouchableOpacity key={item} onPress={() => setLabel(item)} style={[styles.chip, label === item && styles.chipActive]}><Text style={[styles.chipText, label === item && styles.chipTextActive]}>{item}</Text></TouchableOpacity>)}</View></Field>
    <Field label="Bezeichnung"><TextInput onChangeText={setLabel} placeholder="z. B. Schichtzulage" style={styles.input} value={label} /></Field>
    <View style={styles.two}><Field label="Anzahl"><TextInput keyboardType="decimal-pad" onChangeText={setQuantity} style={styles.input} value={quantity} /></Field><Field label="Betrag in € (optional)"><TextInput keyboardType="decimal-pad" onChangeText={setAmount} placeholder="0,00" style={styles.input} value={amount} /></Field></View>
    <View style={styles.actions}><Button onPress={save}>Speichern</Button>{initial ? <Button kind="danger" onPress={() => Alert.alert('Zulage löschen?', undefined, [{ text: 'Abbrechen' }, { text: 'Löschen', style: 'destructive', onPress: () => { onDelete(initial); onClose(); } }])}>Zulage löschen</Button> : null}</View>
  </BottomSheet>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text>{children}</View>; }
const styles = StyleSheet.create({
  field: { flex: 1, gap: 7 }, label: { color: colors.muted, fontFamily: font.extraBold, fontSize: 12, letterSpacing: 0.7, textTransform: 'uppercase' }, input: { width: '100%', height: 54, borderRadius: 14, paddingHorizontal: 14, backgroundColor: colors.soft, color: colors.ink, fontFamily: font.bold, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { minHeight: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.soft, justifyContent: 'center' }, chipActive: { backgroundColor: colors.accent }, chipText: { color: colors.ink, fontFamily: font.extraBold, fontSize: 14 }, chipTextActive: { color: '#FFF' }, two: { flexDirection: 'row', gap: 12 }, actions: { gap: 10 },
});
