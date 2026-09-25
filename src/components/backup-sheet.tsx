import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { BottomSheet, Button } from './primitives';
import { colors, font } from '@/constants/theme';
import type { AppState } from '@/domain/model';
import { normalizeState } from '@/context/app-store';
import { toDateKey } from '@/domain/time';

export function BackupSheet({ visible, state, onClose, onRestore, onWipe, onToast }: { visible: boolean; state: AppState; onClose: () => void; onRestore: (state: AppState) => void; onWipe: () => Promise<boolean>; onToast: (message: string) => void }) {
  const [text, setText] = useState(JSON.stringify(state));
  const saveFile = async () => {
    try {
      const uri = `${FileSystem.cacheDirectory}timeclaim-backup-${toDateKey(new Date())}.json`;
      await FileSystem.writeAsStringAsync(uri, JSON.stringify(state));
      await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'TimeClaim sichern' });
    } catch { Alert.alert('Speichern nicht möglich', 'Kopiere den Sicherungstext stattdessen.'); }
  };
  const restore = () => {
    try {
      const normalized = normalizeState(JSON.parse(text));
      if (!normalized) throw new Error();
      Alert.alert('Daten ersetzen?', 'Die aktuellen Daten werden durch diese Sicherung ersetzt.', [{ text: 'Abbrechen' }, { text: 'Wiederherstellen', onPress: () => { onRestore(normalized); onClose(); onToast('Daten wiederhergestellt'); } }]);
    } catch { Alert.alert('Ungültige Sicherung', 'Der Text enthält keine gültige TimeClaim-Sicherung.'); }
  };
  return <BottomSheet onClose={onClose} title="Daten sichern" visible={visible}>
    <Text style={styles.hint}>Die Sicherung enthält alle Arbeitsverhältnisse. Alle Einträge liegen nur auf diesem Gerät. Sichere sie regelmäßig – oder übertrage sie mit dem Text unten auf ein anderes Gerät.</Text>
    <TextInput multiline onChangeText={setText} spellCheck={false} style={styles.backup} textAlignVertical="top" value={text} />
    <View style={styles.actions}><Button onPress={saveFile}>Als Datei sichern</Button><Button kind="line" onPress={async () => { await Clipboard.setStringAsync(text); onToast('Kopiert'); }}>Text kopieren</Button><Button kind="line" onPress={restore}>Aus Text wiederherstellen</Button><Button kind="danger" onPress={() => Alert.alert('Alle Daten löschen?', 'Dieser Schritt kann nicht rückgängig gemacht werden.', [{ text: 'Abbrechen' }, { text: 'Alles löschen', style: 'destructive', onPress: () => { const remove = async () => { if (await onWipe()) onClose(); }; void remove(); } }])}>Alle Daten löschen</Button></View>
  </BottomSheet>;
}
const styles = StyleSheet.create({ hint: { color: colors.muted, fontFamily: font.medium, fontSize: 13, lineHeight: 19 }, backup: { minHeight: 140, maxHeight: 220, borderRadius: 14, backgroundColor: colors.soft, padding: 12, color: colors.ink, fontFamily: 'monospace', fontSize: 11 }, actions: { gap: 10 } });
