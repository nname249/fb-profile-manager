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

    useEffect(() => {
        loadAccounts();
        loadSettings();
    }, []);

    const loadAccounts = async () => {
        const data = await window.electron.ipcRenderer.invoke("accounts:get");
        setAccounts(data);
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
        const res = await window.electron.ipcRenderer.invoke("accounts:check-status", id);
        if (res.success) {
            setStatusMap(prev => ({ ...prev, [id]: res.status }));
        } else {
            setStatusMap(prev => ({ ...prev, [id]: "Error" }));
        }
        setCheckingStatus(prev => ({ ...prev, [id]: false }));
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
            <header className="h-16 bg-[#14171d] border-b border-white/10 flex items-center px-5 gap-6 shadow-xl z-50">
                <div className="flex items-center gap-2.5 font-extrabold text-[#0084ff] text-lg tracking-tighter cursor-pointer" onClick={() => setActiveTab("accounts")}>
                    <Facebook size={24} fill="currentColor" />
                    <span>FB PRO</span>
                </div>

                <nav className="flex gap-1 flex-1">
                    <button
                        className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === "accounts" ? "bg-white/5 text-[#0084ff]" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
                        onClick={() => setActiveTab("accounts")}
                    >
                        Tài khoản
                    </button>
                    <button
                        className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === "settings" ? "bg-white/5 text-[#0084ff]" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
                        onClick={() => setActiveTab("settings")}
                    >
                        Cấu hình
                    </button>
                </nav>

                <div className="flex gap-2.5">
                    <button className="p-2.5 bg-fb-blue text-white rounded-xl shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all" onClick={() => setIsAddModalOpen(true)}>
                        <Plus size={18} />
                    </button>
                    <button className="p-2.5 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition-all" onClick={() => setIsBulkModalOpen(true)}>
                        <FileDown size={18} />
                    </button>
                </div>
            </header>

            <main className="flex-1 p-5 flex flex-col overflow-hidden">
                {/* Search Bar - only on accounts tab */}
                {activeTab === "accounts" && (
                    <div className="relative mb-4">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            className="w-full bg-[#1a1d23]/70 border border-white/10 h-10 pl-11 pr-4 rounded-xl text-sm outline-none focus:border-fb-blue/50 transition-all"
                            placeholder="Tìm kiếm theo UID hoặc ghi chú..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                )}

                <div className="flex-1 overflow-y-auto pr-1">
                    {activeTab === "accounts" ? (
                        <div className="grid gap-2">
                            {filteredAccounts.map(acc => (
                                <div className="bg-[#1a1d23]/70 backdrop-blur-md border border-white/10 rounded-xl px-5 py-3.5 flex items-center justify-between hover:bg-[#1e222a]/80 transition-all group" key={acc.id}>
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-[15px]">{acc.uid}</span>
                                                <div
                                                    className={`w-2.5 h-2.5 rounded-full shadow-lg ${statusMap[acc.id] === "Live" ? "bg-green-500 shadow-green-500/40" :
                                                            statusMap[acc.id]?.includes("Checkpoint") ? "bg-orange-500 shadow-orange-500/40" :
                                                                statusMap[acc.id] ? "bg-red-500 shadow-red-500/40" : "bg-gray-500"
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
                                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-all"
                                            onClick={() => handleCheckStatus(acc.id)}
                                            title="Check Status"
                                        >
                                            <RefreshCw size={14} className={checkingStatus[acc.id] ? "animate-spin" : ""} />
                                        </button>
                                        <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-fb-blue text-gray-400 hover:text-white transition-all" onClick={() => handleLaunch(acc.id)} title="Mở Browser">
                                            <ExternalLink size={14} />
                                        </button>
                                        <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-all" onClick={() => handleGetCookies(acc.id)} title="Lấy Cookies">
                                            <Cookie size={14} />
                                        </button>
                                        <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-all" onClick={() => handleDelete(acc.id)} title="Xóa">
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
                            <div className="bg-[#14171d] border border-white/10 rounded-2xl p-6">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4">Lưu trữ dữ liệu</h4>
                                <div className="bg-black/20 p-4 rounded-xl border border-white/5 flex items-center gap-4">
                                    <div className="flex-1 font-mono text-xs text-gray-400 truncate">{profilePath}</div>
                                    <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold transition-all" onClick={handleBrowsePath}>Đổi</button>
                                </div>
                            </div>
                            <div className="text-center py-10 opacity-20">
                                <Facebook size={40} className="mx-auto mb-2" />
                                <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400">v1.2.0 Tailwind Edition</div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Simple Toast */}
            {toast && (
                <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-2.5 rounded-full text-xs font-bold shadow-2xl z-[2000] border border-white/10 backdrop-blur-xl ${toast.type === 'error' ? 'text-red-400 bg-red-500/10' : 'text-green-400 bg-green-500/10'}`}>
                    {toast.message}
                </div>
            )}

            {/* Modals */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1000] p-4" onClick={() => setIsAddModalOpen(false)}>
                    <div className="bg-[#14171d] border border-white/10 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h3 className="font-bold">Thêm tài khoản</h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
                        </div>
                        <div className="p-6 flex flex-col gap-3">
                            <input type="text" className="w-full bg-black/20 border border-white/10 p-3 rounded-xl text-sm outline-none focus:border-fb-blue/50" placeholder="UID" value={newAcc.uid} onChange={e => setNewAcc({ ...newAcc, uid: e.target.value })} />
                            <input type="password" className="w-full bg-black/20 border border-white/10 p-3 rounded-xl text-sm outline-none focus:border-fb-blue/50" placeholder="Mật khẩu" value={newAcc.password} onChange={e => setNewAcc({ ...newAcc, password: e.target.value })} />
                            <input type="text" className="w-full bg-black/20 border border-white/10 p-3 rounded-xl text-sm outline-none focus:border-fb-blue/50" placeholder="2FA Key" value={newAcc.two_fa} onChange={e => setNewAcc({ ...newAcc, two_fa: e.target.value })} />
                            <input type="text" className="w-full bg-black/20 border border-white/10 p-3 rounded-xl text-sm outline-none focus:border-fb-blue/50" placeholder="Ghi chú" value={newAcc.note} onChange={e => setNewAcc({ ...newAcc, note: e.target.value })} />
                        </div>
                        <div className="p-4 bg-black/20 flex justify-end">
                            <button className="px-6 py-2.5 bg-fb-blue text-white rounded-xl font-bold text-sm" onClick={handleAddAccount}>Lưu lại</button>
                        </div>
                    </div>
                </div>
            )}

            {isBulkModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1000] p-4" onClick={() => setIsBulkModalOpen(false)}>
                    <div className="bg-[#14171d] border border-white/10 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-white/10">
                            <h3 className="font-bold">Nhập số lượng lớn</h3>
                            <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-widest font-bold">UID|Pass|2FA|Note</p>
                        </div>
                        <div className="p-6">
                            <textarea
                                className="w-full bg-black/20 border border-white/10 p-4 rounded-2xl text-xs font-mono h-40 outline-none focus:border-fb-blue/50"
                                value={bulkText}
                                onChange={e => setBulkText(e.target.value)}
                                placeholder="100088xxx|pass123|2FA|Note..."
                            />
                        </div>
                        <div className="p-4 bg-black/20 flex justify-end gap-3">
                            <button className="px-6 py-2.5 bg-fb-blue text-white rounded-xl font-bold text-sm" onClick={handleBulkImport}>Bắt đầu nhập</button>
                        </div>
                    </div>
                </div>
            )}

            {cookieModal.open && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1000] p-4" onClick={() => setCookieModal({ open: false, content: "" })}>
                    <div className="bg-[#14171d] border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-white/10">
                            <h3 className="font-bold">Cookies</h3>
                        </div>
                        <div className="p-6">
                            <textarea
                                className="w-full bg-black/40 border border-white/10 p-4 rounded-2xl text-[11px] font-mono h-52 outline-none break-all"
                                value={cookieModal.content}
                                readOnly
                            />
                        </div>
                        <div className="p-4 bg-black/20 flex justify-end">
                            <button className="px-8 py-2.5 bg-fb-blue text-white rounded-xl font-bold text-sm" onClick={copyToClipboard}>
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
