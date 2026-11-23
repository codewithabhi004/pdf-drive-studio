import { lazy, Suspense, useEffect, useState } from 'react';
import {
  Cloud, FileImage, FilePlus2, Files, LogOut, Moon, Sun, Upload,
} from 'lucide-react';
const ReadEditPdf = lazy(() => import('./components/ReadEditPdf.jsx'));
const CreatePdf = lazy(() => import('./components/CreatePdf.jsx'));
const PdfToPages = lazy(() => import('./components/PdfToPages.jsx'));
const PagesToPdf = lazy(() => import('./components/PagesToPdf.jsx'));
const MyDrive = lazy(() => import('./components/MyDrive.jsx'));
import {
  getGoogleClientId, getGoogleProfile, requestGoogleAccessToken, setGoogleAccessToken,
  uploadFileToDrive, revokeGoogleAccessToken,
} from './services/googleDrive.js';
import { setDriveUploadAdapter, subscribeToOutputs } from './utils/outputHandler.js';

const tabs = [
  { id: 'read', label: 'Read & Edit', short: 'Read & Edit', icon: Files },
  { id: 'create', label: 'Create PDF', short: 'Create PDF', icon: FilePlus2 },
  { id: 'extract', label: 'PDF to Pages', short: 'PDF to Pages', icon: FileImage },
  { id: 'merge', label: 'Pages to PDF', short: 'Pages to PDF', icon: Upload },
  { id: 'drive', label: 'My Drive Files', short: 'My Drive', icon: Cloud },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('read');
  const [dark, setDark] = useState(() => localStorage.getItem('pdf-studio-theme') === 'dark');
  const [account, setAccount] = useState(null);
  const [signingIn, setSigningIn] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('pdf-studio-theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    setDriveUploadAdapter(account ? uploadFileToDrive : null);
    return () => setDriveUploadAdapter(null);
  }, [account]);

  useEffect(() => subscribeToOutputs((entry) => {
    if (entry.driveStatus === 'uploaded') {
      setToast({ type: 'success', message: 'Saved to Google Drive' });
    } else if (entry.driveStatus === 'error') {
      setToast({ type: 'error', message: `Download ready; Drive upload failed: ${entry.driveError}` });
    } else if (entry.driveStatus === 'local-only') {
      setToast({ type: 'info', message: `${entry.fileName} downloaded` });
    }
  }), []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function signIn() {
    setSigningIn(true);
    try {
      const token = await requestGoogleAccessToken();
      setGoogleAccessToken(token);
      setAccount(await getGoogleProfile(token));
      setToast({ type: 'success', message: 'Google Drive connected' });
    } catch (error) {
      setToast({ type: 'error', message: error.message });
    } finally {
      setSigningIn(false);
    }
  }

  function signOut() {
    revokeGoogleAccessToken();
    setAccount(null);
    setActiveTab('read');
    setToast({ type: 'info', message: 'Signed out of Google Drive' });
  }

  const active = tabs.find((tab) => tab.id === activeTab);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button className="flex min-w-0 items-center gap-3 text-left" onClick={() => setActiveTab('read')} aria-label="PDF Drive Studio home">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
              <Files size={21} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold tracking-tight sm:text-base">PDF Drive Studio</span>
              <span className="hidden text-xs text-slate-500 sm:block">Your documents, all in one place</span>
            </span>
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => setDark(!dark)} className="grid h-10 w-10 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {account ? (
              <div className="flex items-center gap-2">
                <div className="hidden items-center gap-2 sm:flex">
                  {account.picture && <img src={account.picture} alt="" className="h-8 w-8 rounded-full" />}
                  <span className="max-w-32 truncate text-sm font-medium">{account.name || account.email}</span>
                </div>
                <button onClick={signOut} className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800" aria-label="Sign out">
                  <LogOut size={16} /><span className="hidden sm:inline">Sign out</span>
                </button>
              </div>
            ) : (
              <button onClick={signIn} disabled={signingIn} className="flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60 sm:px-4">
                <Cloud size={17} />{signingIn ? 'Connecting…' : <><span className="hidden sm:inline">Sign in with Google</span><span className="sm:hidden">Sign in</span></>}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-3 pb-28 pt-5 sm:px-6 sm:pb-10 lg:grid-cols-[230px_minmax(0,1fr)] lg:pt-8">
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-1">
            <p className="mb-3 px-3 text-xs font-bold uppercase tracking-widest text-slate-400">Workspace</p>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${activeTab === tab.id ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900'}`}>
                  <Icon size={18} />{tab.label}
                </button>
              );
            })}
            <div className="mt-7 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 dark:border-indigo-900/70 dark:bg-indigo-950/40">
              <Cloud size={19} className="mb-2 text-indigo-600 dark:text-indigo-300" />
              <p className="text-sm font-bold">Private by design</p>
              <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">Your documents are processed in this browser. Drive upload is optional.</p>
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">PDF WORKSPACE</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{active?.label}</h1>
          </div>
          <Suspense fallback={<div className="panel p-10 text-center text-sm text-slate-500">Loading tool…</div>}>
            {activeTab === 'read' && <ReadEditPdf />}
            {activeTab === 'create' && <CreatePdf />}
            {activeTab === 'extract' && <PdfToPages />}
            {activeTab === 'merge' && <PagesToPdf />}
            {activeTab === 'drive' && <MyDrive account={account} onSignIn={signIn} />}
          </Suspense>
          {!getGoogleClientId() && (
            <p className="mt-5 text-center text-xs text-slate-400">Set VITE_GOOGLE_CLIENT_ID in .env to enable Drive sync.</p>
          )}
        </main>
      </div>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-1 pt-2 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95 lg:hidden">
        <div className="mx-auto flex max-w-lg justify-around">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 pb-2 text-[10px] font-semibold ${activeTab === tab.id ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-500'}`}>
                <Icon size={20} strokeWidth={activeTab === tab.id ? 2.4 : 1.8} />
                <span className="truncate">{tab.short}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {toast && (
        <div role="status" className={`fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-xl lg:bottom-6 ${toast.type === 'error' ? 'bg-rose-600' : toast.type === 'success' ? 'bg-emerald-600' : 'bg-slate-800'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
