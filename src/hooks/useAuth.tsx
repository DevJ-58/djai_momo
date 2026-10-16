import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type UserRole = 'admin' | 'agent';

export type AuthProfile = {
  id: string;
  full_name: string;
  whatsapp: string;
  role: UserRole;
  is_suspended: boolean;
  created_at: string;
};

type SignUpInput = {
  fullName: string;
  whatsapp: string;
  email: string;
  password: string;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: AuthProfile | null;
  role: UserRole | null;
  isSuspended: boolean;
  loading: boolean;
  profileError: string | null;
  passwordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<{ needsEmailConfirmation: boolean }>;
  resendSignupConfirmation: (email: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function frenchAuthError(error: unknown): string {
  const errorRecord = error instanceof Error ? error : null;
  const message = errorRecord?.message.toLocaleLowerCase('fr') ?? '';
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code).toLocaleLowerCase('fr')
      : '';
  const details = `${code} ${message}`;

  if (
    details.includes('invalid_credentials') ||
    details.includes('invalid login credentials')
  ) {
    return 'Adresse e-mail ou mot de passe incorrect.';
  }
  if (details.includes('email not confirmed') || details.includes('email_not_confirmed')) {
    return "Votre email n'est pas encore confirmé.";
  }
  if (
    details.includes('email_exists') ||
    details.includes('user_already_exists') ||
    details.includes('already registered') ||
    details.includes('already been registered')
  ) {
    return 'Cette adresse e-mail est déjà utilisée.';
  }
  if (
    details.includes('weak_password') ||
    details.includes('password should be at least') ||
    details.includes('password is too weak')
  ) {
    return 'Le mot de passe est trop faible. Choisissez-en un plus sûr.';
  }
  if (details.includes('invalid email') || details.includes('email_address_invalid')) {
    return 'Saisissez une adresse e-mail valide.';
  }
  if (
    details.includes('otp_expired') ||
    details.includes('invalid token') ||
    details.includes('expired') ||
    details.includes('flow_state_not_found')
  ) {
    return 'Ce lien est invalide ou a expiré. Demandez un nouveau lien.';
  }
  if (
    error instanceof TypeError ||
    details.includes('network') ||
    details.includes('fetch') ||
    details.includes('timeout') ||
    details.includes('offline')
  ) {
    return 'Connexion impossible. Vérifiez votre connexion internet puis réessayez.';
  }
  return 'Une erreur est survenue. Veuillez réessayer.';
}

async function fetchProfile(userId: string): Promise<AuthProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, whatsapp, role, is_suspended, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data as AuthProfile | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [sessionResolved, setSessionResolved] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const sessionUserId = useRef<string | null>(null);
  const user = session?.user ?? null;
  const userId = user?.id ?? null;

  useEffect(() => {
    let active = true;
    let authEventReceived = false;

    const applySession = (nextSession: Session | null) => {
      const nextUserId = nextSession?.user.id ?? null;
      if (sessionUserId.current !== nextUserId) {
        sessionUserId.current = nextUserId;
        setProfile(null);
        setProfileError(null);
        setProfileLoading(Boolean(nextSession));
      }
      setSession(nextSession);
      setSessionResolved(true);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      authEventReceived = true;
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      applySession(nextSession);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active || authEventReceived) return;
      if (error) {
        setProfileError(frenchAuthError(error));
        applySession(null);
      } else {
        applySession(data.session);
      }
    }).catch((error: unknown) => {
      if (!active || authEventReceived) return;
      setProfileError(frenchAuthError(error));
      applySession(null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    try {
      const nextProfile = await fetchProfile(userId);
      if (!nextProfile) {
        setProfile(null);
        setProfileError('Votre profil est introuvable. Réessayez ou contactez l’administrateur.');
        setProfileLoading(false);
        return;
      }
      setProfile(nextProfile);
      setProfileError(null);
      setProfileLoading(false);
    } catch {
      setProfileError('Impossible de charger votre profil. Vérifiez votre connexion puis réessayez.');
      setProfileLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    let active = true;
    setProfileLoading(true);
    setProfileError(null);

    const loadProfile = async () => {
      if (!active) return;
      try {
        const nextProfile = await fetchProfile(userId);
        if (!active) return;
        if (!nextProfile) {
          setProfileError('Votre profil est introuvable. Réessayez ou contactez l’administrateur.');
          setProfile(null);
        } else {
          setProfile(nextProfile);
          setProfileError(null);
        }
      } catch {
        if (!active) return;
        setProfileError('Impossible de charger votre profil. Vérifiez votre connexion puis réessayez.');
        setProfile(null);
      } finally {
        if (active) setProfileLoading(false);
      }
    };

    void loadProfile();

    const channel = supabase
      .channel(`profile-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        () => { void refreshProfile(); },
      )
      .subscribe();

    const onFocus = () => { void refreshProfile(); };
    window.addEventListener('focus', onFocus);

    return () => {
      active = false;
      window.removeEventListener('focus', onFocus);
      void supabase.removeChannel(channel);
    };
  }, [userId, refreshProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error) {
      throw new Error(frenchAuthError(error));
    }
  }, []);

  const signUp = useCallback(async ({ fullName, whatsapp, email, password }: SignUpInput) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, whatsapp },
          emailRedirectTo: `${window.location.origin}/connexion`,
        },
      });
      if (error) throw error;
      return { needsEmailConfirmation: !data.session };
    } catch (error) {
      throw new Error(frenchAuthError(error));
    }
  }, []);

  const resendSignupConfirmation = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${window.location.origin}/connexion` },
      });
      if (error) throw error;
    } catch (error) {
      throw new Error(frenchAuthError(error));
    }
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reinitialiser-mot-de-passe`,
      });
      if (error) throw error;
    } catch (error) {
      throw new Error(frenchAuthError(error));
    }
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPasswordRecovery(false);
    } catch (error) {
      throw new Error(frenchAuthError(error));
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      throw new Error(frenchAuthError(error));
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user,
    profile,
    role: profile?.role ?? null,
    isSuspended: profile?.role === 'agent' && profile.is_suspended,
    loading: !sessionResolved || (Boolean(session) && profileLoading),
    profileError,
    passwordRecovery,
    signIn,
    signUp,
    resendSignupConfirmation,
    sendPasswordReset,
    updatePassword,
    signOut,
    refreshProfile,
  }), [
    session,
    user,
    profile,
    sessionResolved,
    profileLoading,
    profileError,
    passwordRecovery,
    signIn,
    signUp,
    resendSignupConfirmation,
    sendPasswordReset,
    updatePassword,
    signOut,
    refreshProfile,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth doit être utilisé dans AuthProvider.');
  return context;
}
