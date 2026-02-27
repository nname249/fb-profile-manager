import React, { useState, useEffect } from "react";
import {
    Plus,
    Users,
    Settings,
    Search,
    X,
    FolderOpen,
    Trash2,
    ExternalLink,
    Cookie,
    FileDown,
    Facebook,
    Copy,
    RefreshCw,
    Fingerprint,
    Pencil,
    Eye,
    EyeOff,
    Lock,
} from "lucide-react";

const App = () => {
    const [activeTab, setActiveTab] = useState("accounts");
    const [accounts, setAccounts] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [newAcc, setNewAcc] = useState({ uid: "", password: "", two_fa: "", note: "" });
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [bulkText, setBulkText] = useState("");
    const [cookieModal, setCookieModal] = useState({ open: false, content: "" });
    const [statusMap, setStatusMap] = useState({});
    const [checkingStatus, setCheckingStatus] = useState({});
    const [copied, setCopied] = useState(false);
    const [profilePath, setProfilePath] = useState("");
    const [toast, setToast] = useState(null);
    const [isAutoChecking, setIsAutoChecking] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [pinVerifyModal, setPinVerifyModal] = useState({ open: false, pin: "" });

    const HARDCODED_PIN = "240906";

    useEffect(() => {
        const init = async () => {
            await loadSettings();
            const data = await loadAccounts();
            if (data && data.length > 0) {
                startAutoCheck(data);
            }
        };
        init();
    }, []);

    const startAutoCheck = async (accList) => {
        if (isAutoChecking) return;
        setIsAutoChecking(true);
        for (const acc of accList) {
            await handleCheckStatus(acc.id);
            // Wait 1 second between checks
            await new Promise(r => setTimeout(r, 1000));
        }
        setIsAutoChecking(false);
    };

    const loadAccounts = async () => {
        const data = await window.electron.ipcRenderer.invoke("accounts:get");
        setAccounts(data);
        return data;
    };

    const loadSettings = async () => {
        const path = await window.electron.ipcRenderer.invoke("settings:get-path");
        setProfilePath(path);
    };

    const handleBrowsePath = async () => {
        const newPath = await window.electron.ipcRenderer.invoke("settings:set-path");
        if (newPath) setProfilePath(newPath);
    };

    const showToast = (message, type = "success") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleAddAccount = async () => {
        if (!newAcc.uid) return showToast("Vui lòng nhập UID", "error");
        const res = await window.electron.ipcRenderer.invoke("accounts:add", newAcc);
        if (res.success) {
            showToast("Đã thêm tài khoản");
            setIsAddModalOpen(false);
            setNewAcc({ uid: "", password: "", two_fa: "", note: "" });
            loadAccounts();
        }
    };

    const handleBulkImport = async () => {
        const lines = bulkText.split("\n").filter(l => l.trim());
        const toAdd = lines.map(line => {
            const [uid, password, two_fa, note] = line.split("|");
            return { uid, password, two_fa, note };
        });
        const res = await window.electron.ipcRenderer.invoke("accounts:add-bulk", toAdd);
        if (res.success) {
            showToast(`Đã nhập ${toAdd.length} tài khoản`);
            setIsBulkModalOpen(false);
            setBulkText("");
            loadAccounts();
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Xóa tài khoản này và dữ liệu trình duyệt?")) return;
        const res = await window.electron.ipcRenderer.invoke("accounts:delete", id);
        if (res.success) {
            showToast("Đã xóa tài khoản");
            loadAccounts();
        }
    };

    const handleLaunch = async (id) => {
        showToast("Đang mở trình duyệt...");
        const res = await window.electron.ipcRenderer.invoke("accounts:launch", id);
        if (!res.success) showToast(res.error, "error");
    };

    const handleGetCookies = async (id) => {
        showToast("Đang lấy cookies...");
        const res = await window.electron.ipcRenderer.invoke("accounts:get-cookies", id);
        if (res.success) {
            setCookieModal({ open: true, content: res.cookies });
        } else {
            showToast("Lỗi: " + res.error, "error");
        }
    };

    const handleCheckStatus = async (id) => {
        setCheckingStatus(prev => ({ ...prev, [id]: true }));
        setStatusMap(prev => ({ ...prev, [id]: "Checking..." }));
        const res = await window.electron.ipcRenderer.invoke("accounts:check-status", id);
        if (res.success) {
            setStatusMap(prev => ({ ...prev, [id]: res.status }));
        } else {
            setStatusMap(prev => ({ ...prev, [id]: "Error" }));
        }
        setCheckingStatus(prev => ({ ...prev, [id]: false }));
    };

    const handleEdit = (acc) => {
        setEditingAccount({ ...acc });
        setShowPassword(false);
        setIsEditModalOpen(true);
    };

    const handleTogglePassword = () => {
        if (!showPassword) {
            setPinVerifyModal({ open: true, pin: "" });
        } else {
            setShowPassword(false);
        }
    };

    const handleVerifyPin = () => {
        if (pinVerifyModal.pin === HARDCODED_PIN) {
            setShowPassword(true);
            setPinVerifyModal({ open: false, pin: "" });
        } else {
            showToast("Mã PIN không chính xác", "error");
        }
    };

    const handleUpdateAccount = async () => {
        if (!editingAccount.uid) return showToast("Vui lòng nhập UID", "error");
        const res = await window.electron.ipcRenderer.invoke("accounts:update", editingAccount);
        if (res.success) {
            showToast("Đã cập nhật tài khoản");
            setIsEditModalOpen(false);
            loadAccounts();
        } else {
            showToast("Lỗi: " + res.error, "error");
        }
    };

    const handleGetInternalUID = async (id) => {
        showToast("Đang lấy UID...");
        const res = await window.electron.ipcRenderer.invoke("accounts:get-internal-uid", id);
        if (res.success) {
            showToast("Hệ thống: " + res.internalUid);
            setCookieModal({ open: true, content: res.internalUid });
        } else {
            showToast("Lỗi: " + res.error, "error");
        }
    };

    const copyText = (text) => {
        navigator.clipboard.writeText(text);
        showToast("Đã copy!");
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(cookieModal.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const filteredAccounts = accounts.filter(acc =>
        acc.uid.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (acc.note || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col h-screen text-gray-200">
            {/* Header */}
            <header className="h-14 bg-[#14171d] border-b border-white/10 flex items-center px-4 gap-4 shadow-xl z-50 rounded-none">
                <div className="flex items-center gap-2.5 font-extrabold text-[#0084ff] text-lg tracking-tighter cursor-pointer" onClick={() => setActiveTab("accounts")}>
                    <Facebook size={24} fill="currentColor" />
                    <span>FB PRO</span>
                </div>

                <nav className="flex gap-1 flex-1">
                    <button
                        className={`px-4 py-2 text-sm font-semibold rounded-none transition-all ${activeTab === "accounts" ? "bg-white/5 text-[#0084ff]" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
                        onClick={() => setActiveTab("accounts")}
                    >
                        Tài khoản
                    </button>
                    <button
                        className={`px-4 py-2 text-sm font-semibold rounded-none transition-all ${activeTab === "settings" ? "bg-white/5 text-[#0084ff]" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
                        onClick={() => setActiveTab("settings")}
                    >
                        Cấu hình
                    </button>
                </nav>

                <div className="flex gap-2.5">
                    <button className="p-2.5 bg-fb-blue text-white rounded-none shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all" onClick={() => setIsAddModalOpen(true)}>
                        <Plus size={18} />
                    </button>
                    <button className="p-2.5 bg-white/5 border border-white/10 text-white rounded-none hover:bg-white/10 transition-all" onClick={() => setIsBulkModalOpen(true)}>
                        <FileDown size={18} />
                    </button>
                </div>
            </header>

            <main className="flex-1 p-4 flex flex-col overflow-hidden">
                {/* Search Bar - only on accounts tab */}
                {activeTab === "accounts" && (
                    <div className="relative mb-3">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            type="text"
                            className="w-full bg-[#1a1d23]/70 border border-white/10 h-9 pl-9 pr-3 rounded-none text-xs outline-none focus:border-fb-blue/50 transition-all font-medium"
                            placeholder="Tìm kiếm..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                )}

                <div className="flex-1 overflow-y-auto pr-1">
                    {activeTab === "accounts" ? (
                        <div className="grid gap-2">
                            {filteredAccounts.map(acc => (
                                <div className="bg-[#1a1d23]/70 backdrop-blur-md border border-white/10 rounded-none px-4 py-2 flex items-center justify-between hover:bg-[#1e222a]/80 transition-all group" key={acc.id}>
                                    <div className="flex items-center gap-3 flex-1">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-[13px] tracking-tight">{acc.uid}</span>
                                                <button
                                                    className="p-1 hover:bg-white/10 rounded-none text-gray-400 hover:text-fb-blue transition-all"
                                                    onClick={() => copyText(acc.uid)}
                                                    title="Copy UID"
                                                >
                                                    <Copy size={11} />
                                                </button>
                                                <div
                                                    className={`w-2.5 h-2.5 rounded-none shadow-lg ${statusMap[acc.id] === "Live" ? "bg-green-500 shadow-green-500/40" :
                                                        statusMap[acc.id]?.includes("Checkpoint") ? "bg-orange-500 shadow-orange-500/40" :
                                                            statusMap[acc.id] === "Checking..." ? "bg-blue-500 animate-pulse" :
                                                                statusMap[acc.id] === "Die/Logout" ? "bg-red-500 shadow-red-500/40" :
                                                                    "bg-gray-500"
                                                        }`}
                                                    title={statusMap[acc.id] || "Chưa check"}
                                                ></div>
                                            </div>
                                            {/* Note horizontally aligned logic - wait, user says "ngang với acc". Assuming horizontal layout. */}
                                        </div>
                                        <div className="h-4 w-px bg-white/5 hidden md:block"></div>
                                        <span className="text-xs text-gray-500 truncate max-w-[200px]" title={acc.note}>
                                            {acc.note || "No note"}
                                        </span>
                                    </div>

                                    <div className="flex gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                        <button
                                            className="w-8 h-8 flex items-center justify-center rounded-none hover:bg-white/5 text-gray-400 hover:text-white transition-all"
                                            onClick={() => handleCheckStatus(acc.id)}
                                            title="Check Status"
                                        >
                                            <RefreshCw size={14} className={checkingStatus[acc.id] ? "animate-spin" : ""} />
                                        </button>
                                        <button className="w-8 h-8 flex items-center justify-center rounded-none hover:bg-fb-blue text-gray-400 hover:text-white transition-all" onClick={() => handleLaunch(acc.id)} title="Mở Browser">
                                            <ExternalLink size={14} />
                                        </button>
                                        <button className="w-8 h-8 flex items-center justify-center rounded-none hover:bg-white/5 text-gray-400 hover:text-white transition-all" onClick={() => handleEdit(acc)} title="Chỉnh sửa">
                                            <Pencil size={14} />
                                        </button>
                                        <button className="w-8 h-8 flex items-center justify-center rounded-none hover:bg-white/5 text-gray-400 hover:text-white transition-all" onClick={() => handleGetInternalUID(acc.id)} title="Lấy UID">
                                            <Fingerprint size={14} />
                                        </button>
                                        <button className="w-8 h-8 flex items-center justify-center rounded-none hover:bg-white/5 text-gray-400 hover:text-white transition-all" onClick={() => handleGetCookies(acc.id)} title="Lấy Cookies">
                                            <Cookie size={14} />
                                        </button>
                                        <button className="w-8 h-8 flex items-center justify-center rounded-none hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-all" onClick={() => handleDelete(acc.id)} title="Xóa">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {filteredAccounts.length === 0 && (
                                <div className="py-20 text-center text-gray-500 text-sm">Không có dữ liệu</div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-[#14171d] border border-white/10 rounded-none p-6">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4">Lưu trữ dữ liệu</h4>
                                <div className="bg-black/20 p-4 rounded-none border border-white/5 flex items-center gap-4">
                                    <FolderOpen size={16} className="text-gray-500" />
                                    <div className="flex-1 font-mono text-[10px] text-gray-400 truncate">{profilePath}</div>
                                    <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-none text-xs font-bold transition-all" onClick={handleBrowsePath}>Đổi</button>
                                </div>
                            </div>
                            <div className="text-center py-10 opacity-20">
                                <Facebook size={40} className="mx-auto mb-2" />
                                <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400">v1.2.0 Premium Edition</div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Simple Toast */}
            {toast && (
                <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-2.5 rounded-none text-xs font-bold shadow-2xl z-[2000] border border-white/10 backdrop-blur-xl ${toast.type === 'error' ? 'text-red-400 bg-red-500/10' : 'text-green-400 bg-green-500/10'}`}>
                    {toast.message}
                </div>
            )}

            {/* Modals */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1000] p-4" onClick={() => setIsAddModalOpen(false)}>
                    <div className="bg-[#14171d] border border-white/10 rounded-none w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-white/10 flex justify-between items-center">
                            <h3 className="font-bold text-sm">Thêm tài khoản</h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-gray-500 hover:text-white"><X size={18} /></button>
                        </div>
                        <div className="p-4 flex flex-col gap-2">
                            <input type="text" className="w-full bg-black/20 border border-white/10 p-2.5 rounded-none text-sm outline-none focus:border-fb-blue/50" placeholder="Email/SDT" value={newAcc.uid} onChange={e => setNewAcc({ ...newAcc, uid: e.target.value })} />
                            <input type="password" className="w-full bg-black/20 border border-white/10 p-2.5 rounded-none text-sm outline-none focus:border-fb-blue/50" placeholder="Mật khẩu" value={newAcc.password} onChange={e => setNewAcc({ ...newAcc, password: e.target.value })} />
                            <input type="text" className="w-full bg-black/20 border border-white/10 p-2.5 rounded-none text-sm outline-none focus:border-fb-blue/50" placeholder="2FA Key" value={newAcc.two_fa} onChange={e => setNewAcc({ ...newAcc, two_fa: e.target.value })} />
                            <input type="text" className="w-full bg-black/20 border border-white/10 p-2.5 rounded-none text-sm outline-none focus:border-fb-blue/50" placeholder="Ghi chú" value={newAcc.note} onChange={e => setNewAcc({ ...newAcc, note: e.target.value })} />
                        </div>
                        <div className="p-3 bg-black/20 flex justify-end">
                            <button className="px-5 py-2 bg-fb-blue text-white rounded-none font-bold text-sm" onClick={handleAddAccount}>Lưu lại</button>
                        </div>
                    </div>
                </div>
            )}

            {isBulkModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1000] p-4" onClick={() => setIsBulkModalOpen(false)}>
                    <div className="bg-[#14171d] border border-white/10 rounded-none w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-3 border-b border-white/10 flex justify-between items-center">
                            <h3 className="font-bold text-xs uppercase tracking-widest text-gray-400">Bulk Import</h3>
                            <button onClick={() => setIsBulkModalOpen(false)} className="text-gray-500 hover:text-white"><X size={16} /></button>
                        </div>
                        <div className="p-3">
                            <textarea
                                className="w-full bg-black/20 border border-white/10 p-2.5 rounded-none text-xs font-mono h-32 outline-none focus:border-fb-blue/50"
                                value={bulkText}
                                onChange={e => setBulkText(e.target.value)}
                                placeholder="Email|Pass|2FA|Note..."
                            />
                        </div>
                        <div className="p-2.5 bg-black/20 flex justify-end">
                            <button className="px-5 py-2 bg-fb-blue text-white rounded-none font-bold text-xs uppercase tracking-widest" onClick={handleBulkImport}>Import Account</button>
                        </div>
                    </div>
                </div>
            )}

            {isEditModalOpen && editingAccount && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1000] p-4" onClick={() => setIsEditModalOpen(false)}>
                    <div className="bg-[#14171d] border border-white/10 rounded-none w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-white/10 flex justify-between items-center">
                            <h3 className="font-bold text-sm">Chỉnh sửa tài khoản</h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-gray-500 hover:text-white"><X size={18} /></button>
                        </div>
                        <div className="p-4 flex flex-col gap-2">
                            <div className="space-y-0.5">
                                <label className="text-[9px] uppercase font-bold text-gray-500 ml-0.5">UID / Email</label>
                                <input type="text" className="w-full bg-black/20 border border-white/10 p-2.5 rounded-none text-sm outline-none focus:border-fb-blue/50" value={editingAccount.uid} onChange={e => setEditingAccount({ ...editingAccount, uid: e.target.value })} />
                            </div>
                            <div className="space-y-0.5">
                                <label className="text-[9px] uppercase font-bold text-gray-500 ml-0.5">Mật khẩu</label>
                                <div className="relative">
                                    <input type={showPassword ? "text" : "password"} className="w-full bg-black/20 border border-white/10 p-2.5 pr-10 rounded-none text-sm outline-none focus:border-fb-blue/50" value={editingAccount.password} onChange={e => setEditingAccount({ ...editingAccount, password: e.target.value })} />
                                    <button onClick={handleTogglePassword} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-0.5">
                                <label className="text-[9px] uppercase font-bold text-gray-500 ml-0.5">Mã 2FA</label>
                                <input type="text" className="w-full bg-black/20 border border-white/10 p-2.5 rounded-none text-sm outline-none focus:border-fb-blue/50" value={editingAccount.two_fa} onChange={e => setEditingAccount({ ...editingAccount, two_fa: e.target.value })} />
                            </div>
                            <div className="space-y-0.5">
                                <label className="text-[9px] uppercase font-bold text-gray-500 ml-0.5">Ghi chú</label>
                                <input type="text" className="w-full bg-black/20 border border-white/10 p-2.5 rounded-none text-sm outline-none focus:border-fb-blue/50" value={editingAccount.note} onChange={e => setEditingAccount({ ...editingAccount, note: e.target.value })} />
                            </div>
                        </div>
                        <div className="p-3 bg-black/20 flex justify-end gap-2">
                            <button className="px-5 py-2 bg-white/5 hover:bg-white/10 rounded-none text-xs font-bold transition-all" onClick={() => setIsEditModalOpen(false)}>Hủy</button>
                            <button className="px-5 py-2 bg-fb-blue text-white rounded-none font-bold text-sm shadow-lg shadow-blue-500/10" onClick={handleUpdateAccount}>Cập nhật</button>
                        </div>
                    </div>
                </div>
            )}

            {pinVerifyModal.open && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[2000] p-4" onClick={() => setPinVerifyModal({ open: false, pin: "" })}>
                    <div className="bg-[#14171d] border border-white/10 rounded-none w-full max-w-xs shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-3 border-b border-white/10 flex justify-between items-center">
                            <div className="flex flex-col">
                                <h3 className="font-bold text-xs">Xác nhận mã PIN</h3>
                                <p className="text-[8px] text-gray-500 uppercase font-black tracking-widest">Security Required</p>
                            </div>
                            <button onClick={() => setPinVerifyModal({ open: false, pin: "" })} className="text-gray-500 hover:text-white"><X size={16} /></button>
                        </div>
                        <div className="p-4">
                            <input
                                type="password"
                                className="w-full bg-black/20 border border-white/10 p-3 rounded-none text-center text-xl tracking-[0.6em] font-black outline-none focus:border-fb-blue/50"
                                autoFocus
                                value={pinVerifyModal.pin}
                                onChange={(e) => setPinVerifyModal({ ...pinVerifyModal, pin: e.target.value })}
                                onKeyPress={(e) => e.key === 'Enter' && handleVerifyPin()}
                                placeholder="••••"
                            />
                        </div>
                        <div className="p-2.5 bg-black/20 flex flex-col gap-1">
                            <button className="w-full py-2 bg-fb-blue text-white rounded-none font-bold text-xs uppercase transition-all active:scale-95" onClick={handleVerifyPin}>Xác nhận</button>
                            <button className="w-full py-1.5 text-gray-500 hover:text-white text-[9px] font-bold uppercase" onClick={() => setPinVerifyModal({ open: false, pin: "" })}>Hủy</button>
                        </div>
                    </div>
                </div>
            )}

            {cookieModal.open && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1000] p-4" onClick={() => setCookieModal({ open: false, content: "" })}>
                    <div className="bg-[#14171d] border border-white/10 rounded-none w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-3 border-b border-white/10 flex justify-between items-center">
                            <h3 className="font-bold text-xs uppercase tracking-widest text-gray-400">Cookies Content</h3>
                            <button onClick={() => setCookieModal({ open: false, content: "" })} className="p-1.5 hover:bg-white/5 rounded-none transition-all">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-3">
                            <textarea
                                className="w-full bg-black/40 border border-white/10 p-2.5 rounded-none text-[9px] font-mono h-40 outline-none break-all"
                                value={cookieModal.content}
                                readOnly
                            />
                        </div>
                        <div className="p-2.5 bg-black/20 flex justify-end">
                            <button className="px-5 py-2 bg-fb-blue text-white rounded-none font-bold text-xs uppercase tracking-widest shadow-lg shadow-blue-500/10" onClick={copyToClipboard}>
                                {copied ? "Đã copy!" : "Copy toàn bộ"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;
