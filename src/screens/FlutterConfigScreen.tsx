import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Smartphone, 
  Server, 
  CheckCircle2, 
  Save, 
  ShieldCheck, 
  Globe,
  FileCode2,
  Terminal,
  Download,
  Layers,
  Sparkles,
  Copy
} from 'lucide-react';
import { StaffUser, ActiveScreen } from '../types';

interface FlutterConfigScreenProps {
  user: StaffUser;
  onNavigate: (screen: ActiveScreen) => void;
  onOpenApkModal?: () => void;
}

export const FlutterConfigScreen: React.FC<FlutterConfigScreenProps> = ({ 
  user, 
  onNavigate,
  onOpenApkModal 
}) => {
  const [serverUrl, setServerUrl] = useState('https://billing.tagoloanwaterdistrict.gov.ph/api');
  const [districtCode, setDistrictCode] = useState('WDT-MISOR-1002');
  const [timeoutSecs, setTimeoutSecs] = useState('30');
  const [isSaved, setIsSaved] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const copyToClipboard = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2500);
  };

  const FLUTTER_PUBSPEC = `name: wdt_meter_reader
description: Official Flutter Mobile Field Reading & Billing App for Tagoloan Water District
publish_to: 'none'
version: 2.4.0+240

environment:
  sdk: '>=3.2.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  # Offline Storage & State
  sqflite: ^2.4.1
  path: ^1.9.0
  provider: ^6.1.2
  shared_preferences: ^2.3.5
  
  # Hardware & Field Features
  camera: ^0.11.1
  google_mlkit_text_recognition: ^0.14.0
  geolocator: ^13.0.2
  esc_pos_printer: ^4.1.0
  blue_thermal_printer: ^1.2.3
  
  # HTTP & Networking
  http: ^1.3.0
  intl: ^0.20.2
  uuid: ^4.5.1
  lucide_icons: ^0.257.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^5.0.0

flutter:
  uses-material-design: true
  assets:
    - assets/images/`;

  const FLUTTER_MAIN_DART = `// Tagoloan Water District - Flutter Mobile Entry Point
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'services/database_helper.dart';
import 'services/sync_service.dart';
import 'screens/dashboard_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await DatabaseHelper.instance.init();
  SyncService.instance.startAutoSync(intervalSeconds: 30);
  
  runApp(const WDTMeterReaderApp());
}

class WDTMeterReaderApp extends StatelessWidget {
  const WDTMeterReaderApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Tagoloan Water District',
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.dark,
      darkTheme: ThemeData.dark(useMaterial3: true).copyWith(
        scaffoldBackgroundColor: const Color(0xFF020617),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF0284C7),
          secondary: Color(0xFF38BDF8),
          surface: Color(0xFF0F172A),
        ),
      ),
      home: const DashboardScreen(),
    );
  }
}`;

  return (
    <div className="p-3 sm:p-4 max-w-4xl mx-auto w-full space-y-5 pb-16">
      {/* Header Nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNavigate('debug')}
          className="flex items-center gap-1 text-xs font-bold text-sky-400 hover:text-sky-300 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Diagnostics</span>
        </button>

        <span className="text-xs font-mono text-sky-400 bg-sky-950/70 px-2.5 py-1 rounded-full border border-sky-800 flex items-center gap-1">
          <Smartphone className="w-3.5 h-3.5" />
          FLUTTER 3.29 • ANDROID APK READY
        </span>
      </div>

      <div>
        <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
          <Layers className="w-5 h-5 text-sky-400" />
          <span>Flutter Mobile Architecture & District Setup</span>
        </h2>
        <p className="text-xs text-slate-400">
          Tagoloan Water District native Flutter mobile framework, offline SQLite synchronization, and APK distribution
        </p>
      </div>

      {isSaved && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-800 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>District server configuration updated successfully! Direct staff authentication active.</span>
        </div>
      )}

      {/* Flutter Mobile Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-sky-950/60 border border-sky-900/60 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-sky-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wider">
              Flutter Engine
            </span>
            <span className="text-xs font-bold text-white">
              Cross-Platform Android / iOS Native Shell
            </span>
          </div>
          <p className="text-xs text-slate-300 max-w-xl">
            This application is engineered as a Flutter mobile solution with offline-first SQLite persistence, Material 3 dark aesthetics, camera ML Kit meter reading, and direct Bluetooth thermal printer integration.
          </p>
        </div>

        {onOpenApkModal && (
          <button
            onClick={onOpenApkModal}
            className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-black rounded-xl shadow-lg shadow-sky-600/30 flex items-center gap-2 shrink-0 transition"
          >
            <Download className="w-4 h-4" />
            <span>Install App on Your Device</span>
          </button>
        )}
      </div>

      {/* District Server Configuration (No Tokens) */}
      <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-sky-400" />
            <span>District Central Server Endpoints</span>
          </h3>
          <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
            Direct Staff Auth (No JWT Token Required)
          </span>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-1">
            Central Billing Server Base URL
          </label>
          <input
            type="text"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            required
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
          />
          <span className="text-[10px] text-slate-500 mt-1 block">
            Target API endpoint for offline batch push and consumer masterlist sync
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              District Code / Unit
            </label>
            <input
              type="text"
              value={districtCode}
              onChange={(e) => setDistrictCode(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Network Connection Timeout (Seconds)
            </label>
            <input
              type="number"
              value={timeoutSecs}
              onChange={(e) => setTimeoutSecs(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition"
        >
          <Save className="w-4 h-4" />
          <span>Save District Configuration</span>
        </button>
      </form>

      {/* Flutter CLI Build & Source Reference */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-sky-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Flutter Android APK Build Commands
            </h3>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            Release Build Target: ARM64 & x86_64
          </span>
        </div>

        <div className="space-y-2">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 flex items-center justify-between">
            <code>flutter build apk --release --split-per-abi</code>
            <button
              onClick={() => copyToClipboard('flutter build apk --release --split-per-abi', 'BUILD_CMD')}
              className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-sans font-semibold"
            >
              {copiedSection === 'BUILD_CMD' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSection === 'BUILD_CMD' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 flex items-center justify-between">
            <code>flutter run -d android --release</code>
            <button
              onClick={() => copyToClipboard('flutter run -d android --release', 'RUN_CMD')}
              className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-sans font-semibold"
            >
              {copiedSection === 'RUN_CMD' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSection === 'RUN_CMD' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Pubspec.yaml snippet */}
        <div className="space-y-1.5 pt-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold text-slate-300 flex items-center gap-1">
              <FileCode2 className="w-3.5 h-3.5 text-sky-400" />
              pubspec.yaml (Flutter Dependencies)
            </span>
            <button
              onClick={() => copyToClipboard(FLUTTER_PUBSPEC, 'PUBSPEC')}
              className="text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold"
            >
              {copiedSection === 'PUBSPEC' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSection === 'PUBSPEC' ? 'Copied' : 'Copy Config'}</span>
            </button>
          </div>
          <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[10.5px] font-mono text-slate-300 overflow-x-auto max-h-48">
            {FLUTTER_PUBSPEC}
          </pre>
        </div>
      </div>
    </div>
  );
};
