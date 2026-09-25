import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { type DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, shadow } from '@/constants/theme';
import { dateKey, pad } from '@/domain/time';

type Props = {
  mode: 'date' | 'time';
  value: string;
  onChange: (value: string) => void;
};

function valueAsDate(value: string, mode: Props['mode']) {
  if (mode === 'date') {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (match) {
      const result = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
      if (result.getFullYear() === Number(match[1]) && result.getMonth() === Number(match[2]) - 1 && result.getDate() === Number(match[3])) return result;
    }
  } else {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value);
    if (match && Number(match[1]) < 24 && Number(match[2]) < 60) return new Date(2000, 0, 1, Number(match[1]), Number(match[2]));
  }
  return new Date();
}

function outputValue(date: Date, mode: Props['mode']) {
  return mode === 'date'
    ? dateKey(date.getFullYear(), date.getMonth(), date.getDate())
    : `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function displayValue(value: string, mode: Props['mode']) {
  if (mode === 'time') return value;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
}

export function NativeDateTimeField({ mode, value, onChange }: Props) {
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState(() => valueAsDate(value, mode));
  const label = mode === 'date' ? 'Datum auswählen' : 'Uhrzeit auswählen';

  // Keep a usable text fallback for the browser preview. Android and iOS always use their native picker.
  if (Platform.OS === 'web') {
    return <TextInput onChangeText={onChange} placeholder={mode === 'date' ? 'JJJJ-MM-TT' : 'HH:MM'} style={[styles.field, mode === 'time' && styles.timeField]} value={value} />;
  }

  const open = () => {
    setDraft(valueAsDate(value, mode));
    setVisible(true);
  };
  const changed = (_event: DateTimePickerChangeEvent, selected: Date) => {
    if (Platform.OS === 'android') setVisible(false);
    setDraft(selected);
    if (Platform.OS === 'android') onChange(outputValue(selected, mode));
  };
  const dismissed = () => setVisible(false);

  return <>
    <TouchableOpacity accessibilityLabel={label} accessibilityRole="button" activeOpacity={0.7} onPress={open} style={[styles.field, mode === 'time' && styles.timeField]}>
      <Ionicons color={colors.muted} name={mode === 'date' ? 'calendar-outline' : 'time-outline'} size={20} />
      <Text style={[styles.value, mode === 'time' && styles.timeValue]}>{displayValue(value, mode)}</Text>
      <Ionicons color={colors.muted} name="chevron-down" size={17} />
    </TouchableOpacity>

    {visible && Platform.OS === 'android' ? <DateTimePicker display="default" is24Hour locale="de-DE" mode={mode} onDismiss={dismissed} onValueChange={changed} value={draft} /> : null}

    {Platform.OS === 'ios' ? <Modal animationType="fade" onRequestClose={() => setVisible(false)} transparent visible={visible}>
      <View style={styles.backdrop}>
        <Pressable onPress={() => setVisible(false)} style={StyleSheet.absoluteFill} />
        <View style={styles.dialog}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setVisible(false)} style={styles.action}><Text style={styles.cancel}>Abbrechen</Text></TouchableOpacity>
            <Text style={styles.title}>{mode === 'date' ? 'Datum' : 'Uhrzeit'}</Text>
            <TouchableOpacity onPress={() => { onChange(outputValue(draft, mode)); setVisible(false); }} style={styles.action}><Text style={styles.done}>Fertig</Text></TouchableOpacity>
          </View>
          <DateTimePicker display="spinner" is24Hour locale="de-DE" mode={mode} onDismiss={dismissed} onValueChange={changed} themeVariant="light" value={draft} />
        </View>
      </View>
    </Modal> : null}
  </>;
}

const styles = StyleSheet.create({
  field: { width: '100%', height: 54, borderRadius: 14, paddingHorizontal: 14, backgroundColor: colors.soft, flexDirection: 'row', alignItems: 'center', gap: 10 },
  value: { flex: 1, color: colors.ink, fontFamily: font.bold, fontSize: 16 },
  timeField: { justifyContent: 'center' },
  timeValue: { flex: 0, minWidth: 70, fontFamily: font.extraBold, fontSize: 23, textAlign: 'center' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(13,20,36,0.42)' },
  dialog: { paddingBottom: 24, backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, ...shadow },
  header: { height: 54, paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.ink, fontFamily: font.extraBold, fontSize: 16 },
  action: { minWidth: 82, minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' },
  cancel: { color: colors.muted, fontFamily: font.bold, fontSize: 15 },
  done: { color: colors.accent, fontFamily: font.extraBold, fontSize: 15, textAlign: 'right' },
});
