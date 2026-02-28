import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useRemindersStore } from '../store/useRemindersStore';
import { scheduleReminder } from '../services/notificationService';

interface Props {
  visible: boolean;
  text: string;
  onClose: () => void;
  onScheduled: () => void;
}

type QuickOption = {
  label: string;
  getDate: () => Date;
};

const QUICK_OPTIONS: QuickOption[] = [
  {
    label: 'In 1 hour',
    getDate: () => new Date(Date.now() + 60 * 60 * 1000),
  },
  {
    label: 'Tonight 8pm',
    getDate: () => {
      const d = new Date();
      d.setHours(20, 0, 0, 0);
      if (d <= new Date()) d.setDate(d.getDate() + 1);
      return d;
    },
  },
  {
    label: 'Tomorrow 9am',
    getDate: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  },
  {
    label: 'Next Monday',
    getDate: () => {
      const d = new Date();
      const day = d.getDay();
      const daysUntilMonday = (8 - day) % 7 || 7;
      d.setDate(d.getDate() + daysUntilMonday);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  },
];

function formatSelected(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ReminderModal({ visible, text, onClose, onScheduled }: Props) {
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d;
  });
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [scheduling, setScheduling] = useState(false);

  const { addReminder, updateNotificationId } = useRemindersStore();

  const handleQuick = (opt: QuickOption) => {
    setSelectedDate(opt.getDate());
  };

  const handlePickerChange = (_: DateTimePickerEvent, date?: Date) => {
    if (!date) return;
    setSelectedDate(date);
    if (Platform.OS === 'android') {
      if (pickerMode === 'date') {
        setPickerMode('time');
      } else {
        setShowPicker(false);
        setPickerMode('date');
      }
    }
  };

  const handleSchedule = async () => {
    if (!text.trim() || selectedDate <= new Date()) return;
    setScheduling(true);
    try {
      const reminder = await addReminder(text.trim(), selectedDate.toISOString());
      const notifId = await scheduleReminder(reminder);
      await updateNotificationId(reminder.id, notifId);
      onScheduled();
    } finally {
      setScheduling(false);
    }
  };

  const openDatePicker = () => {
    setPickerMode('date');
    setShowPicker(true);
  };

  const isPast = selectedDate <= new Date();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <View style={styles.sheet}>
        <View style={styles.handle} />

        <Text style={styles.title}>Set Reminder</Text>
        <Text style={styles.reminderText} numberOfLines={2}>
          "{text}"
        </Text>

        {/* Quick options */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickScroll}>
          {QUICK_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.label}
              style={styles.quickBtn}
              onPress={() => handleQuick(opt)}
            >
              <Text style={styles.quickText}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Custom date/time picker trigger */}
        <TouchableOpacity style={styles.customBtn} onPress={openDatePicker}>
          <Text style={styles.customLabel}>Custom date & time</Text>
          <Text style={styles.customValue}>{formatSelected(selectedDate)}</Text>
        </TouchableOpacity>

        {/* Native picker (iOS shows inline, Android shows dialog) */}
        {showPicker && (
          <DateTimePicker
            value={selectedDate}
            mode={pickerMode}
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            minimumDate={new Date()}
            onChange={handlePickerChange}
            themeVariant="dark"
          />
        )}
        {Platform.OS === 'ios' && showPicker && (
          <TouchableOpacity style={styles.doneBtn} onPress={() => setShowPicker(false)}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        )}

        {/* Selected summary + schedule button */}
        {!showPicker && (
          <>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Scheduled for</Text>
              <Text style={[styles.summaryValue, isPast && styles.summaryValueError]}>
                {isPast ? 'Choose a future time' : formatSelected(selectedDate)}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.scheduleBtn, (isPast || scheduling) && styles.scheduleBtnDisabled]}
              onPress={handleSchedule}
              disabled={isPast || scheduling}
            >
              <Text style={styles.scheduleBtnText}>
                {scheduling ? 'Scheduling…' : 'Schedule Reminder'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    gap: 14,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#475569',
    alignSelf: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#f1f5f9' },
  reminderText: {
    fontSize: 14,
    color: '#94a3b8',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  quickScroll: { flexGrow: 0 },
  quickBtn: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  quickText: { color: '#a5b4fc', fontSize: 13, fontWeight: '600' },
  customBtn: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  customLabel: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  customValue: { fontSize: 15, color: '#e2e8f0', fontWeight: '600' },
  doneBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#6366f1',
    borderRadius: 8,
  },
  doneBtnText: { color: '#fff', fontWeight: '700' },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  summaryLabel: { fontSize: 13, color: '#64748b' },
  summaryValue: { fontSize: 14, color: '#a5b4fc', fontWeight: '600' },
  summaryValueError: { color: '#f87171' },
  scheduleBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  scheduleBtnDisabled: { backgroundColor: '#334155' },
  scheduleBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
