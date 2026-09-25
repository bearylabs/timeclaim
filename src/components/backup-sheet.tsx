import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { BottomSheet, Button } from './primitives';
import { colors, font } from '@/constants/theme';
import { normalizeState } from '@/context/app-store';
import type { AppState } from '@/domain/model';
import { toDateKey } from '@/domain/time';

type BackupSheetProps = {
  visible: boolean;
  onClose: () => void;
  onLoadBackup: () => Promise<AppState>;
  onRestore: (state: AppState) => Promise<boolean>;
  onWipe: () => Promise<boolean>;
  onToast: (message: string) => void;
};

export function BackupSheet({
  visible,
  onClose,
  onLoadBackup,
  onRestore,
  onWipe,
  onToast,
}: BackupSheetProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [wiping, setWiping] = useState(false);
  const exportingRef = useRef(false);
  const restoringRef = useRef(false);
  const wipingRef = useRef(false);

  const loadBackupText = async () => JSON.stringify(await onLoadBackup());

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const backup = await loadBackupText();
        if (mounted) setText(backup);
      } catch (reason) {
        console.error('Backup state could not be loaded.', reason);
        if (mounted) Alert.alert('Sicherung nicht verfügbar', 'Die aktuellen Daten konnten nicht aus der lokalen Datenbank geladen werden.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
    // This sheet is remounted whenever it is opened. A later parent render must not
    // overwrite backup text that the user has pasted for an import.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runExport = async (action: (backup: string) => Promise<void>) => {
    if (exportingRef.current) return;
    exportingRef.current = true;
    setExporting(true);
    try {
      const backup = await loadBackupText();
      setText(backup);
      await action(backup);
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
  };

  const saveFile = async () => {
    try {
      await runExport(async (backup) => {
        if (!FileSystem.cacheDirectory) throw new Error('Kein Cache-Verzeichnis verfügbar.');
        const uri = `${FileSystem.cacheDirectory}timeclaim-backup-${toDateKey(new Date())}.json`;
        await FileSystem.writeAsStringAsync(uri, backup);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'TimeClaim sichern' });
        } else {
          await Clipboard.setStringAsync(backup);
          onToast('Teilen nicht verfügbar – Sicherungstext kopiert');
        }
      });
    } catch (reason) {
      console.error('Backup file could not be shared.', reason);
      Alert.alert('Speichern nicht möglich', 'Die Sicherungsdatei konnte nicht erstellt oder geteilt werden. Kopiere den Sicherungstext stattdessen.');
    }
  };

  const copyBackup = async () => {
    try {
      await runExport(async (backup) => { await Clipboard.setStringAsync(backup); });
      onToast('Sicherung kopiert');
    } catch (reason) {
      console.error('Backup could not be copied.', reason);
      Alert.alert('Kopieren nicht möglich', 'Die aktuellen Daten konnten nicht kopiert werden. Bitte versuche es erneut.');
    }
  };

  const restore = () => {
    let normalized: AppState | null;
    try {
      normalized = normalizeState(JSON.parse(text));
    } catch {
      normalized = null;
    }
    if (!normalized) {
      Alert.alert('Ungültige Sicherung', 'Der Text enthält keine gültige TimeClaim-Sicherung.');
      return;
    }

    Alert.alert('Daten ersetzen?', 'Die aktuellen Daten werden durch diese Sicherung ersetzt.', [
      { text: 'Abbrechen' },
      {
        text: 'Wiederherstellen',
        onPress: () => {
          const apply = async () => {
            if (restoringRef.current) return;
            restoringRef.current = true;
            setRestoring(true);
            try {
              if (await onRestore(normalized)) onClose();
              else Alert.alert('Wiederherstellung fehlgeschlagen', 'Die Sicherung konnte nicht gespeichert werden. Die bisherigen Daten bleiben erhalten.');
            } finally {
              restoringRef.current = false;
              setRestoring(false);
            }
          };
          void apply();
        },
      },
    ]);
  };

  const removeAll = async () => {
    if (wipingRef.current) return;
    wipingRef.current = true;
    setWiping(true);
    try {
      if (await onWipe()) onClose();
      else Alert.alert('Löschen fehlgeschlagen', 'Die Daten konnten nicht vollständig gelöscht werden und bleiben erhalten.');
    } finally {
      wipingRef.current = false;
      setWiping(false);
    }
  };

  const busy = loading || exporting || restoring || wiping;
  return <BottomSheet onClose={busy ? () => undefined : onClose} title="Daten sichern" visible={visible}>
    <Text style={styles.hint}>Die Sicherung enthält alle Arbeitsverhältnisse. Alle Einträge liegen nur auf diesem Gerät. Sichere sie regelmäßig – oder übertrage sie mit dem Text unten auf ein anderes Gerät.</Text>
    <TextInput editable={!busy} multiline onChangeText={setText} placeholder={loading ? 'Aktuelle Daten werden geladen …' : undefined} spellCheck={false} style={styles.backup} textAlignVertical="top" value={text} />
    <View style={styles.actions}>
      <Button disabled={busy} onPress={() => { void saveFile(); }}>Als Datei sichern</Button>
      <Button disabled={busy} kind="line" onPress={() => { void copyBackup(); }}>Aktuelle Daten kopieren</Button>
      <Button disabled={busy} kind="line" onPress={restore}>Aus Text wiederherstellen</Button>
      <Button disabled={busy} kind="danger" onPress={() => Alert.alert('Alle Daten löschen?', 'Dieser Schritt kann nicht rückgängig gemacht werden.', [{ text: 'Abbrechen' }, { text: 'Alles löschen', style: 'destructive', onPress: () => { void removeAll(); } }])}>Alle Daten löschen</Button>
    </View>
  </BottomSheet>;
}

const styles = StyleSheet.create({ hint: { color: colors.muted, fontFamily: font.medium, fontSize: 13, lineHeight: 19 }, backup: { minHeight: 140, maxHeight: 220, borderRadius: 14, backgroundColor: colors.soft, padding: 12, color: colors.ink, fontFamily: 'monospace', fontSize: 11 }, actions: { gap: 10 } });
