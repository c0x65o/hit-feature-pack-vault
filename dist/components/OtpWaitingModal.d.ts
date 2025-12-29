type OtpMode = 'email' | 'sms';
interface Props {
    open: boolean;
    onClose: () => void;
    itemTitle?: string;
    mode: OtpMode;
    emailAddress?: string | null;
    phoneNumber?: string | null;
}
export declare function OtpWaitingModal({ open, onClose, itemTitle, mode, emailAddress, phoneNumber }: Props): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=OtpWaitingModal.d.ts.map