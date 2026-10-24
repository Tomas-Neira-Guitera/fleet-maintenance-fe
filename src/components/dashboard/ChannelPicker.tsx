import type { NotificationChannel } from '../../types/domain';
import { CHANNEL_LABEL } from '../../utils/notificationLabels';

const CHANNELS: NotificationChannel[] = ['in_app', 'push', 'email'];

interface ChannelPickerProps {
  value: NotificationChannel[];
  onChange: (channels: NotificationChannel[]) => void;
  disabled?: boolean;
  /** Para el nombre accesible del grupo, ej. "Canales de Orden de trabajo finalizada". */
  label: string;
}

/** Por dónde sale un aviso (CAM-117): campanita, push al navegador o email. */
export function ChannelPicker({ value, onChange, disabled, label }: ChannelPickerProps) {
  function toggle(channel: NotificationChannel) {
    const next = value.includes(channel) ? value.filter((c) => c !== channel) : [...value, channel];
    onChange(CHANNELS.filter((c) => next.includes(c)));
  }

  return (
    <div className="notif-chips" role="group" aria-label={label}>
      {CHANNELS.map((channel) => (
        <label key={channel} className={`notif-chip${value.includes(channel) ? ' notif-chip--on' : ''}`}>
          <input
            type="checkbox"
            checked={value.includes(channel)}
            onChange={() => toggle(channel)}
            disabled={disabled}
          />
          {CHANNEL_LABEL[channel]}
        </label>
      ))}
    </div>
  );
}
