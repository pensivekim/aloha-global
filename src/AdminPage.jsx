import { useState, useEffect } from "react";
import {
  auth,
  googleProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "./firebase.js";
import { Loader2, LogOut, Plus, Pencil, Trash2 } from "lucide-react";

const ADMIN_EMAIL = "pensive.kim@gmail.com";

export default function AdminPage() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [facilities, setFacilities] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    id: "",
    name: "",
    address: "",
    phone: "",
    blog: "",
    type: "childcare",
    description: "",
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (isAdmin) fetchFacilities();
  }, [isAdmin]);

  async function getAuthHeader() {
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}` };
  }

  async function fetchFacilities() {
    setLoading(true);
    setError("");
    try {
      const headers = await getAuthHeader();
      const res = await fetch("/api/admin/facilities", { headers });
      if (!res.ok) throw new Error("Failed to load facilities");
      const data = await res.json();
      setFacilities(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    const { id, ...rest } = form;
    if (!id.trim()) {
      setError("ID is required");
      return;
    }
    try {
      const headers = {
        ...(await getAuthHeader()),
        "Content-Type": "application/json",
      };
      const res = await fetch("/api/admin/facilities", {
        method: "POST",
        headers,
        body: JSON.stringify({ id: id.trim(), data: rest }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Save failed");
      }
      await fetchFacilities();
      resetForm();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleDelete(facilityId) {
    if (!confirm(`Delete facility "${facilityId}"?`)) return;
    setError("");
    try {
      const headers = {
        ...(await getAuthHeader()),
        "Content-Type": "application/json",
      };
      const res = await fetch("/api/admin/facilities", {
        method: "DELETE",
        headers,
        body: JSON.stringify({ id: facilityId }),
      });
      if (!res.ok) throw new Error("Delete failed");
      await fetchFacilities();
    } catch (e) {
      setError(e.message);
    }
  }

  function startEdit(facilityId) {
    const f = facilities[facilityId];
    setForm({
      id: facilityId,
      name: f.name || "",
      address: f.address || "",
      phone: f.phone || "",
      blog: f.blog || "",
      type: f.type || "childcare",
      description: f.description || "",
    });
    setEditingId(facilityId);
    setShowForm(true);
  }

  function resetForm() {
    setForm({ id: "", name: "", address: "", phone: "", blog: "", type: "childcare", description: "" });
    setEditingId(null);
    setShowForm(false);
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <h1 className="text-xl font-bold text-gray-800 mb-4">Admin Login</h1>
          <button
            onClick={() => signInWithPopup(auth, googleProvider)}
            className="bg-orange-400 hover:bg-orange-500 text-white px-6 py-2.5 rounded-full font-medium transition-colors cursor-pointer"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <h1 className="text-xl font-bold text-red-600 mb-2">Access Denied</h1>
          <p className="text-gray-500 mb-4 text-sm">
            {user.email} does not have admin privileges.
          </p>
          <button
            onClick={() => signOut(auth)}
            className="text-orange-500 hover:text-orange-600 text-sm font-medium cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Facility Admin</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{user.email}</span>
            <button
              onClick={() => signOut(auth)}
              className="text-gray-400 hover:text-gray-600 cursor-pointer"
              title="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {/* Add button */}
        {!showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="mb-4 flex items-center gap-2 bg-orange-400 hover:bg-orange-500 text-white px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer text-sm"
          >
            <Plus className="w-4 h-4" /> Add Facility
          </button>
        )}

        {/* Form */}
        {showForm && (
          <form onSubmit={handleSave} className="bg-white rounded-xl shadow p-6 mb-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-700">
              {editingId ? `Edit: ${editingId}` : "New Facility"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">ID</label>
                <input
                  value={form.id}
                  onChange={(e) => setForm({ ...form, id: e.target.value })}
                  disabled={!!editingId}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:bg-gray-100"
                  placeholder="e.g. haesal"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                >
                  <option value="childcare">Childcare</option>
                  <option value="elderlycare">Elderly Care</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Phone</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-600 mb-1">Address</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-600 mb-1">Description</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-600 mb-1">Blog URL</label>
                <input
                  value={form.blog}
                  onChange={(e) => setForm({ ...form, blog: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="bg-orange-400 hover:bg-orange-500 text-white px-5 py-2 rounded-lg font-medium transition-colors cursor-pointer text-sm"
              >
                {editingId ? "Update" : "Create"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-5 py-2 rounded-lg font-medium transition-colors cursor-pointer text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Facilities table */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">ID</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Address</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Phone</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Blog</th>
                  <th className="px-4 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(facilities).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-gray-400 py-8">
                      No facilities registered.
                    </td>
                  </tr>
                ) : (
                  Object.entries(facilities).map(([id, f]) => (
                    <tr key={id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{id}</td>
                      <td className="px-4 py-3 text-gray-800">{f.name}</td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{f.address}</td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{f.phone}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {f.blog ? (
                          <a href={f.blog} target="_blank" rel="noreferrer" className="text-orange-500 hover:underline text-xs truncate block max-w-[200px]">
                            {f.blog}
                          </a>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => startEdit(id)}
                            className="text-gray-400 hover:text-orange-500 cursor-pointer"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(id)}
                            className="text-gray-400 hover:text-red-500 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
