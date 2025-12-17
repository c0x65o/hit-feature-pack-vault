// Re-export unified modal with SMS mode for backward compatibility
// This file is deprecated - use OtpWaitingModal with mode="sms" instead
import { OtpWaitingModal } from './OtpWaitingModal';

interface Props {
  open: boolean;
  onClose: () => void;
  itemTitle?: string;
  phoneNumber?: string | null;
  onOtpCopied?: () => void;
}

export function OtpWaitingModalSms({ open, onClose, itemTitle, phoneNumber }: Props) {
  return (
    <OtpWaitingModal
      open={open}
      mode="sms"
      onClose={onClose}
      itemTitle={itemTitle}
      phoneNumber={phoneNumber}
    />
  );
}
