import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: { theme?: 'outline' | 'filled_blue' | 'filled_black'; size?: 'large' | 'medium' | 'small'; type?: 'standard' | 'icon'; text?: 'signin_with' | 'signup_with' | 'continue_with' }
          ) => void;
        };
      };
    };
  }
}

const GSI_SCRIPT = 'https://accounts.google.com/gsi/client';

interface GoogleSignInButtonProps {
  onSuccess: (credential: string) => void;
  onError?: (error: Error) => void;
  mode?: 'signin' | 'signup';
  className?: string;
}

export function GoogleSignInButton({ onSuccess, onError, mode = 'signin', className }: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useEffect(() => {
    if (!clientId) {
      if (onError) onError(new Error('Google Client ID not configured'));
      return;
    }

    const loadScript = (): Promise<void> => {
      if (document.querySelector(`script[src="${GSI_SCRIPT}"]`)) {
        return Promise.resolve();
      }
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = GSI_SCRIPT;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Google script'));
        document.head.appendChild(script);
      });
    };

    let mounted = true;
    loadScript()
      .then(() => {
        if (!mounted || !window.google || !containerRef.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (res) => onSuccess(res.credential),
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          text: mode === 'signup' ? 'signup_with' : 'signin_with',
        });
      })
      .catch((err) => onError?.(err));

    return () => {
      mounted = false;
    };
  }, [clientId, mode, onSuccess, onError]);

  if (!clientId) {
    return (
      <div className={`rounded-lg border border-border bg-muted/30 px-4 py-3 text-center text-sm text-muted-foreground ${className ?? ''}`}>
        Google sign-in not configured (set VITE_GOOGLE_CLIENT_ID)
      </div>
    );
  }

  return <div ref={containerRef} className={className} />;
}
