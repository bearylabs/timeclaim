import { useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { BottomSheet, Button } from './primitives';
import { colors, font } from '@/constants/theme';
import type { AppState } from '@/domain/model';
import { normalizeState } from '@/context/app-store';
import { toDateKey } from '@/domain/time';

export function BackupSheet({ visible, state, onClose, onRestore, onWipe, onToast }: { visible: boolean; state: AppState; onClose: () => void; onRestore: (state: AppState) => Promise<boolean>; onWipe: () => Promise<boolean>; onToast: (message: string) => void }) {
  const [text, setText] = useState(JSON.stringify(state));
  const [restoring, setRestoring] = useState(false);
  const [wiping, setWiping] = useState(false);
  const restoringRef = useRef(false);
  const wipingRef = useRef(false);
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
      Alert.alert('Daten ersetzen?', 'Die aktuellen Daten werden durch diese Sicherung ersetzt.', [{ text: 'Abbrechen' }, { text: 'Wiederherstellen', onPress: () => {
        const apply = async () => {
          if (restoringRef.current) return;
          restoringRef.current = true;
          setRestoring(true);
          try { if (await onRestore(normalized)) onClose(); }
          finally { restoringRef.current = false; setRestoring(false); }
        };
        void apply();
      } }]);
    } catch { Alert.alert('Ungültige Sicherung', 'Der Text enthält keine gültige TimeClaim-Sicherung.'); }
  };
  const removeAll = async () => {
    if (wipingRef.current) return;
    wipingRef.current = true;
    setWiping(true);
    try { if (await onWipe()) onClose(); }
    finally { wipingRef.current = false; setWiping(false); }
  };
  const busy = restoring || wiping;
  return <BottomSheet onClose={busy ? () => undefined : onClose} title="Daten sichern" visible={visible}>
    <Text style={styles.hint}>Die Sicherung enthält alle Arbeitsverhältnisse. Alle Einträge liegen nur auf diesem Gerät. Sichere sie regelmäßig – oder übertrage sie mit dem Text unten auf ein anderes Gerät.</Text>
    <TextInput multiline onChangeText={setText} spellCheck={false} style={styles.backup} textAlignVertical="top" value={text} />
    <View style={styles.actions}><Button disabled={busy} onPress={saveFile}>Als Datei sichern</Button><Button disabled={busy} kind="line" onPress={async () => { await Clipboard.setStringAsync(text); onToast('Kopiert'); }}>Text kopieren</Button><Button disabled={busy} kind="line" onPress={restore}>Aus Text wiederherstellen</Button><Button disabled={busy} kind="danger" onPress={() => Alert.alert('Alle Daten löschen?', 'Dieser Schritt kann nicht rückgängig gemacht werden.', [{ text: 'Abbrechen' }, { text: 'Alles löschen', style: 'destructive', onPress: () => { void removeAll(); } }])}>Alle Daten löschen</Button></View>
  </BottomSheet>;
}
const styles = StyleSheet.create({ hint: { color: colors.muted, fontFamily: font.medium, fontSize: 13, lineHeight: 19 }, backup: { minHeight: 140, maxHeight: 220, borderRadius: 14, backgroundColor: colors.soft, padding: 12, color: colors.ink, fontFamily: 'monospace', fontSize: 11 }, actions: { gap: 10 } });
