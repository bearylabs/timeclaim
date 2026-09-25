import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, shadow } from '@/constants/theme';

type StartupErrorProps = {
  retrying: boolean;
  onRetry: () => void;
};

export function StartupError({ retrying, onRetry }: StartupErrorProps) {
  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text
          accessibilityLiveRegion="assertive"
          accessibilityRole="alert"
          style={styles.title}
        >
          Daten konnten nicht geladen werden
        </Text>
        <Text style={styles.description}>
          TimeClaim konnte die lokale Datenbank nicht öffnen. Deine vorhandenen Daten werden dabei
          nicht gelöscht oder ersetzt.
        </Text>
        <Text style={styles.hint}>
          Versuche es erneut. Falls das Problem bleibt, beende die App vollständig und öffne sie
          noch einmal.
        </Text>
        <TouchableOpacity
          accessibilityHint="Versucht erneut, die lokale Datenbank zu öffnen"
          accessibilityRole="button"
          accessibilityState={{ busy: retrying, disabled: retrying }}
          activeOpacity={0.75}
          disabled={retrying}
          onPress={onRetry}
          style={[styles.button, retrying && styles.buttonDisabled]}
        >
          {retrying ? <ActivityIndicator color="#FFFFFF" /> : null}
          <Text style={styles.buttonText}>{retrying ? 'Wird geladen …' : 'Erneut versuchen'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    padding: 24,
    gap: 14,
    borderRadius: 22,
    backgroundColor: colors.card,
    ...shadow,
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '800',
  },
  description: {
    color: colors.ink2,
    fontSize: 16,
    lineHeight: 24,
  },
  hint: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  button: {
    minHeight: 52,
    marginTop: 4,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
