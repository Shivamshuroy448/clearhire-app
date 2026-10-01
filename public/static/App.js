const { useState, useEffect } = React;

// --- Configuration ---
// Automatically detect if we are local or in production
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : ''; // Relative path for production (e.g. /api/... if served from same origin)

// --- Firebase Configuration ---
// Client-side Firebase credentials are dynamically fetched from the server /api/config
// to ensure zero sensitive API keys are ever committed to git or exposed to repository scanners.
let auth = null;
let authInitPromise = null;

const initFirebase = async () => {
    if (auth) return auth;
    if (authInitPromise) return authInitPromise;

    authInitPromise = (async () => {
        try {
            const res = await fetch(`${API_BASE}/api/config`);
            if (res.ok) {
                const config = await res.json();
                if (config && config.apiKey) {
                    if (firebase.apps.length === 0) {
                        firebase.initializeApp(config);
                    }
                    auth = firebase.auth();
                    return auth;
                }
            }
        } catch (err) {
            console.warn("Could not load remote Firebase configuration:", err);
        }
        return null;
    })();

    return authInitPromise;
};

// --- Components ---

const RiskBadge = ({ level, label }) => {
    const colors = {
        'Low': 'bg-emerald-100 text-emerald-800 border-emerald-200',
        'Medium': 'bg-yellow-100 text-yellow-800 border-yellow-200',
        'High': 'bg-orange-100 text-orange-800 border-orange-200',
        'Critical': 'bg-red-100 text-red-800 border-red-200',
    };

    const style = colors[level] || 'bg-gray-100 text-gray-800';

    return (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${style}`}>
            {label || level} Risk
        </span>
    );
};

const ApplicationCard = ({ app, risk, onDelete, onEdit, onDraftEmail }) => {
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = React.useRef(null);

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const stageColors = {
        'Applied': 'bg-blue-500',
        'Screening': 'bg-indigo-500',
        'Interview': 'bg-purple-500',
        'Offer': 'bg-green-500',
        'Rejected': 'bg-gray-400',
        'Ghosted': 'bg-red-400',
    };

    const handleDelete = () => {
        if (confirm("Are you sure you want to delete this application?")) {
            onDelete(app.id);
        }
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className={`absolute top-0 left-0 w-1 h-full ${stageColors[app.current_stage] || 'bg-slate-300'}`}></div>

            {/* Menu Button */}
            <div className="absolute top-4 right-4" ref={menuRef}>
                <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <i data-lucide="more-vertical" className="w-5 h-5"></i>
                </button>

                {showMenu && (
                    <div className="absolute right-0 mt-1 w-32 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-20">
                        <button
                            onClick={() => { setShowMenu(false); onEdit(app); }}
                            className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                        >
                            Edit
                        </button>
                        <button
                            onClick={() => { setShowMenu(false); onDraftEmail(); }}
                            className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                        >
                            Draft Follow-up
                        </button>
                        <button
                            onClick={handleDelete}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-slate-50"
                        >
                            Delete
                        </button>
                    </div>
                )}
            </div>

            <div className="flex justify-between items-start mb-4 pr-8">
                <div>
                    <h3 className="font-bold text-lg text-slate-800">{app.company_name}</h3>
                    <p className="text-slate-500 text-sm">{app.position}</p>
                </div>
            </div>
            <div className="mb-4">
                {risk && <RiskBadge level={risk.risk_level} />}
            </div>

            <div className="space-y-3 mb-4">
                <div className="flex items-center text-sm text-slate-600">
                    <i data-lucide="clock" className="w-4 h-4 mr-2"></i>
                    <span>Last Contact: {risk ? `${risk.days_since_contact} days ago` : 'Unknown'}</span>
                </div>
                <div className="flex items-center text-sm text-slate-600">
                    <i data-lucide="tag" className="w-4 h-4 mr-2"></i>
                    <span>Stage: {app.current_stage}</span>
                </div>
            </div>
            {risk && (
                <div className="bg-slate-50 rounded-lg p-3 text-sm border border-slate-100">
                    <p className="text-slate-700 font-medium mb-1">AI Recommendation:</p>
                    <p className="text-slate-600">{risk.recommendation}</p>
                </div>
            )}
            <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400">
                <span>Applied: {new Date(app.applied_date).toLocaleDateString()}</span>
                {risk && risk.ghosting_probability > 0.5 && (
                    <span className="text-red-500 font-bold flex items-center">
                        Ghost Probability: {(risk.ghosting_probability * 100).toFixed(0)}%
                    </span>
                )}
            </div>
        </div>
    );
};

const DraftModal = ({ isOpen, onClose, draft, currentStrategy, onSelectStrategy, loading }) => {
    const [copied, setCopied] = useState(false);

    if (!isOpen || (!draft && !loading)) return null;

    const handleCopy = () => {
        if (!draft) return;
        const fullText = `Subject: ${draft.subject}\n\n${draft.body}`;
        navigator.clipboard.writeText(fullText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const strategies = [
        { id: 'nudge', label: 'Friendly Nudge', desc: 'Timeline & Status Check' },
        { id: 'value_add', label: 'Value-Add Follow-Up', desc: 'Share Project & Insights' },
        { id: 'timeline_check', label: 'Timeline / Priority', desc: 'Active Process Update' }
    ];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div className="flex items-center space-x-3">
                        <div className="bg-purple-100 p-2 rounded-lg text-purple-700">
                            <i data-lucide="sparkles" className="w-5 h-5"></i>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-slate-800">Smart AI Follow-Up</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                                {draft && draft.role_category && (
                                    <span className="text-xs bg-purple-50 text-purple-700 font-semibold px-2 py-0.5 rounded border border-purple-200">
                                        Role: {draft.role_category}
                                    </span>
                                )}
                                {draft && draft.tone && (
                                    <span className="text-xs bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded">
                                        Tone: {draft.tone}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <i data-lucide="x" className="w-5 h-5"></i>
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {/* Strategy Selector */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Strategy Angle</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {strategies.map((strat) => (
                                <button
                                    key={strat.id}
                                    type="button"
                                    onClick={() => onSelectStrategy(strat.id)}
                                    className={`p-2.5 rounded-lg border text-left transition-all ${
                                        currentStrategy === strat.id
                                            ? 'border-purple-600 bg-purple-50/70 ring-1 ring-purple-600'
                                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                    }`}
                                >
                                    <div className="text-xs font-bold text-slate-800">{strat.label}</div>
                                    <div className="text-[11px] text-slate-500 mt-0.5">{strat.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {loading ? (
                        <div className="py-14 text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-600 border-t-transparent mx-auto mb-3"></div>
                            <p className="text-slate-500 text-sm">Generating tailored email draft...</p>
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Subject</label>
                                <div className="bg-slate-50 px-4 py-3 rounded-lg border border-slate-200 text-slate-800 font-medium text-sm">
                                    {draft ? draft.subject : ''}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Email Body</label>
                                <div className="bg-slate-50 px-4 py-3 rounded-lg border border-slate-200 text-slate-700 whitespace-pre-wrap h-56 overflow-y-auto font-sans leading-relaxed text-sm">
                                    {draft ? draft.body : ''}
                                </div>
                            </div>
                        </>
                    )}

                    <div className="pt-2 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium">Close</button>
                        <button
                            onClick={handleCopy}
                            disabled={loading || !draft}
                            className={`px-6 py-2 rounded-lg text-sm font-bold text-white flex items-center transition-all ${copied ? 'bg-green-500' : 'bg-brand-600 hover:bg-brand-700 disabled:opacity-50'}`}
                        >
                            {copied ? (
                                <>
                                    <i data-lucide="check" className="w-4 h-4 mr-2"></i> Copied!
                                </>
                            ) : (
                                <>
                                    <i data-lucide="copy" className="w-4 h-4 mr-2"></i> Copy to Clipboard
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const LinkedInSyncModal = ({ isOpen, onClose, user, onSimulateSync, onRefresh }) => {
    const [tab, setTab] = useState('extension');
    const [manualText, setManualText] = useState('');
    const [importing, setImporting] = useState(false);
    const [importMsg, setImportMsg] = useState('');

    if (!isOpen) return null;

    const handleManualImport = async () => {
        if (!manualText.trim()) return;
        setImporting(true);
        setImportMsg('');

        let parsedJobs = [];
        try {
            const json = JSON.parse(manualText);
            if (Array.isArray(json)) {
                parsedJobs = json;
            } else if (json.jobs && Array.isArray(json.jobs)) {
                parsedJobs = json.jobs;
            }
        } catch (_) {
            const lines = manualText.split('\n').filter(l => l.trim().length > 0);
            parsedJobs = lines.map(line => {
                const parts = line.split(/[,\t|]/).map(p => p.trim());
                return {
                    company_name: parts[0] || 'Unknown',
                    position: parts[1] || 'Software Engineer',
                    current_stage: parts[2] || 'Applied',
                    notes: 'Manual import to ClearHire'
                };
            });
        }

        if (parsedJobs.length === 0) {
            setImportMsg('Could not parse any jobs. Please provide JSON or line format.');
            setImporting(false);
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/sync/linkedin/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user ? user.uid : 'guest',
                    jobs: parsedJobs
                })
            });
            const data = await res.json();
            if (res.ok) {
                setImportMsg(data.message || 'Successfully imported jobs!');
                setTimeout(() => {
                    onRefresh();
                    onClose();
                }, 1200);
            } else {
                setImportMsg(data.detail || 'Import failed.');
            }
        } catch (err) {
            setImportMsg('Server error during import.');
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-100">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-slate-800">Sync LinkedIn Job Tracker</h3>
                            <p className="text-xs text-slate-500">Automatically pull applied roles directly into your dashboard</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
                        <i data-lucide="x" className="w-5 h-5"></i>
                    </button>
                </div>

                <div className="flex border-b border-slate-200 px-6 pt-2 bg-slate-50/50">
                    <button
                        onClick={() => setTab('extension')}
                        className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors ${
                            tab === 'extension'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Chrome Extension (Recommended)
                    </button>
                    <button
                        onClick={() => setTab('instant')}
                        className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors ${
                            tab === 'instant'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Instant Sample Sync
                    </button>
                    <button
                        onClick={() => setTab('manual')}
                        className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors ${
                            tab === 'manual'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Manual Import
                    </button>
                </div>

                <div className="p-6">
                    {tab === 'extension' && (
                        <div className="space-y-4">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 leading-relaxed">
                                <strong>Automatic Sync:</strong> The ClearHire Chrome Extension detects your tracked applications on LinkedIn and imports them with a single click.
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">1</div>
                                    <div className="text-xs text-slate-700">
                                        <div className="font-semibold text-slate-800 mb-1">Download Extension Package</div>
                                        <p className="mb-2">Download and extract the lightweight ClearHire extension file.</p>
                                        <a
                                            href="/clearhire-extension.zip"
                                            download="clearhire-extension.zip"
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold text-xs transition-colors"
                                        >
                                            <i data-lucide="download" className="w-3.5 h-3.5"></i>
                                            <span>Download clearhire-extension.zip</span>
                                        </a>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">2</div>
                                    <div className="text-xs text-slate-700">
                                        <div className="font-semibold text-slate-800 mb-1">Load into Chrome</div>
                                        <p>Open <code className="bg-slate-200 px-1 py-0.5 rounded text-[11px]">chrome://extensions</code>, turn on <strong>Developer mode</strong> (top right), click <strong>Load unpacked</strong>, and select the unzipped <code className="bg-slate-200 px-1 py-0.5 rounded text-[11px]">extension</code> folder.</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">3</div>
                                    <div className="text-xs text-slate-700">
                                        <div className="font-semibold text-slate-800 mb-1">Open LinkedIn &amp; Sync</div>
                                        <p className="mb-2">Go to your LinkedIn Job Tracker. A floating ClearHire badge appears on the bottom-right corner to sync applications!</p>
                                        <a
                                            href="https://www.linkedin.com/jobs/tracker/"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-md font-semibold text-xs transition-colors"
                                        >
                                            <span>Open LinkedIn Job Tracker &rarr;</span>
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {tab === 'instant' && (
                        <div className="space-y-4 py-2 text-center">
                            <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center mx-auto">
                                <i data-lucide="zap" className="w-6 h-6"></i>
                            </div>
                            <div>
                                <h4 className="font-bold text-base text-slate-800">Instant Demo Simulation</h4>
                                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                                    Want to quickly test how LinkedIn Job Tracker applications integrate with ClearHire before installing the Chrome Extension?
                                </p>
                            </div>
                            <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 text-xs text-slate-600 text-left max-w-sm mx-auto space-y-1">
                                <div className="font-semibold text-slate-800 mb-1">Will import sample tracked roles:</div>
                                <div>• <strong>Datadog</strong> - Software Engineer (Screening)</div>
                                <div>• <strong>Scale AI</strong> - Computer Vision Engineer (Interview)</div>
                                <div>• <strong>Notion</strong> - Product Engineer (Applied)</div>
                            </div>
                            <button
                                onClick={onSimulateSync}
                                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-sm transition-all"
                            >
                                Populate 3 Tracked Jobs Now
                            </button>
                        </div>
                    )}

                    {tab === 'manual' && (
                        <div className="space-y-3">
                            <label className="block text-xs font-semibold text-slate-600">
                                Paste JSON or line-by-line (Company, Role, Stage)
                            </label>
                            <textarea
                                value={manualText}
                                onChange={(e) => setManualText(e.target.value)}
                                placeholder="Airbnb, Frontend Engineer, Interview&#10;Stripe, ML Engineer, Screening&#10;Google, SWE, Applied"
                                rows={6}
                                className="w-full text-xs font-mono p-3 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            />
                            {importMsg && (
                                <div className="text-xs font-semibold text-blue-700 bg-blue-50 p-2 rounded">
                                    {importMsg}
                                </div>
                            )}
                            <button
                                onClick={handleManualImport}
                                disabled={importing || !manualText.trim()}
                                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs disabled:opacity-50 transition-colors"
                            >
                                {importing ? 'Importing...' : 'Import to ClearHire'}
                            </button>
                        </div>
                    )}
                </div>

                <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

const Header = ({ user, onLogout, onSync, onSyncLinkedIn }) => {
    const [syncing, setSyncing] = useState(false);
    const [syncingLinkedIn, setSyncingLinkedIn] = useState(false);

    const handleSyncClick = async () => {
        setSyncing(true);
        await onSync();
        setSyncing(false);
    };

    const handleSyncLinkedInClick = async () => {
        setSyncingLinkedIn(true);
        await onSyncLinkedIn();
        setSyncingLinkedIn(false);
    };

    return (
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold shadow-sm">C</div>
                    <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-600 to-brand-900">
                        ClearHire
                    </h1>
                </div>
                <nav className="flex items-center space-x-3">
                    {user ? (
                        <>
                            <button
                                onClick={handleSyncClick}
                                disabled={syncing || syncingLinkedIn}
                                className="hidden sm:flex items-center space-x-2 text-sm font-medium text-slate-600 hover:text-brand-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                                title="Scan Gmail inbox for application confirmations"
                            >
                                <i data-lucide={syncing ? "loader-2" : "mail"} className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`}></i>
                                <span>{syncing ? 'Syncing...' : 'Sync Gmail'}</span>
                            </button>
                            <button
                                onClick={handleSyncLinkedInClick}
                                disabled={syncing || syncingLinkedIn}
                                className="hidden sm:flex items-center space-x-2 text-sm font-medium text-blue-700 hover:text-blue-800 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors"
                                title="Sync jobs from LinkedIn Job Tracker"
                            >
                                <svg className={`w-4 h-4 flex-shrink-0 ${syncingLinkedIn ? 'animate-spin' : ''}`} fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
                                </svg>
                                <span>{syncingLinkedIn ? 'Syncing...' : 'Sync LinkedIn'}</span>
                            </button>
                            <span className="text-sm text-slate-500 hidden md:block border-l border-slate-200 pl-4">{user.displayName || user.email}</span>
                            <button onClick={onLogout} className="text-sm font-medium text-slate-600 hover:text-red-600">Logout</button>
                        </>
                    ) : (
                        <span className="text-xs text-slate-400">Not Logged In</span>
                    )}
                </nav>
            </div>
        </header>
    );
};

const StatCard = ({ title, value, subtext }) => (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-slate-500 text-sm font-medium uppercase tracking-wider">{title}</h3>
        <div className="mt-2 flex items-baseline">
            <span className="text-3xl font-bold text-slate-900">{value}</span>
        </div>
        <p className="mt-1 text-sm text-slate-400">{subtext}</p>
    </div>
);

const ApplicationModal = ({ isOpen, onClose, onSave, initialData }) => {
    const [companyName, setCompanyName] = useState("");
    const [position, setPosition] = useState("");
    const [stage, setStage] = useState("Applied");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setCompanyName(initialData.company_name);
                setPosition(initialData.position);
                setStage(initialData.current_stage);
            } else {
                setCompanyName("");
                setPosition("");
                setStage("Applied");
            }
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        await onSave({
            id: initialData ? initialData.id : null,
            company_name: companyName,
            position,
            current_stage: stage
        });
        setLoading(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-slate-800">{initialData ? 'Edit Application' : 'Add New Application'}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <i data-lucide="x" className="w-5 h-5"></i>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
                        <input
                            required
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                            placeholder="e.g. Google"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Position</label>
                        <input
                            required
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                            placeholder="e.g. Software Engineer"
                            value={position}
                            onChange={(e) => setPosition(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Current Stage</label>
                        <select
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white"
                            value={stage}
                            onChange={(e) => setStage(e.target.value)}
                        >
                            <option value="Applied">Applied</option>
                            <option value="Screening">Screening</option>
                            <option value="Interview">Interview</option>
                            <option value="Offer">Offer</option>
                            <option value="Rejected">Rejected</option>
                            <option value="Ghosted">Ghosted</option>
                        </select>
                    </div>

                    <div className="pt-2 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium">Cancel</button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium flex items-center"
                        >
                            {loading && <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>}
                            {initialData ? 'Save Changes' : 'Add Application'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const AuthPage = ({ onDemoLogin }) => {
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleGoogleLogin = async () => {
        setError("");
        setLoading(true);

        const firebaseAuth = auth || (await initFirebase());
        if (!firebaseAuth) {
            setError("Firebase is not initialized. Please verify the FIREBASE_API_KEY environment variable.");
            setLoading(false);
            return;
        }

        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            await firebaseAuth.signInWithPopup(provider);
        } catch (err) {
            console.error("Google sign-in error:", err);
            if (err.code === "auth/unauthorized-domain") {
                setError(`Domain (${window.location.hostname}) is not authorized in Firebase. Add it to Firebase Console > Authentication > Settings > Authorized domains.`);
            } else if (err.code === "auth/popup-closed-by-user") {
                setError("Sign-in popup was closed before completion. Please try again.");
            } else if (err.code === "auth/cancelled-popup-request") {
                // Ignore multiple popup triggers
            } else {
                setError(err.message || "Failed to sign in with Google.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 p-8">
                <div className="text-center mb-8">
                    <div className="w-12 h-12 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-xl mx-auto mb-4 shadow-sm">C</div>
                    <h2 className="text-2xl font-bold text-slate-900">Welcome to ClearHire</h2>
                    <p className="text-slate-500 mt-2 text-sm">Automated candidate transparency and recruitment insights.</p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 text-sm p-3.5 rounded-lg mb-6 border border-red-200 flex items-start gap-2 leading-relaxed">
                        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{error}</span>
                    </div>
                )}

                <div className="space-y-4">
                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full bg-white hover:bg-slate-50 text-slate-700 font-semibold py-3 px-4 border border-slate-300 rounded-lg shadow-sm transition-all flex items-center justify-center gap-3 text-sm hover:border-slate-400 active:bg-slate-100 disabled:opacity-60 cursor-pointer"
                    >
                        {loading ? (
                            <span className="animate-spin rounded-full h-5 w-5 border-2 border-brand-600 border-t-transparent"></span>
                        ) : (
                            <>
                                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                                </svg>
                                <span>Continue with Google</span>
                            </>
                        )}
                    </button>

                    <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-200"></div>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white px-3 text-slate-400 font-semibold tracking-wider">Or</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onDemoLogin}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2 text-sm shadow-sm cursor-pointer"
                    >
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span>Explore Live Interactive Demo</span>
                    </button>
                </div>

                <div className="mt-8 text-center text-xs text-slate-400">
                    Instant access with Google authentication or demo mode.
                </div>
            </div>
        </div>
    );
};

// --- Main App ---

const App = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [authChecking, setAuthChecking] = useState(true);

    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingApp, setEditingApp] = useState(null);
    const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
    const [draftData, setDraftData] = useState(null);
    const [selectedDraftAppId, setSelectedDraftAppId] = useState(null);
    const [currentStrategy, setCurrentStrategy] = useState("nudge");
    const [draftLoading, setDraftLoading] = useState(false);

    // Sync States
    const [gmailToken, setGmailToken] = useState(null);
    const [isLinkedInModalOpen, setIsLinkedInModalOpen] = useState(false);

    useEffect(() => {
        // Auth Listener with async Firebase initialization
        let unsubscribe;
        initFirebase().then((firebaseAuth) => {
            if (firebaseAuth) {
                unsubscribe = firebaseAuth.onAuthStateChanged((u) => {
                    setUser(u);
                    setAuthChecking(false);
                });
            } else {
                setAuthChecking(false);
            }
        });
        return () => unsubscribe && unsubscribe();
    }, []);

    const fetchData = () => {
        if (!user) return;
        fetch(`${API_BASE}/dashboard?user_id=${user.uid}`)
            .then(res => res.json())
            .then(data => {
                setData(data);
                setLoading(false);
                setTimeout(() => lucide.createIcons(), 100);
            })
            .catch(err => {
                console.error("Failed to fetch data:", err);
                setLoading(false);
            });
    };

    useEffect(() => {
        if (user) {
            fetchData();
            window.postMessage({
                type: "CLEARHIRE_SET_USER",
                userId: user.uid,
                apiBase: window.location.origin
            }, "*");
        }
    }, [user]);

    useEffect(() => {
        if (!loading) lucide.createIcons();
    }, [loading, data, isModalOpen, isDraftModalOpen, isLinkedInModalOpen]);

    const handleLogout = () => {
        if (auth) {
            try {
                auth.signOut();
            } catch (_) {}
        }
        setUser(null);
        setData(null);
        setLoading(true);
    };

    const handleSync = async () => {
        if (!user) return;

        // Demo Mode
        if (user.uid === 'demo-user') {
            try {
                const response = await fetch(`${API_BASE}/sync/gmail?user_id=demo-user`, { method: 'POST' });
                const result = await response.json();
                if (response.ok) {
                    alert(`Demo Gmail Sync:\n\n${(result.updates || []).join('\n')}`);
                    fetchData();
                }
            } catch (err) {
                console.error("Demo sync failed:", err);
            }
            return;
        }

        // Live Google User
        try {
            let token = gmailToken;
            if (!token) {
                const provider = new firebase.auth.GoogleAuthProvider();
                provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
                provider.setCustomParameters({ prompt: 'select_account' });

                const cred = await firebase.auth().signInWithPopup(provider);
                if (cred && cred.credential && cred.credential.accessToken) {
                    token = cred.credential.accessToken;
                    setGmailToken(token);
                } else {
                    throw new Error("Unable to obtain Google access token. Please ensure popup is allowed.");
                }
            }

            const response = await fetch(`${API_BASE}/sync/gmail?user_id=${encodeURIComponent(user.uid)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ access_token: token })
            });

            const data = await response.json();
            if (response.status === 401) {
                setGmailToken(null);
                alert("Google session expired. Please click 'Sync Gmail' again to authorize.");
                return;
            }

            if (response.ok && data.status === 'success') {
                const updatesList = (data.updates && data.updates.length > 0)
                    ? data.updates.map(u => `• ${u}`).join('\n')
                    : 'All tracked applications are up-to-date.';
                alert(`Gmail Sync Complete!\n\n${data.message || ''}\n\n${updatesList}`);
                fetchData();
            } else {
                alert(`Gmail Sync Note:\n\n${data.message || (data.updates ? data.updates.join('\n') : 'Unable to complete scan.')}`);
            }
        } catch (error) {
            console.error("Gmail sync failed:", error);
            if (error.code === 'auth/popup-closed-by-user') {
                alert("Gmail sync was cancelled: the Google authorization window was closed.");
            } else if (error.code === 'auth/popup-blocked') {
                alert("Popup blocked by browser: Please allow popups for ClearHire to connect Gmail.");
            } else {
                alert(`Gmail sync failed: ${error.message || error}`);
            }
        }
    };

    const handleSyncLinkedIn = () => {
        setIsLinkedInModalOpen(true);
    };

    const handleSimulateLinkedIn = async () => {
        try {
            const response = await fetch(`${API_BASE}/sync/linkedin?user_id=${user.uid}`, { method: 'POST' });
            const result = await response.json();
            if (response.ok) {
                alert(`LinkedIn Sync:\n\n${result.message}`);
                fetchData();
                setIsLinkedInModalOpen(false);
            } else {
                alert("LinkedIn sync failed. Check console.");
            }
        } catch (error) {
            console.error("LinkedIn sync failed", error);
            alert("LinkedIn sync failed. Check console.");
        }
    };

    const handleDraftEmail = async (appId, strategy = "nudge") => {
        setSelectedDraftAppId(appId);
        setCurrentStrategy(strategy);
        setDraftLoading(true);
        setIsDraftModalOpen(true);
        try {
            const response = await fetch(`${API_BASE}/applications/${appId}/draft_email?strategy=${strategy}`, { method: 'POST' });
            if (response.ok) {
                const draft = await response.json();
                setDraftData(draft);
                setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 50);
            }
        } catch (error) {
            console.error("Draft failed", error);
        } finally {
            setDraftLoading(false);
        }
    };

    const handleSelectStrategy = async (strategy) => {
        if (!selectedDraftAppId) return;
        await handleDraftEmail(selectedDraftAppId, strategy);
    };

    const handleSaveApplication = async (appData) => {
        try {
            const url = appData.id
                ? `${API_BASE}/applications/${appData.id}`
                : `${API_BASE}/applications`;

            const method = appData.id ? 'PUT' : 'POST';

            // Remove id from body for PUT if backend ignores it, but mostly harmless here if model allows
            // but our Pydantic Update model doesn't expect 'id'.
            // Clean up payload for update
            const payload = { ...appData, user_id: user.uid };
            if (method === 'PUT') delete payload.id;

            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (response.ok) {
                fetchData(); // Refresh list
            }
        } catch (error) {
            console.error("Failed to save application", error);
        }
    };

    const handleDeleteApplication = async (appId) => {
        try {
            const response = await fetch(`${API_BASE}/applications/${appId}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                fetchData(); // Refresh list
            }
        } catch (error) {
            console.error("Failed to delete application", error);
        }
    };

    const handleDemoLogin = () => {
        setUser({ uid: 'demo-user', email: 'guest@clearhire.ai', displayName: 'Guest Recruiter' });
    };

    if (authChecking) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
            </div>
        );
    }

    if (!user) {
        return <AuthPage onDemoLogin={handleDemoLogin} />;
    }

    if (!data) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 flex-col">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600 mb-4"></div>
                <p className="text-slate-500">Loading your ClearHire Dashboard...</p>
            </div>
        );
    }

    const { applications, risk_assessments } = data;

    // Quick Stats
    const totalApps = applications.length;
    const activeApps = applications.filter(a => !['Rejected', 'Ghosted'].includes(a.current_stage)).length;
    const criticalRisks = risk_assessments.filter(r => r.risk_level === 'Critical' || r.risk_level === 'High').length;

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            <Header user={user} onLogout={handleLogout} onSync={handleSync} onSyncLinkedIn={handleSyncLinkedIn} />

            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <StatCard title="Active Applications" value={activeApps} subtext={`${totalApps} total tracked`} />
                    <StatCard title="Action Required" value={criticalRisks} subtext="High delay risks detected" />
                    <StatCard title="Avg Response Time" value="4 Days" subtext="Across all companies" />
                </div>

                {/* Dashboard Grid */}
                <div>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-800">Your Timeline</h2>
                        <button
                            onClick={() => { setEditingApp(null); setIsModalOpen(true); }}
                            className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                            + Add Application
                        </button>
                    </div>

                    {applications.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center shadow-sm max-w-2xl mx-auto my-6">
                            <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-brand-100 shadow-sm">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">No Applications Tracked Yet</h3>
                            <p className="text-slate-500 text-sm mb-8 max-w-md mx-auto leading-relaxed">
                                Your personal recruitment tracker is ready. Sync your applications from LinkedIn or Gmail to monitor response deadlines and generate role-tailored follow-ups.
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
                                <button
                                    type="button"
                                    onClick={handleSyncLinkedIn}
                                    className="p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all flex flex-col justify-between group cursor-pointer"
                                >
                                    <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-3">
                                        <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-slate-800 text-sm group-hover:text-blue-700">Sync LinkedIn</h4>
                                        <p className="text-xs text-slate-500 mt-1">Import from Job Tracker</p>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={handleSync}
                                    className="p-4 rounded-xl border border-slate-200 hover:border-brand-400 hover:bg-brand-50/50 transition-all flex flex-col justify-between group cursor-pointer"
                                >
                                    <div className="w-9 h-9 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center mb-3">
                                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-slate-800 text-sm group-hover:text-brand-700">Sync Gmail</h4>
                                        <p className="text-xs text-slate-500 mt-1">Scan inbox confirmations</p>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => { setEditingApp(null); setIsModalOpen(true); }}
                                    className="p-4 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 transition-all flex flex-col justify-between group cursor-pointer"
                                >
                                    <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-slate-800 text-sm group-hover:text-emerald-700">Add Manually</h4>
                                        <p className="text-xs text-slate-500 mt-1">Track any custom role</p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {applications.map((app) => {
                                const risk = risk_assessments.find(r => r.application_id === app.id);
                                return (
                                    <ApplicationCard
                                        key={app.id}
                                        app={app}
                                        risk={risk}
                                        onDelete={handleDeleteApplication}
                                        onEdit={(appToEdit) => {
                                            setEditingApp(appToEdit);
                                            setIsModalOpen(true);
                                        }}
                                        onDraftEmail={() => handleDraftEmail(app.id)}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>

            <ApplicationModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveApplication}
                initialData={editingApp}
            />

            <DraftModal
                isOpen={isDraftModalOpen}
                onClose={() => setIsDraftModalOpen(false)}
                draft={draftData}
                currentStrategy={currentStrategy}
                onSelectStrategy={handleSelectStrategy}
                loading={draftLoading}
            />

            <LinkedInSyncModal
                isOpen={isLinkedInModalOpen}
                onClose={() => setIsLinkedInModalOpen(false)}
                user={user}
                onSimulateSync={handleSimulateLinkedIn}
                onRefresh={fetchData}
            />
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
