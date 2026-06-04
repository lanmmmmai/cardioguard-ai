interface GoogleCredentialResponse {
  credential?: string;
  select_by?: string;
}

interface GoogleIdButtonConfiguration {
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  logo_alignment?: 'left' | 'center';
  width?: number;
  locale?: string;
}

interface GoogleIdConfiguration {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
}

interface GoogleIdentityAccountsId {
  initialize: (config: GoogleIdConfiguration) => void;
  renderButton: (parent: HTMLElement, options: GoogleIdButtonConfiguration) => void;
  disableAutoSelect: () => void;
  prompt: (momentListener?: (notification: unknown) => void) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: GoogleIdentityAccountsId;
      };
    };
  }
}

export {};
