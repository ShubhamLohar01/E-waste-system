import { useEffect, useRef } from 'react';

const GSI_SCRIPT = 'https://accounts.google.com/gsi/client';

export function GoogleSignInButton({ onSuccess, onError, mode = 'signin', className }) {
  const containerRef = useRef(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) {
      if (onError) onError(new Error('Google Client ID not configured'));
      return;
    }

    const loadScript = () => {
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
