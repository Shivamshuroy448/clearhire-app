const { useState, useEffect } = React;

// --- Configuration ---
// Automatically detect if we are local or in production
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : ''; // Relative path for production (e.g. /api/... if served from same origin)

// --- Firebase Configuration ---
// REPLACE WITH YOUR FIREBASE CONFIGURATION
const firebaseConfig = {
    apiKey: "AIzaSyCy5D2r_IreyYBBJFb8NXSxO4LfenaNwX8",
    authDomain: "clearhire-688b3.firebaseapp.com",
    projectId: "clearhire-688b3",
    storageBucket: "clearhire-688b3.firebasestorage.app",
    messagingSenderId: "510752628612",
    appId: "1:510752628612:web:02162f5c6ae8b5145147d1",
    measurementId: "G-MW0FJ95TQ0"
};

// Initialize Firebase safely
let auth;
try {
    if (firebase.apps.length === 0) {
        firebase.initializeApp(firebaseConfig);
    }
    auth = firebase.auth();
} catch (error) {
    console.error("Firebase Initialization Error. Make sure you updated the config.", error);
}

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

const DraftModal = ({ isOpen, onClose, draft }) => {
    const [copied, setCopied] = useState(false);

    if (!isOpen || !draft) return null;

    const handleCopy = () => {
        const fullText = `Subject: ${draft.subject}\n\n${draft.body}`;
        navigator.clipboard.writeText(fullText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div className="flex items-center space-x-2">
                        <div className="bg-purple-100 p-2 rounded-lg">
                            <i data-lucide="sparkles" className="w-5 h-5 text-purple-600"></i>
                        </div>
                        <h3 className="font-bold text-lg text-slate-800">AI Follow-Up Drafter</h3>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <i data-lucide="x" className="w-5 h-5"></i>
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Subject</label>
                        <div className="bg-slate-50 px-4 py-3 rounded-lg border border-slate-200 text-slate-800 font-medium">
                            {draft.subject}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Email Body</label>
                        <div className="bg-slate-50 px-4 py-3 rounded-lg border border-slate-200 text-slate-700 whitespace-pre-wrap h-64 overflow-y-auto font-sans leading-relaxed">
                            {draft.body}
                        </div>
                    </div>

                    <div className="pt-2 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium">Close</button>
                        <button
                            onClick={handleCopy}
                            className={`px-6 py-2 rounded-lg text-sm font-bold text-white flex items-center transition-all ${copied ? 'bg-green-500' : 'bg-brand-600 hover:bg-brand-700'}`}
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

const Header = ({ user, onLogout, onSync }) => {
    const [syncing, setSyncing] = useState(false);

    const handleSyncClick = async () => {
        setSyncing(true);
        await onSync();
        setSyncing(false);
    };

    return (
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold">C</div>
                    <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-600 to-brand-900">
                        ClearHire
                    </h1>
                </div>
                <nav className="flex items-center space-x-4">
                    {user ? (
                        <>
                            <button
                                onClick={handleSyncClick}
                                disabled={syncing}
                                className="hidden sm:flex items-center space-x-2 text-sm font-medium text-slate-600 hover:text-brand-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                <i data-lucide={syncing ? "loader-2" : "refresh-cw"} className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`}></i>
                                <span>{syncing ? 'Syncing...' : 'Sync Gmail'}</span>
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

        if (!auth) {
            setError("Firebase not initialized. Please verify configuration.");
            setLoading(false);
            return;
        }

        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            await auth.signInWithPopup(provider);
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

    useEffect(() => {
        // Auth Listener
        let unsubscribe;
        if (auth) {
            unsubscribe = auth.onAuthStateChanged((u) => {
                setUser(u);
                setAuthChecking(false);
            });
        } else {
            setAuthChecking(false); // Fallback if auth fails to init
        }
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
        }
    }, [user]);

    useEffect(() => {
        if (!loading) lucide.createIcons();
    }, [loading, data, isModalOpen, isDraftModalOpen]);

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
        try {
            const response = await fetch(`${API_BASE}/sync/gmail?user_id=${user.uid}`, { method: 'POST' });
            const result = await response.json();
            if (response.ok) {
                alert(`Sync Complete!\n\n${result.updates.join('\n')}`);
                fetchData();
            }
        } catch (error) {
            console.error("Sync failed", error);
            alert("Sync failed. Check console.");
        }
    };

    const handleDraftEmail = async (appId) => {
        try {
            const response = await fetch(`${API_BASE}/applications/${appId}/draft_email`, { method: 'POST' });
            if (response.ok) {
                const draft = await response.json();
                setDraftData(draft);
                setIsDraftModalOpen(true);
            }
        } catch (error) {
            console.error("Draft failed", error);
        }
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
            <Header user={user} onLogout={handleLogout} onSync={handleSync} />

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
            />
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
