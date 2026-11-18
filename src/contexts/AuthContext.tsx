import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import { upsertUserProfile } from '../lib/firestoreService';
import { ThemePreference, UserPrivateInfo, UserPublicProfile } from '../types/models';
import { useTheme } from './ThemeContext';

interface AuthContextValue {
  user: User | null;
  profile: UserPublicProfile | null;
  privateInfo: UserPrivateInfo | null;
  loading: boolean;
  isVerified: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  refreshUser: () => Promise<boolean>;
  logout: () => Promise<void>;
  updateUserProfileData: (data: {
    displayName: string;
    jobTitle: string;
    bio: string;
    photoURL: string;
    themePreference: ThemePreference;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function formatAuthError(err: unknown): { message: string; needsEmailProviderSetup?: boolean } {
  const code = (err as { code?: string })?.code || '';
  switch (code) {
    case 'auth/operation-not-allowed':
    case 'auth/configuration-not-found':
      return {
        message:
          'Email/Password sign-in is not yet enabled in your Firebase Console. Enable it under Authentication -> Sign-in method -> Email/Password, or continue immediately with Google Sign-In.',
        needsEmailProviderSetup: true,
      };
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return { message: 'Invalid email or password. Please check your credentials and try again.' };
    case 'auth/email-already-in-use':
      return { message: 'An account with this email already exists. Try signing in instead.' };
    case 'auth/weak-password':
      return { message: 'Password must be at least 6 characters long.' };
    case 'auth/invalid-email':
      return { message: 'Please enter a valid email address.' };
    case 'auth/popup-closed-by-user':
      return { message: 'Sign-in popup was closed before completing.' };
    case 'auth/too-many-requests':
      return { message: 'Too many attempts. Please wait a moment and try again.' };
    default:
      return {
        message: err instanceof Error ? err.message : 'Authentication failed. Please try again.',
      };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserPublicProfile | null>(null);
  const [privateInfo, setPrivateInfo] = useState<UserPrivateInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const { setTheme } = useTheme();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        setPrivateInfo(null);
        setLoading(false);
        return;
      }

      if (firebaseUser.emailVerified) {
        try {
          await upsertUserProfile({
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            email: firebaseUser.email || '',
            photoURL: firebaseUser.photoURL || '',
          });
        } catch {
          // Handled inside upsertUserProfile
        }
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || !user.emailVerified) {
      setProfile(null);
      setPrivateInfo(null);
      return;
    }

    const userPath = `users/${user.uid}`;
    const unsubPublic = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UserPublicProfile;
          setProfile(data);
          if (data.themePreference) {
            setTheme(data.themePreference);
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, userPath);
      }
    );

    const privatePath = `users/${user.uid}/private/info`;
    const unsubPrivate = onSnapshot(
      doc(db, 'users', user.uid, 'private', 'info'),
      (snap) => {
        if (snap.exists()) {
          setPrivateInfo(snap.data() as UserPrivateInfo);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, privatePath);
      }
    );

    return () => {
      unsubPublic();
      unsubPrivate();
    };
  }, [user, user?.emailVerified, setTheme]);

  const loginWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  };

  const registerWithEmail = async (name: string, email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(cred.user, { displayName: name.trim() });
    await sendEmailVerification(cred.user);
  };

  const loginWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  const resendVerification = async () => {
    if (!auth.currentUser) return;
    await sendEmailVerification(auth.currentUser);
  };

  const refreshUser = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    const refreshed = auth.currentUser;
    setUser(refreshed ? ({ ...refreshed } as User) : null);
    if (refreshed?.emailVerified) {
      await upsertUserProfile({
        uid: refreshed.uid,
        displayName: refreshed.displayName || refreshed.email?.split('@')[0] || 'User',
        email: refreshed.email || '',
        photoURL: refreshed.photoURL || '',
      });
      return true;
    }
    return false;
  };

  const logout = async () => {
    await signOut(auth);
  };

  const updateUserProfileData = async (data: {
    displayName: string;
    jobTitle: string;
    bio: string;
    photoURL: string;
    themePreference: ThemePreference;
  }) => {
    if (!user) return;
    await updateProfile(user, {
      displayName: data.displayName.trim(),
      photoURL: data.photoURL.trim() || undefined,
    });
    await upsertUserProfile(
      {
        uid: user.uid,
        displayName: data.displayName,
        email: user.email || '',
        photoURL: data.photoURL,
      },
      data
    );
    setTheme(data.themePreference);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        privateInfo,
        loading,
        isVerified: Boolean(user?.emailVerified),
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        resetPassword,
        resendVerification,
        refreshUser,
        logout,
        updateUserProfileData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
