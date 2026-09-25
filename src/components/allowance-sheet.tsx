import { useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { BottomSheet, Button } from './primitives';
import { NativeDateTimeField } from './native-date-time-field';
import { colors, font } from '@/constants/theme';
import { MAIN_ALLOWANCES, type Allowance } from '@/domain/model';
import { allowanceError, calendarDateError, INPUT_LIMITS, parseAmountInput, parseQuantityInput } from '@/domain/validation';

type Props = {
  visible: boolean;
  initial: Allowance | null;
  initialDate: string;
  labels: string[];
  onClose: () => void;
  onSave: (allowance: Allowance) => Promise<boolean>;
  onDelete: (allowance: Allowance) => Promise<boolean>;
};

export function AllowanceSheet({ visible, initial, initialDate, labels, onClose, onSave, onDelete }: Props) {
  const [date, setDate] = useState(initial?.date ?? initialDate);
  const [label, setLabel] = useState(initial?.label ?? MAIN_ALLOWANCES[0]);
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? 1).replace('.', ','));
  const [amount, setAmount] = useState(initial?.amount?.toString().replace('.', ',') ?? '');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const save = async () => {
    if (savingRef.current) return;
    const dateError = calendarDateError(date);
    const parsedQuantity = parseQuantityInput(quantity);
    const parsedAmount = parseAmountInput(amount);
    if (dateError) return Alert.alert('Eingabe prüfen', dateError);
    if (!label.trim()) return Alert.alert('Eingabe prüfen', 'Bezeichnung: Bitte einen Namen eingeben.');
    if (label.trim().length > INPUT_LIMITS.allowanceLabel) return Alert.alert('Eingabe prüfen', `Bezeichnung: Maximal ${INPUT_LIMITS.allowanceLabel} Zeichen sind erlaubt.`);
    if (parsedQuantity.error) return Alert.alert('Eingabe prüfen', parsedQuantity.error);
    if (parsedAmount.error) return Alert.alert('Eingabe prüfen', parsedAmount.error);
    const allowance: Allowance = { id: initial?.id ?? `${Date.now()}-${Math.random()}`, date, label: label.trim(), quantity: parsedQuantity.value!, amount: parsedAmount.value };
    const error = allowanceError(allowance);
    if (error) return Alert.alert('Eingabe prüfen', error);
    savingRef.current = true;
    setSaving(true);
    try {
      const saved = await onSave(allowance);
      if (saved) onClose();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!initial || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      if (await onDelete(initial)) onClose();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return <BottomSheet dismissible={!saving} onClose={onClose} title={initial ? 'Zulage bearbeiten' : 'Zulage eintragen'} visible={visible}>
    <Field label="Datum"><NativeDateTimeField mode="date" onChange={setDate} value={date} /></Field>
    <Field label="Art der Zulage"><View style={styles.chips}>{labels.map((item) => <TouchableOpacity key={item} onPress={() => setLabel(item)} style={[styles.chip, label === item && styles.chipActive]}><Text style={[styles.chipText, label === item && styles.chipTextActive]}>{item}</Text></TouchableOpacity>)}</View></Field>
    <Field label="Bezeichnung"><TextInput maxLength={INPUT_LIMITS.allowanceLabel} onChangeText={setLabel} placeholder="z. B. Schichtzulage" style={styles.input} value={label} /></Field>
    <View style={styles.two}><Field label="Anzahl"><TextInput keyboardType="decimal-pad" maxLength={INPUT_LIMITS.numericText} onChangeText={setQuantity} style={styles.input} value={quantity} /></Field><Field label="Betrag in € (optional)"><TextInput keyboardType="decimal-pad" maxLength={INPUT_LIMITS.numericText} onChangeText={setAmount} placeholder="0,00" style={styles.input} value={amount} /></Field></View>
    <View style={styles.actions}><Button disabled={saving} onPress={() => { void save(); }}>Speichern</Button>{initial ? <Button disabled={saving} kind="danger" onPress={() => Alert.alert('Zulage löschen?', undefined, [{ text: 'Abbrechen' }, { text: 'Löschen', style: 'destructive', onPress: () => { void remove(); } }])}>Zulage löschen</Button> : null}</View>
  </BottomSheet>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text>{children}</View>; }
const styles = StyleSheet.create({
  field: { flex: 1, gap: 7 }, label: { color: colors.muted, fontFamily: font.extraBold, fontSize: 12, letterSpacing: 0.7, textTransform: 'uppercase' }, input: { width: '100%', height: 54, borderRadius: 14, paddingHorizontal: 14, backgroundColor: colors.soft, color: colors.ink, fontFamily: font.bold, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { minHeight: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.soft, justifyContent: 'center' }, chipActive: { backgroundColor: colors.accent }, chipText: { color: colors.ink, fontFamily: font.extraBold, fontSize: 14 }, chipTextActive: { color: '#FFF' }, two: { flexDirection: 'row', gap: 12 }, actions: { gap: 10 },
});
