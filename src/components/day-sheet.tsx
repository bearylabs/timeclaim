import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { BottomSheet, Button } from './primitives';
import { NativeDateTimeField } from './native-date-time-field';
import { colors, font } from '@/constants/theme';
import { MAIN_ALLOWANCES, type Employment, type MainAllowance, type WorkDay } from '@/domain/model';
import { calculateDay, formatDecimal, formatHours, parseNumber } from '@/domain/time';

type Props = {
  visible: boolean;
  date: string;
  employment: Employment;
  presetWork: boolean;
  onClose: () => void;
  onSave: (oldDate: string, date: string, work: WorkDay | null, allowances: Record<MainAllowance, number | null | undefined>) => Promise<boolean>;
  onDelete: (date: string) => Promise<boolean>;
  onOtherAllowance: (date: string) => void;
  onEditAllowance: (id: string) => void;
};

export function DaySheet({ visible, date: initialDate, employment, presetWork, onClose, onSave, onDelete, onOtherAllowance, onEditAllowance }: Props) {
  const existing = employment.days[initialDate];
  const managed = Object.fromEntries(MAIN_ALLOWANCES.map((label) => [label, employment.allowances.find((item) => item.date === initialDate && item.label === label)])) as Record<MainAllowance, ReturnType<typeof employment.allowances.find>>;
  const otherAllowances = employment.allowances.filter((item) => item.date === initialDate && !MAIN_ALLOWANCES.includes(item.label as MainAllowance));
  const hasAnything = Boolean(existing) || employment.allowances.some((item) => item.date === initialDate);
  const previous = Object.entries(employment.days).sort(([a], [b]) => b.localeCompare(a)).find(([key]) => key !== initialDate)?.[1];
  const [date, setDate] = useState(initialDate);
  const [toggles, setToggles] = useState<Record<'work' | MainAllowance, boolean>>({
    work: existing ? true : hasAnything ? false : presetWork,
    Bereitschaft: Boolean(managed.Bereitschaft), Einspringen: Boolean(managed.Einspringen),
  });
  const [start, setStart] = useState(existing?.start ?? previous?.start ?? '07:00');
  const [end, setEnd] = useState(existing?.end ?? previous?.end ?? '15:30');
  const [pause, setPause] = useState(String(existing?.pause ?? previous?.pause ?? 30));
  const [note, setNote] = useState(existing?.note ?? '');
  const [amounts, setAmounts] = useState<Record<MainAllowance, string>>({
    Bereitschaft: managed.Bereitschaft?.amount?.toString().replace('.', ',') ?? '',
    Einspringen: managed.Einspringen?.amount?.toString().replace('.', ',') ?? '',
  });
  const [saving, setSaving] = useState(false);
  const calculation = useMemo(() => calculateDay({ start, end, pause: Number(pause) }), [start, end, pause]);

  const toggle = (key: keyof typeof toggles) => setToggles((value) => ({ ...value, [key]: !value[key] }));
  const save = async (closeAfter = true) => {
    if (saving) return false;
    if (!date) { Alert.alert('Datum wählen'); return false; }
    if (!toggles.work && !toggles.Bereitschaft && !toggles.Einspringen) { Alert.alert('Auswahl fehlt', 'Wähle Arbeitszeit, Bereitschaft oder Einspringen.'); return false; }
    if (toggles.work && !calculation) { Alert.alert('Ungültige Zeit', 'Beginn und Ende müssen unterschiedlich sein.'); return false; }
    setSaving(true);
    try {
      const ok = await onSave(initialDate, date, toggles.work ? { start, end, pause: Math.max(0, Math.round(Number(pause) || 0)), note: note.trim() } : null, {
        Bereitschaft: toggles.Bereitschaft ? parseNumber(amounts.Bereitschaft) : undefined,
        Einspringen: toggles.Einspringen ? parseNumber(amounts.Einspringen) : undefined,
      });
      if (ok && closeAfter) onClose();
      return ok;
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (await onDelete(initialDate)) onClose();
    } finally {
      setSaving(false);
    }
  };

  return <BottomSheet onClose={onClose} title={hasAnything ? 'Eintrag bearbeiten' : 'Neuer Eintrag'} visible={visible}>
    <Field label="Datum"><NativeDateTimeField mode="date" onChange={setDate} value={date} /></Field>
    <Field label="Was war an diesem Tag?">
      <View style={styles.toggles}>
        <Toggle active={toggles.work} label="Arbeitszeit" onPress={() => toggle('work')} />
        <Toggle active={toggles.Bereitschaft} color={colors.teal} label="Bereitschaft" onPress={() => toggle('Bereitschaft')} />
        <Toggle active={toggles.Einspringen} color={colors.violet} label="Eingesprungen" onPress={() => toggle('Einspringen')} />
      </View>
    </Field>
    {toggles.work ? <View style={styles.group}>
      <View style={styles.two}><Field label="Beginn"><NativeDateTimeField mode="time" onChange={setStart} value={start} /></Field><Field label="Ende"><NativeDateTimeField mode="time" onChange={setEnd} value={end} /></Field></View>
      <Field label="Pause">
        <View style={styles.pauseOptions}>{[0, 30, 45, 60].map((value) => <TouchableOpacity key={value} onPress={() => setPause(String(value))} style={[styles.pause, Number(pause) === value && styles.pauseActive]}><Text style={[styles.pauseText, Number(pause) === value && styles.pauseTextActive]}>{value ? `${value} min` : 'Keine'}</Text></TouchableOpacity>)}</View>
        <View style={styles.customPause}><Text style={styles.muted}>oder eigene Dauer in Minuten</Text><TextInput keyboardType="number-pad" onChangeText={setPause} style={[styles.input, styles.pauseInput]} value={pause} /></View>
      </Field>
      <View style={styles.calculation}>{calculation ? <>
        <View style={styles.calcMain}><Text style={styles.calcValue}>{formatHours(calculation.net)} Std</Text><Text style={styles.muted}>netto · {formatDecimal(calculation.net)} dezimal</Text></View>
        <Text style={styles.muted}>{formatHours(calculation.elapsed)} brutto − {calculation.pause} min Pause</Text>
        {calculation.pause === 0 ? <Text style={styles.warning}>Keine Pause eingetragen – der Tag wird als „Keine Pause“ markiert.{calculation.net > 360 ? ' Ab mehr als 6 Std Arbeitszeit sind mindestens 30 min Pause vorgeschrieben (§ 4 ArbZG).' : ''}</Text> : null}
        {calculation.net > 540 && calculation.pause < 45 ? <Text style={styles.warning}>Bei mehr als 9 Std Arbeitszeit sind mindestens 45 min Pause vorgeschrieben (§ 4 ArbZG).</Text> : null}
        {calculation.overnight ? <Text style={styles.muted}>Ende liegt am Folgetag.</Text> : null}
      </> : <Text style={styles.muted}>Beginn und Ende eintragen – dann wird die Netto-Zeit berechnet.</Text>}</View>
      <Field label="Notiz (optional)"><TextInput onChangeText={setNote} placeholder="z. B. Schulung, Einsatz vor Ort" style={styles.input} value={note} /></Field>
    </View> : null}
    {MAIN_ALLOWANCES.map((label) => toggles[label] ? <View key={label} style={[styles.allowanceBox, label === 'Bereitschaft' ? styles.tealBox : styles.violetBox]}><Field label={`${label} · Betrag in € (optional)`}><TextInput keyboardType="decimal-pad" onChangeText={(value) => setAmounts((current) => ({ ...current, [label]: value }))} placeholder="0,00" style={[styles.input, styles.whiteInput]} value={amounts[label]} /></Field></View> : null)}
    {otherAllowances.length ? <View style={styles.otherSection}><Text style={styles.label}>Weitere Zulagen an diesem Tag</Text>{otherAllowances.map((allowance) => <TouchableOpacity key={allowance.id} onPress={() => onEditAllowance(allowance.id)} style={styles.otherRow}><Text style={styles.otherLabel}>{allowance.label}</Text><Text style={styles.otherAmount}>{allowance.quantity}×{allowance.amount !== null ? ` · ${allowance.amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}` : ''}</Text></TouchableOpacity>)}</View> : null}
    <View style={styles.actions}><Button disabled={saving} onPress={() => { void save(); }}>Speichern</Button><Button disabled={saving} kind="soft" onPress={() => { const open = async () => { const hasSelection = toggles.work || toggles.Bereitschaft || toggles.Einspringen; if (!hasSelection || await save(false)) onOtherAllowance(date); }; void open(); }}>＋ Andere Zulage</Button>{hasAnything ? <Button disabled={saving} kind="danger" onPress={() => Alert.alert('Alles löschen?', 'Arbeitszeit und Zulagen dieses Tages werden gelöscht.', [{ text: 'Abbrechen' }, { text: 'Löschen', style: 'destructive', onPress: () => { void remove(); } }])}>Alles an diesem Tag löschen</Button> : null}</View>
  </BottomSheet>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text>{children}</View>; }
function Toggle({ active, label, onPress, color = colors.accent }: { active: boolean; label: string; onPress: () => void; color?: string }) { return <TouchableOpacity onPress={onPress} style={[styles.toggle, active && { backgroundColor: color }]}><Text style={[styles.toggleText, active && styles.toggleTextActive]}>{active ? '✓ ' : ''}{label}</Text></TouchableOpacity>; }

const styles = StyleSheet.create({
  field: { flex: 1, gap: 7 }, label: { color: colors.muted, fontFamily: font.extraBold, fontSize: 12, letterSpacing: 0.7, textTransform: 'uppercase' },
  input: { width: '100%', height: 54, borderRadius: 14, paddingHorizontal: 14, backgroundColor: colors.soft, color: colors.ink, fontFamily: font.bold, fontSize: 16 },
  toggles: { flexDirection: 'row', gap: 8 }, toggle: { flex: 1, minHeight: 54, borderRadius: 16, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }, toggleText: { color: colors.ink2, fontFamily: font.extraBold, fontSize: 12 }, toggleTextActive: { color: '#FFF' },
  group: { gap: 16 }, two: { flexDirection: 'row', gap: 12 },
  pauseOptions: { flexDirection: 'row', gap: 8 }, pause: { flex: 1, height: 46, borderRadius: 14, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' }, pauseActive: { backgroundColor: colors.accent }, pauseText: { fontFamily: font.extraBold, fontSize: 12, color: colors.ink }, pauseTextActive: { color: '#FFF' },
  customPause: { flexDirection: 'row', alignItems: 'center', gap: 10 }, pauseInput: { width: 100, textAlign: 'center', height: 46 }, muted: { color: colors.muted, fontFamily: font.semiBold, fontSize: 13, flex: 1 },
  calculation: { borderRadius: 18, padding: 14, backgroundColor: colors.soft, gap: 7 }, calcMain: { flexDirection: 'row', alignItems: 'baseline', gap: 8 }, calcValue: { color: colors.ink, fontFamily: font.extraBold, fontSize: 25 }, warning: { color: colors.amber, backgroundColor: colors.amberSoft, borderRadius: 12, padding: 10, fontFamily: font.bold, fontSize: 13 },
  allowanceBox: { padding: 14, borderRadius: 18 }, tealBox: { backgroundColor: colors.tealSoft }, violetBox: { backgroundColor: colors.violetSoft }, whiteInput: { backgroundColor: '#FFF' }, otherSection: { gap: 2 }, otherRow: { minHeight: 48, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, otherLabel: { flex: 1, color: colors.ink, fontFamily: font.bold, fontSize: 14 }, otherAmount: { color: colors.ink, fontFamily: font.extraBold, fontSize: 14 }, actions: { gap: 10 },
});
