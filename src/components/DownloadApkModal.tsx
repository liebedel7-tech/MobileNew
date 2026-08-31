import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Smartphone, 
  CheckCircle2, 
  ShieldCheck, 
  ArrowDownToLine, 
  FileCode2, 
  Terminal,
  HelpCircle,
  Layers,
  Copy,
  Sparkles
} from 'lucide-react';
import { OfficialLogo } from './OfficialLogo';
import { APP_OFFICIAL_TITLE, APP_OFFICIAL_BADGE } from '../constants/branding';

interface DownloadApkModalProps {
  onClose: () => void;
  deferredPrompt?: any;
}

export const DownloadApkModal: React.FC<DownloadApkModalProps> = ({
  onClose,
  deferredPrompt,
}) => {
  const [installStatus, setInstallStatus] = useState<'IDLE' | 'INSTALLED' | 'FAILED'>('IDLE');
  const [activeTab, setActiveTab] = useState<'INSTALL' | 'FLUTTER_APK' | 'MANUAL'>('INSTALL');
  const [copiedCmd, setCopiedCmd] = useState(false);

  const handleTriggerNativeInstall = async () => {
    if (deferredPrompt && typeof deferredPrompt.prompt === 'function') {
      try {
        await deferredPrompt.prompt();
        if (deferredPrompt.userChoice) {
          const { outcome } = await deferredPrompt.userChoice;
          if (outcome === 'accepted') {
            setInstallStatus('INSTALLED');
          }
        }
      } catch (err) {
        console.warn('Install prompt was already triggered or dismissed:', err);
      }
    } else {
      alert(
        'To install the app on your device:\n\n1. Open this app in Chrome / Samsung Internet / Safari.\n2. Tap the browser Menu (⋮ or Share).\n3. Tap "Install App" or "Add to Home Screen".\n\nYour device will install the standalone Tagoloan Water District App!'
      );
    }
  };

  const handleDownloadFlutterApkManifest = () => {
    const flutterApkManifest = {
      app_name: 'Tagoloan Water District Meter Reader',
      framework: 'Flutter 3.29.0 (Dart 3.7.0)',
      package_name: 'ph.gov.tagoloanwaterdistrict.meterreader',
      version_name: '2.4.0',
      version_code: 240,
      min_sdk_version: 24, // Android 7.0+
      target_sdk_version: 34, // Android 14
      orientation: 'portrait',
      state_management: 'Provider / Riverpod',
      local_database: 'SQFLite (Encrypted Embedded SQLite)',
      permissions: [
        'android.permission.CAMERA',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.INTERNET',
        'android.permission.ACCESS_NETWORK_STATE',
        'android.permission.BLUETOOTH',
        'android.permission.BLUETOOTH_CONNECT',
        'android.permission.VIBRATE',
      ],
      twa_url: window.location.origin,
      theme_color: '#0f172a',
      background_color: '#020617',
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(flutterApkManifest, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'wdt-flutter-meter-reader-apk.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Top Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <OfficialLogo size="sm" glow />
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-1.5">
                <span>{APP_OFFICIAL_TITLE}</span>
                <span className="text-[9px] bg-sky-950 text-sky-400 border border-sky-800 px-1.5 py-0.2 rounded font-mono">
                  v2.4.0
                </span>
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">
                ph.gov.tagoloanwaterdistrict.meterreader
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-950 p-1 border-b border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('INSTALL')}
            className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'INSTALL'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>1-Click APK Install</span>
          </button>
          <button
            onClick={() => setActiveTab('FLUTTER_APK')}
            className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'FLUTTER_APK'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Flutter Build Specs</span>
          </button>
          <button
            onClick={() => setActiveTab('MANUAL')}
            className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'MANUAL'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Android Setup</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {activeTab === 'INSTALL' && (
            <div className="space-y-4">
              {/* Feature Hero Box */}
              <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950/40 p-4 rounded-2xl border border-sky-900/50 space-y-3">
                <div className="flex items-center gap-3">
                  <OfficialLogo size="md" glow />
                  <div>
                    <h3 className="text-base font-black text-white">
                      {APP_OFFICIAL_TITLE}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Official Mobile App
                      </span>
                      <span className="text-[11px] text-slate-400">Offline SQLite & Central Sync</span>
                    </div>
                  </div>
                </div>

                <p className="text-slate-300 leading-relaxed text-[11.5px]">
                  Installs as a native full-screen Android application on any smartphone or field terminal. Operates 100% offline for OCR dial scans, GPS geotagging, graduated tariff calculation, and Bluetooth receipt printing.
                </p>
              </div>

              {/* Action Button */}
              <button
                onClick={handleTriggerNativeInstall}
                className="w-full bg-sky-600 hover:bg-sky-500 text-white font-black py-3.5 rounded-2xl shadow-xl shadow-sky-600/30 flex items-center justify-center gap-2 text-sm uppercase tracking-wider transition hover:scale-[1.01] active:scale-[0.99]"
              >
                <Download className="w-4 h-4" />
                <span>Install the App on Your Device</span>
              </button>

              {/* Flutter Native Capabilities */}
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Built-in Flutter Mobile Capabilities:
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>ML Kit Camera OCR</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Geolocator GPS Tagging</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>SQFLite Offline Vault</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Bluetooth ESC/POS Print</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'FLUTTER_APK' && (
            <div className="space-y-3">
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2 font-mono text-[11px]">
                <div className="text-sky-400 font-bold flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span>Flutter Package Specification</span>
                  <span className="text-[9px] bg-slate-800 px-2 py-0.5 rounded text-slate-300">Dart 3.7 / Flutter 3.29</span>
                </div>
                <div className="text-slate-300 space-y-1">
                  <div><strong>Application:</strong> Tagoloan Water District Reader</div>
                  <div><strong>Package:</strong> ph.gov.tagoloanwaterdistrict.meterreader</div>
                  <div><strong>Version:</strong> 2.4.0 (Build 240)</div>
                  <div><strong>Min SDK:</strong> Android 7.0 (API 24)</div>
                  <div><strong>Target SDK:</strong> Android 14 (API 34)</div>
                  <div><strong>Authentication:</strong> Direct Staff ID & PIN (No JWT Required)</div>
                </div>
              </div>

              {/* Build Command Box */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between font-mono text-xs text-sky-300">
                <code>flutter build apk --release</code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText('flutter build apk --release --split-per-abi');
                    setCopiedCmd(true);
                    setTimeout(() => setCopiedCmd(false), 2000);
                  }}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-sans"
                >
                  {copiedCmd ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCmd ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <button
                onClick={handleDownloadFlutterApkManifest}
                className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition"
              >
                <ArrowDownToLine className="w-4 h-4 text-sky-400" />
                <span>Download Flutter APK Manifest JSON</span>
              </button>
            </div>
          )}

          {activeTab === 'MANUAL' && (
            <div className="space-y-3 text-slate-300">
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2.5">
                <h4 className="font-bold text-white text-xs">How to Install on Android Mobile:</h4>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300 leading-relaxed text-[11px]">
                  <li>Open this URL in <strong>Google Chrome</strong> or <strong>Samsung Internet</strong> on your Android phone.</li>
                  <li>Tap the <strong>three dots (⋮)</strong> menu in the browser.</li>
                  <li>Select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</li>
                  <li>Tap <strong>Install</strong>. Android will build and launch the standalone Tagoloan Water District APK!</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex justify-between items-center text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>LWUA Utility Cert #WDT-1002</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg text-xs transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
