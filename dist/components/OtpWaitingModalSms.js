import { jsx as _jsx } from "react/jsx-runtime";
// Re-export unified modal with SMS mode for backward compatibility
// This file is deprecated - use OtpWaitingModal with mode="sms" instead
import { OtpWaitingModal } from './OtpWaitingModal';
export function OtpWaitingModalSms({ open, onClose, itemTitle, phoneNumber }) {
    return (_jsx(OtpWaitingModal, { open: open, mode: "sms", onClose: onClose, itemTitle: itemTitle, phoneNumber: phoneNumber }));
}
