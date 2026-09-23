import { useCallback, useEffect, useRef, useState } from 'react';
import { createUser, deleteUser, listUsers, updateUser } from '../../api/userApi';
import { getErrorMessage } from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import Select from '../ui/Select';
import PageShell, { AlertBanner, PageHeader } from './PageShell';

export default function UsersPage() {
  const { user: currentUser, isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
  });

  const loadUsers = useCallback(async () => {
    setError('');
    try {
      const { data } = await listUsers();
      setUsers(data.users || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load users. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (!success) return undefined;
    const timer = setTimeout(() => setSuccess(''), 2500);
    return () => clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    if (!menuOpenId) return undefined;
    const close = () => setMenuOpenId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpenId]);

  const handleOpenModal = (user = null) => {
    if (!isAdmin) return;
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        password: '',
        role: user.role === 'admin' ? 'admin' : 'user',
      });
    } else {
      setEditingUser(null);
      setFormData({ name: '', email: '', password: '', role: 'user' });
    }
    setIsModalOpen(true);
    setSuccess('');
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    setSaving(true);
    setError('');
    try {
      if (editingUser) {
        const payload = {
          name: formData.name.trim(),
          role: formData.role,
        };
        if (formData.password) payload.password = formData.password;
        await updateUser(editingUser.id, payload);
        setSuccess('User updated.');
      } else {
        await createUser({
          name: formData.name.trim(),
          email: formData.email.trim(),
          password: formData.password,
          role: formData.role,
        });
        setSuccess('User created.');
      }
      handleCloseModal();
      await loadUsers();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save user. Admin access required.'));
    } finally {
      setSaving(false);
    }
  };

  const openDeleteUser = (user) => {
    if (!isAdmin) return;
    if (currentUser?.id === user.id) {
      setError('You cannot delete your own account.');
      return;
    }
    setMenuOpenId(null);
    setDeleteTarget(user);
  };

  const closeDeleteUser = () => {
    if (deleting) return;
    setDeleteTarget(null);
  };

  const confirmDeleteUser = async () => {
    if (!deleteTarget || !isAdmin) return;
    setDeleting(true);
    setError('');
    try {
      await deleteUser(deleteTarget.id);
      setSuccess('User deleted.');
      setDeleteTarget(null);
      await loadUsers();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete user. Admin access required.'));
    } finally {
      setDeleting(false);
    }
  };

  const roleBadge = (role) => (
    <span
      className={`inline-flex px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full ${
        role === 'admin'
          ? 'bg-black text-white'
          : 'bg-gray-100 text-gray-700 border border-gray-200'
      }`}
    >
      {role}
    </span>
  );

  const ActionButtons = ({ user }) => {
    if (!isAdmin) return null;
    const open = menuOpenId === user.id;
    const buttonRef = useRef(null);
    const [coords, setCoords] = useState(null);

    useEffect(() => {
      if (!open || !buttonRef.current) {
        setCoords(null);
        return undefined;
      }

      const place = () => {
        const rect = buttonRef.current.getBoundingClientRect();
        const menuHeight = 88;
        const openUp = window.innerHeight - rect.bottom < menuHeight + 8;
        setCoords({
          top: openUp ? rect.top - menuHeight - 4 : rect.bottom + 4,
          right: window.innerWidth - rect.right,
        });
      };

      place();
      window.addEventListener('resize', place);
      window.addEventListener('scroll', place, true);
      return () => {
        window.removeEventListener('resize', place);
        window.removeEventListener('scroll', place, true);
      };
    }, [open]);

    return (
      <div className="relative inline-flex justify-end">
        <button
          ref={buttonRef}
          type="button"
          aria-label="Actions"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpenId(open ? null : user.id);
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="5" r="1.75" />
            <circle cx="12" cy="12" r="1.75" />
            <circle cx="12" cy="19" r="1.75" />
          </svg>
        </button>
        {open && coords && (
          <div
            style={{ position: 'fixed', top: coords.top, right: coords.right }}
            className="z-50 w-36 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setMenuOpenId(null);
                handleOpenModal(user);
              }}
              className="block w-full px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={currentUser?.id === user.id}
              onClick={() => openDeleteUser(user)}
              className="block w-full px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <PageShell>
      <PageHeader
        title="User Management"
        description={
          isAdmin
            ? 'Add, edit, and delete user accounts'
            : 'View team members · only admins can make changes'
        }
        actions={
          isAdmin ? (
            <button type="button" onClick={() => handleOpenModal()} className="btn-primary">
              + Add User
            </button>
          ) : null
        }
      />

      {error && <AlertBanner>{error}</AlertBanner>}
      {success && <AlertBanner tone="success">{success}</AlertBanner>}

      {loading ? (
        <p className="text-sm text-gray-500">Loading users…</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-gray-500">No users found.</p>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto border border-gray-200 rounded-2xl bg-white shadow-sm">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  {isAdmin && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3 font-semibold text-gray-900">{user.name}</td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-600">{user.email}</td>
                    <td className="px-4 py-3">{roleBadge(user.role)}</td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <ActionButtons user={user} />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 text-sm truncate">{user.name}</p>
                    <p className="text-xs text-gray-600 font-mono break-all mt-0.5">{user.email}</p>
                  </div>
                  {roleBadge(user.role)}
                </div>
                {isAdmin && (
                  <div className="pt-2 border-t border-gray-100 flex justify-end">
                    <ActionButtons user={user} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {isAdmin && isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h3>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-black font-bold p-1 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label-field">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="label-field">Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input-field"
                  />
                </div>
              )}

              <div>
                <label className="label-field">
                  {editingUser ? 'New Password (optional)' : 'Password'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="label-field">Role</label>
                <Select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  options={[
                    { value: 'user', label: 'User' },
                    { value: 'admin', label: 'Admin' },
                  ]}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button type="button" onClick={handleCloseModal} className="btn-ghost">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Saving…' : editingUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAdmin && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center border-b border-gray-100 p-4">
              <h3 className="text-base font-bold text-gray-900">Delete User</h3>
              <button
                type="button"
                onClick={closeDeleteUser}
                disabled={deleting}
                className="text-gray-400 hover:text-black font-bold p-1 text-sm disabled:opacity-40"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600 leading-relaxed">
                Are you sure you want to delete{' '}
                <span className="font-semibold text-gray-900">{deleteTarget.name}</span> (
                {deleteTarget.email})? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeDeleteUser}
                  disabled={deleting}
                  className="btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteUser}
                  disabled={deleting}
                  className="btn-danger"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
