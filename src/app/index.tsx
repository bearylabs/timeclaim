import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AllowanceSheet } from '@/components/allowance-sheet';
import { BackupSheet } from '@/components/backup-sheet';
import { DaySheet } from '@/components/day-sheet';
import { JobsSheet } from '@/components/jobs-sheet';
import { AllowancesView, DaysView, getDeviationCount, getMonthInfo, ReconciliationView } from '@/components/month-views';
import { SettingsMenu } from '@/components/settings-menu';
import { RoundButton, Toast } from '@/components/primitives';
import { colors, employmentColors, font, shadow } from '@/constants/theme';
import { useAppStore } from '@/context/app-store';
import { MAIN_ALLOWANCES, type Allowance, type BillingRecord, type MainAllowance, type WorkDay } from '@/domain/model';
import { dateKey, monthKey, MONTHS, parseDateKey } from '@/domain/time';

type Tab = 'days' | 'allowances' | 'reconciliation';
type Sheet = { type: 'day'; date: string; presetWork: boolean } | { type: 'allowance'; id: string | null; date: string } | { type: 'settings' } | { type: 'jobs' } | { type: 'backup' } | null;

export default function HomeScreen() {
  const {
    state, hydrated, activeEmployment, setActiveEmployment, addEmployment, changeEmployment,
    deleteEmployment, restoreEmployment, saveDay: persistDay, deleteDay: persistDeleteDay,
    restoreDay, saveAllowance: persistAllowance, deleteAllowance: persistDeleteAllowance,
    restoreAllowance, saveBilling: persistBilling, replace, clearDemo, wipe: persistWipe, hasDemo,
  } = useAppStore();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [tab, setTab] = useState<Tab>('days');
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState<{ message: string; action?: string; run?: () => void } | null>(null);
  const insets = useSafeAreaInsets();
  const info = useMemo(() => getMonthInfo(activeEmployment, year, month), [activeEmployment, year, month]);
  const deviationCount = getDeviationCount(activeEmployment, info);
  const today = dateKey(now.getFullYear(), now.getMonth(), now.getDate());
  const defaultDate = year === now.getFullYear() && month === now.getMonth() ? today : dateKey(year, month, 1);
  const allLabels = [...new Set([...MAIN_ALLOWANCES, ...activeEmployment.allowances.map((item) => item.label)])];

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), toast.action ? 6000 : 2400);
    return () => clearTimeout(timeout);
  }, [toast]);

  const notify = (message: string, action?: string, run?: () => void) => setToast({ message, action, run });
  const shiftMonth = (offset: number) => { const next = new Date(year, month + offset, 1); setYear(next.getFullYear()); setMonth(next.getMonth()); };
  const openDay = (date: string, presetWork = true) => setSheet({ type: 'day', date, presetWork });

  const reportError = (reason: unknown) => {
    console.error('Persistent store operation failed.', reason);
    notify(reason instanceof Error && reason.message ? reason.message : 'Die Änderung konnte nicht gespeichert werden.');
  };
  const isReady = () => {
    if (hydrated) return true;
    notify('Die Daten werden noch geladen. Bitte versuche es gleich noch einmal.');
    return false;
  };

  const saveDay = async (oldDate: string, newDate: string, work: WorkDay | null, managed: Record<MainAllowance, number | null | undefined>) => {
    if (!isReady()) return false;
    if (newDate !== oldDate && work && activeEmployment.days[newDate]) { notify('Für dieses Datum gibt es schon einen Arbeitszeit-Eintrag.'); return false; }
    const previous = Object.fromEntries(MAIN_ALLOWANCES.map((label) => [label, activeEmployment.allowances.find((item) => item.date === oldDate && item.label === label)])) as Record<MainAllowance, Allowance | undefined>;
    const allowances = MAIN_ALLOWANCES.flatMap((label) => managed[label] === undefined ? [] : [{
      id: previous[label]?.id ?? `${Date.now()}-${label}`,
      date: newDate,
      label,
      quantity: previous[label]?.quantity ?? 1,
      amount: managed[label] ?? null,
    }]);
    try {
      await persistDay(oldDate, newDate, work, allowances);
      const moved = parseDateKey(newDate);
      if (monthKey(moved.getFullYear(), moved.getMonth()) !== monthKey(year, month)) { setYear(moved.getFullYear()); setMonth(moved.getMonth()); }
      notify('Gespeichert');
      return true;
    } catch (reason) { reportError(reason); return false; }
  };

  const deleteDay = async (date: string) => {
    if (!isReady()) return false;
    const oldWork = activeEmployment.days[date];
    const oldAllowances = activeEmployment.allowances.filter((item) => item.date === date);
    try {
      await persistDeleteDay(date);
      notify('Eintrag gelöscht', 'Rückgängig', () => {
        if (!isReady()) return;
        void restoreDay(date, oldWork, oldAllowances).catch(reportError);
      });
      return true;
    } catch (reason) { reportError(reason); return false; }
  };

  const editingAllowance = sheet?.type === 'allowance' && sheet.id ? activeEmployment.allowances.find((item) => item.id === sheet.id) ?? null : null;
  const saveAllowance = async (allowance: Allowance) => {
    if (!isReady()) return false;
    try {
      await persistAllowance(allowance);
      const date = parseDateKey(allowance.date); setYear(date.getFullYear()); setMonth(date.getMonth()); notify('Zulage gespeichert');
      return true;
    } catch (reason) { reportError(reason); return false; }
  };
  const deleteAllowance = async (allowance: Allowance) => {
    if (!isReady()) return false;
    try {
      await persistDeleteAllowance(allowance.id);
      notify('Zulage gelöscht', 'Rückgängig', () => {
        if (!isReady()) return;
        void restoreAllowance(allowance).catch(reportError);
      });
      return true;
    } catch (reason) { reportError(reason); return false; }
  };
  const saveBilling = async (billing: BillingRecord) => {
    if (!isReady()) return false;
    try { await persistBilling(info.key, billing); return true; }
    catch (reason) { reportError(reason); return false; }
  };
  const selectEmployment = async (id: string) => {
    if (!isReady() || id === state.activeEmploymentId) return;
    try { await setActiveEmployment(id); }
    catch (reason) { reportError(reason); }
  };
  const removeDemo = async () => {
    if (!isReady()) return;
    try { await clearDemo(); notify('Beispieldaten gelöscht'); }
    catch (reason) { reportError(reason); }
  };
  const restoreBackup = async (next: Parameters<typeof replace>[0]) => {
    if (!isReady()) return false;
    try { await replace(next); notify('Daten wiederhergestellt'); return true; }
    catch (reason) { reportError(reason); return false; }
  };
  const wipe = async () => {
    if (!isReady()) return false;
    try { await persistWipe(); notify('Alle Daten gelöscht'); return true; }
    catch (reason) { reportError(reason); return false; }
  };

  return <SafeAreaView edges={['top']} style={styles.safe}>
    <ScrollView automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'} contentContainerStyle={[styles.content, { paddingBottom: 112 + insets.bottom }]} keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.top}><Text style={styles.title}>TimeClaim</Text><RoundButton icon="settings-outline" label="Einstellungen öffnen" onPress={() => setSheet({ type: 'settings' })} /></View>
      <View style={styles.monthBar}><RoundButton icon="chevron-back" label="Vorheriger Monat" onPress={() => shiftMonth(-1)} /><TouchableOpacity onPress={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); }} style={styles.monthLabel}><Text style={styles.monthText}>{MONTHS[month]} {year}</Text>{year !== now.getFullYear() || month !== now.getMonth() ? <Text style={styles.todayHint}>Zum aktuellen Monat</Text> : null}</TouchableOpacity><RoundButton icon="chevron-forward" label="Nächster Monat" onPress={() => shiftMonth(1)} /></View>
      <ScrollView contentContainerStyle={styles.jobContent} horizontal showsHorizontalScrollIndicator={false} style={styles.jobs}>{state.employments.map((employment) => { const active = employment.id === state.activeEmploymentId; const color = employmentColors[employment.color].main; return <TouchableOpacity key={employment.id} onPress={() => { void selectEmployment(employment.id); }} style={[styles.jobChip, active && { backgroundColor: color }]}><View style={[styles.jobDot, { backgroundColor: active ? 'rgba(255,255,255,0.9)' : color }]} /><Text style={[styles.jobText, active && styles.jobTextActive]}>{employment.name}</Text></TouchableOpacity>})}</ScrollView>
      {hasDemo ? <View style={styles.demo}><Text style={styles.demoText}>Beispieldaten – so sieht TimeClaim mit Einträgen aus.</Text><TouchableOpacity onPress={() => { void removeDemo(); }}><Text style={styles.demoAction}>Beispieldaten löschen</Text></TouchableOpacity></View> : null}
      {tab === 'days' ? <DaysView employment={activeEmployment} info={info} month={month} onOpenDay={openDay} /> : tab === 'allowances' ? <AllowancesView employment={activeEmployment} info={info} onOpen={(id) => setSheet({ type: 'allowance', id, date: defaultDate })} /> : <ReconciliationView employment={activeEmployment} info={info} key={`${activeEmployment.id}-${info.key}`} onBillingChange={saveBilling} onOpenDay={openDay} />}
    </ScrollView>

    <View style={[styles.dock, { bottom: 12 + insets.bottom }]}><View style={styles.nav}>{([['days', 'calendar-outline', 'Tage'], ['allowances', 'add-circle-outline', 'Zulagen'], ['reconciliation', 'git-compare-outline', 'Abgleich']] as const).map(([key, icon, label]) => <TouchableOpacity accessibilityRole="tab" key={key} onPress={() => setTab(key)} style={[styles.tab, tab === key && styles.tabActive]}><Ionicons color={tab === key ? colors.accent : colors.muted} name={icon} size={22} />{key === 'reconciliation' && deviationCount ? <View style={styles.badge}><Text style={styles.badgeText}>{deviationCount}</Text></View> : null}<Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text></TouchableOpacity>)}</View><TouchableOpacity accessibilityLabel="Neuer Eintrag" onPress={() => openDay(defaultDate, tab === 'days')} style={[styles.fab, { backgroundColor: employmentColors[activeEmployment.color].main }]}><Ionicons color="#FFF" name="add" size={28} /></TouchableOpacity></View>

    {sheet?.type === 'day' ? <DaySheet date={sheet.date} employment={activeEmployment} key={`day-${sheet.date}-${activeEmployment.id}`} onClose={() => setSheet(null)} onDelete={deleteDay} onEditAllowance={(id) => setSheet({ type: 'allowance', id, date: sheet.date })} onOtherAllowance={(date) => setSheet({ type: 'allowance', id: null, date })} onSave={saveDay} presetWork={sheet.presetWork} visible /> : null}
    {sheet?.type === 'allowance' ? <AllowanceSheet initial={editingAllowance} initialDate={sheet.date} key={`allowance-${sheet.id ?? 'new'}-${sheet.date}`} labels={allLabels} onClose={() => setSheet(null)} onDelete={deleteAllowance} onSave={saveAllowance} visible /> : null}
    <SettingsMenu onClose={() => setSheet(null)} onOpenExport={() => setSheet({ type: 'backup' })} onOpenJobs={() => setSheet({ type: 'jobs' })} visible={sheet?.type === 'settings'} />
    <JobsSheet
      onAdd={() => {
        if (!isReady()) return;
        const used = new Set(state.employments.map((item) => item.color));
        const color = [0, 1, 2, 3].find((item) => !used.has(item)) ?? 0;
        void addEmployment('Neuer Job', color).catch(reportError);
      }}
      onChange={(id, patch) => {
        if (!isReady()) return;
        void changeEmployment(id, patch).catch(reportError);
      }}
      onClose={() => setSheet(null)}
      onDelete={(id) => {
        if (!isReady()) return;
        const removed = state.employments.find((item) => item.id === id);
        if (!removed) { notify('Das Arbeitsverhältnis wurde nicht gefunden.'); return; }
        const wasActive = id === state.activeEmploymentId;
        void deleteEmployment(id).then(() => notify(`„${removed.name}“ gelöscht`, 'Rückgängig', () => {
          if (!isReady()) return;
          void restoreEmployment(removed, wasActive).catch(reportError);
        })).catch(reportError);
      }}
      state={state}
      visible={sheet?.type === 'jobs'}
    />
    {sheet?.type === 'backup' ? <BackupSheet key="backup" onClose={() => setSheet(null)} onRestore={restoreBackup} onToast={notify} onWipe={wipe} state={state} visible /> : null}
    <Toast action={toast?.action} message={toast?.message ?? null} onAction={() => { toast?.run?.(); setToast(null); }} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, content: { paddingHorizontal: 16, paddingTop: 18, gap: 16, maxWidth: 640, width: '100%', alignSelf: 'center' }, top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, title: { color: colors.ink, fontFamily: font.extraBold, fontSize: 31, letterSpacing: -1 }, monthBar: { flexDirection: 'row', alignItems: 'center', gap: 8 }, monthLabel: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, monthText: { color: colors.ink, fontFamily: font.extraBold, fontSize: 19, letterSpacing: -0.4 }, todayHint: { color: colors.accent, fontFamily: font.bold, fontSize: 12 }, jobs: { marginHorizontal: -16 }, jobContent: { gap: 8, paddingHorizontal: 16, paddingVertical: 2 }, jobChip: { flexDirection: 'row', alignItems: 'center', gap: 9, height: 42, paddingHorizontal: 16, borderRadius: 21, backgroundColor: colors.card, ...shadow }, jobDot: { width: 9, height: 9, borderRadius: 5 }, jobText: { color: colors.ink2, fontFamily: font.extraBold, fontSize: 14 }, jobTextActive: { color: '#FFF' }, demo: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, backgroundColor: colors.accentSoft, gap: 7 }, demoText: { color: '#233FB0', fontFamily: font.semiBold, fontSize: 13 }, demoAction: { color: colors.accent, fontFamily: font.extraBold, fontSize: 13 }, dock: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', gap: 10, justifyContent: 'center', alignItems: 'center' }, nav: { flex: 1, maxWidth: 420, height: 68, padding: 6, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.96)', flexDirection: 'row', ...shadow }, tab: { flex: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center', gap: 2 }, tabActive: { backgroundColor: colors.accentSoft }, tabText: { color: colors.muted, fontFamily: font.extraBold, fontSize: 11 }, tabTextActive: { color: colors.accent }, badge: { position: 'absolute', top: 3, left: '58%', minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: colors.bad, alignItems: 'center', justifyContent: 'center' }, badgeText: { color: '#FFF', fontFamily: font.extraBold, fontSize: 10 }, fab: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', ...shadow },
});
