import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AllowanceSheet } from '@/components/allowance-sheet';
import { BackupSheet } from '@/components/backup-sheet';
import { DaySheet } from '@/components/day-sheet';
import { JobsSheet } from '@/components/jobs-sheet';
import { AllowancesView, DaysView, getDeviationCount, getMonthInfo, ReconciliationView } from '@/components/month-views';
import { SettingsMenu } from '@/components/settings-menu';
import { RoundButton, Toast } from '@/components/primitives';
import { colors, employmentColors, font, shadow } from '@/constants/theme';
import { newEmployment, useAppStore } from '@/context/app-store';
import { MAIN_ALLOWANCES, type Allowance, type BillingRecord, type MainAllowance, type WorkDay } from '@/domain/model';
import { dateKey, monthKey, MONTHS, parseDateKey } from '@/domain/time';

type Tab = 'days' | 'allowances' | 'reconciliation';
type Sheet = { type: 'day'; date: string; presetWork: boolean } | { type: 'allowance'; id: string | null; date: string } | { type: 'settings' } | { type: 'jobs' } | { type: 'backup' } | null;

export default function HomeScreen() {
  const { state, activeEmployment, update, replace, clearDemo, hasDemo } = useAppStore();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [tab, setTab] = useState<Tab>('days');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
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
  const shiftMonth = (offset: number) => { const next = new Date(year, month + offset, 1); setYear(next.getFullYear()); setMonth(next.getMonth()); setSelectedDate(null); };
  const openDay = (date: string, presetWork = true) => setSheet({ type: 'day', date, presetWork });

  const saveDay = (oldDate: string, newDate: string, work: WorkDay | null, managed: Record<MainAllowance, number | null | undefined>) => {
    if (newDate !== oldDate && work && activeEmployment.days[newDate]) { notify('Für dieses Datum gibt es schon einen Arbeitszeit-Eintrag.'); return false; }
    update((draft) => {
      const employment = draft.employments.find((item) => item.id === draft.activeEmploymentId)!;
      const previous = Object.fromEntries(MAIN_ALLOWANCES.map((label) => [label, employment.allowances.find((item) => item.date === oldDate && item.label === label)])) as Record<MainAllowance, Allowance | undefined>;
      employment.allowances = employment.allowances.filter((allowance) => !MAIN_ALLOWANCES.some((label) => allowance === previous[label]));
      delete employment.days[oldDate];
      if (work) employment.days[newDate] = work;
      MAIN_ALLOWANCES.forEach((label) => {
        if (managed[label] !== undefined) employment.allowances.push({ id: previous[label]?.id ?? `${Date.now()}-${label}`, date: newDate, label, quantity: previous[label]?.quantity ?? 1, amount: managed[label] ?? null });
      });
    });
    const moved = parseDateKey(newDate);
    if (monthKey(moved.getFullYear(), moved.getMonth()) !== monthKey(year, month)) { setYear(moved.getFullYear()); setMonth(moved.getMonth()); }
    notify('Gespeichert');
    return true;
  };

  const deleteDay = (date: string) => {
    const oldWork = activeEmployment.days[date];
    const oldAllowances = activeEmployment.allowances.filter((item) => item.date === date);
    update((draft) => { const employment = draft.employments.find((item) => item.id === draft.activeEmploymentId)!; delete employment.days[date]; employment.allowances = employment.allowances.filter((item) => item.date !== date); });
    notify('Eintrag gelöscht', 'Rückgängig', () => update((draft) => { const employment = draft.employments.find((item) => item.id === draft.activeEmploymentId)!; if (oldWork) employment.days[date] = oldWork; employment.allowances.push(...oldAllowances); }));
  };

  const editingAllowance = sheet?.type === 'allowance' && sheet.id ? activeEmployment.allowances.find((item) => item.id === sheet.id) ?? null : null;
  const saveAllowance = (allowance: Allowance) => {
    update((draft) => { const employment = draft.employments.find((item) => item.id === draft.activeEmploymentId)!; const index = employment.allowances.findIndex((item) => item.id === allowance.id); if (index >= 0) employment.allowances[index] = allowance; else employment.allowances.push(allowance); });
    const date = parseDateKey(allowance.date); setYear(date.getFullYear()); setMonth(date.getMonth()); notify('Zulage gespeichert');
  };
  const deleteAllowance = (allowance: Allowance) => { update((draft) => { const employment = draft.employments.find((item) => item.id === draft.activeEmploymentId)!; employment.allowances = employment.allowances.filter((item) => item.id !== allowance.id); }); notify('Zulage gelöscht', 'Rückgängig', () => update((draft) => { draft.employments.find((item) => item.id === draft.activeEmploymentId)!.allowances.push(allowance); })); };
  const wipe = () => { const employment = newEmployment(); replace({ version: 1, employments: [employment], activeEmploymentId: employment.id }); notify('Alle Daten gelöscht'); };

  return <SafeAreaView edges={['top']} style={styles.safe}>
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 112 + insets.bottom }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.top}><Text style={styles.title}>Stundenbuch</Text><RoundButton icon="settings-outline" label="Einstellungen öffnen" onPress={() => setSheet({ type: 'settings' })} /></View>
      <View style={styles.monthBar}><RoundButton icon="chevron-back" label="Vorheriger Monat" onPress={() => shiftMonth(-1)} /><TouchableOpacity onPress={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); setSelectedDate(null); }} style={styles.monthLabel}><Text style={styles.monthText}>{MONTHS[month]} {year}</Text>{year !== now.getFullYear() || month !== now.getMonth() ? <Text style={styles.todayHint}>Zum aktuellen Monat</Text> : null}</TouchableOpacity><RoundButton icon="chevron-forward" label="Nächster Monat" onPress={() => shiftMonth(1)} /></View>
      <ScrollView contentContainerStyle={styles.jobContent} horizontal showsHorizontalScrollIndicator={false} style={styles.jobs}>{state.employments.map((employment) => { const active = employment.id === state.activeEmploymentId; const color = employmentColors[employment.color].main; return <TouchableOpacity key={employment.id} onPress={() => { update((draft) => { draft.activeEmploymentId = employment.id; }); setSelectedDate(null); }} style={[styles.jobChip, active && { backgroundColor: color }]}><View style={[styles.jobDot, { backgroundColor: active ? 'rgba(255,255,255,0.9)' : color }]} /><Text style={[styles.jobText, active && styles.jobTextActive]}>{employment.name}</Text></TouchableOpacity>})}</ScrollView>
      {hasDemo ? <View style={styles.demo}><Text style={styles.demoText}>Beispieldaten – so sieht das Stundenbuch mit Einträgen aus.</Text><TouchableOpacity onPress={() => { clearDemo(); notify('Beispieldaten gelöscht'); }}><Text style={styles.demoAction}>Beispieldaten löschen</Text></TouchableOpacity></View> : null}
      {tab === 'days' ? <DaysView employment={activeEmployment} info={info} month={month} onOpenDay={openDay} onSelectDate={setSelectedDate} selectedDate={selectedDate} /> : tab === 'allowances' ? <AllowancesView employment={activeEmployment} info={info} onOpen={(id) => setSheet({ type: 'allowance', id, date: defaultDate })} /> : <ReconciliationView employment={activeEmployment} info={info} key={`${activeEmployment.id}-${info.key}`} onBillingChange={(billing: BillingRecord) => update((draft) => { const employment = draft.employments.find((item) => item.id === draft.activeEmploymentId)!; employment.billing[info.key] = billing; })} onOpenDay={openDay} />}
    </ScrollView>

    <View style={[styles.dock, { bottom: 12 + insets.bottom }]}><View style={styles.nav}>{([['days', 'calendar-outline', 'Tage'], ['allowances', 'add-circle-outline', 'Zulagen'], ['reconciliation', 'git-compare-outline', 'Abgleich']] as const).map(([key, icon, label]) => <TouchableOpacity accessibilityRole="tab" key={key} onPress={() => setTab(key)} style={[styles.tab, tab === key && styles.tabActive]}><Ionicons color={tab === key ? colors.accent : colors.muted} name={icon} size={22} />{key === 'reconciliation' && deviationCount ? <View style={styles.badge}><Text style={styles.badgeText}>{deviationCount}</Text></View> : null}<Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text></TouchableOpacity>)}</View><TouchableOpacity accessibilityLabel="Neuer Eintrag" onPress={() => openDay(defaultDate, tab === 'days')} style={styles.fab}><Ionicons color="#FFF" name="add" size={28} /></TouchableOpacity></View>

    {sheet?.type === 'day' ? <DaySheet date={sheet.date} employment={activeEmployment} key={`day-${sheet.date}-${activeEmployment.id}`} onClose={() => setSheet(null)} onDelete={deleteDay} onEditAllowance={(id) => setSheet({ type: 'allowance', id, date: sheet.date })} onOtherAllowance={(date) => setSheet({ type: 'allowance', id: null, date })} onSave={saveDay} presetWork={sheet.presetWork} visible /> : null}
    {sheet?.type === 'allowance' ? <AllowanceSheet initial={editingAllowance} initialDate={sheet.date} key={`allowance-${sheet.id ?? 'new'}-${sheet.date}`} labels={allLabels} onClose={() => setSheet(null)} onDelete={deleteAllowance} onSave={saveAllowance} visible /> : null}
    <SettingsMenu onClose={() => setSheet(null)} onOpenExport={() => setSheet({ type: 'backup' })} onOpenJobs={() => setSheet({ type: 'jobs' })} visible={sheet?.type === 'settings'} />
    <JobsSheet onAdd={() => update((draft) => { const used = new Set(draft.employments.map((item) => item.color)); const color = [0, 1, 2, 3].find((item) => !used.has(item)) ?? 0; const employment = newEmployment('Neuer Job', color); draft.employments.push(employment); draft.activeEmploymentId = employment.id; })} onChange={(id, patch) => update((draft) => Object.assign(draft.employments.find((item) => item.id === id)!, patch))} onClose={() => setSheet(null)} onDelete={(id) => { const removed = state.employments.find((item) => item.id === id)!; update((draft) => { draft.employments = draft.employments.filter((item) => item.id !== id); if (draft.activeEmploymentId === id) draft.activeEmploymentId = draft.employments[0].id; }); notify(`„${removed.name}“ gelöscht`, 'Rückgängig', () => update((draft) => { draft.employments.push(removed); })); }} state={state} visible={sheet?.type === 'jobs'} />
    {sheet?.type === 'backup' ? <BackupSheet key="backup" onClose={() => setSheet(null)} onRestore={replace} onToast={notify} onWipe={wipe} state={state} visible /> : null}
    <Toast action={toast?.action} message={toast?.message ?? null} onAction={() => { toast?.run?.(); setToast(null); }} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, content: { paddingHorizontal: 16, paddingTop: 18, gap: 16, maxWidth: 640, width: '100%', alignSelf: 'center' }, top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, title: { color: colors.ink, fontFamily: font.extraBold, fontSize: 31, letterSpacing: -1 }, monthBar: { flexDirection: 'row', alignItems: 'center', gap: 8 }, monthLabel: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, monthText: { color: colors.ink, fontFamily: font.extraBold, fontSize: 19, letterSpacing: -0.4 }, todayHint: { color: colors.accent, fontFamily: font.bold, fontSize: 12 }, jobs: { marginHorizontal: -16 }, jobContent: { gap: 8, paddingHorizontal: 16, paddingVertical: 2 }, jobChip: { flexDirection: 'row', alignItems: 'center', gap: 9, height: 42, paddingHorizontal: 16, borderRadius: 21, backgroundColor: colors.card, ...shadow }, jobDot: { width: 9, height: 9, borderRadius: 5 }, jobText: { color: colors.ink2, fontFamily: font.extraBold, fontSize: 14 }, jobTextActive: { color: '#FFF' }, demo: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, backgroundColor: colors.accentSoft, gap: 7 }, demoText: { color: '#233FB0', fontFamily: font.semiBold, fontSize: 13 }, demoAction: { color: colors.accent, fontFamily: font.extraBold, fontSize: 13 }, dock: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', gap: 10, justifyContent: 'center', alignItems: 'center' }, nav: { flex: 1, maxWidth: 420, height: 68, padding: 6, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.96)', flexDirection: 'row', ...shadow }, tab: { flex: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center', gap: 2 }, tabActive: { backgroundColor: colors.accentSoft }, tabText: { color: colors.muted, fontFamily: font.extraBold, fontSize: 11 }, tabTextActive: { color: colors.accent }, badge: { position: 'absolute', top: 3, left: '58%', minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: colors.bad, alignItems: 'center', justifyContent: 'center' }, badgeText: { color: '#FFF', fontFamily: font.extraBold, fontSize: 10 }, fab: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', ...shadow },
});
