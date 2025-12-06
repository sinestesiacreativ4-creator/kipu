import React, { useState } from 'react';
import { User, Plus, ArrowRight, Trash2, UserPlus, Sparkles, X, Check } from 'lucide-react';
import { UserProfile } from '../types';
import { generateId } from '../utils';
import { supabaseDb as db } from '../services/supabaseDb';

interface ProfileSelectorProps {
  profiles: UserProfile[];
  onSelect: (profile: UserProfile) => void;
  onCreate: (profile: UserProfile) => void;
  onDelete: (profileId: string) => void;
  organizationName?: string;
}

const AVATAR_COLORS = [
  'bg-gradient-to-br from-red-500 to-rose-600',
  'bg-gradient-to-br from-amber-500 to-orange-600',
  'bg-gradient-to-br from-emerald-500 to-teal-600',
  'bg-gradient-to-br from-blue-500 to-indigo-600',
  'bg-gradient-to-br from-violet-500 to-purple-600',
  'bg-gradient-to-br from-pink-500 to-rose-600',
  'bg-gradient-to-br from-cyan-500 to-blue-600',
  'bg-gradient-to-br from-lime-500 to-green-600',
];

const ROLE_SUGGESTIONS = [
  'Asesor/a',
  'Abogado/a',
  'Facilitador/a',
  'Coordinador/a',
  'Investigador/a',
  'Director/a',
  'Lonko',
  'Otro'
];

const ProfileSelector: React.FC<ProfileSelectorProps> = ({
  profiles,
  onSelect,
  onCreate,
  onDelete,
  organizationName
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newProfile: UserProfile = {
      id: generateId(),
      name: newName.trim(),
      role: newRole.trim() || 'Asesor',
      avatarColor: selectedColor,
      organizationId: db.getDemoOrgId()
    };

    onCreate(newProfile);
    setIsCreating(false);
    setNewName('');
    setNewRole('');
  };

  const handleDeleteConfirm = (id: string) => {
    onDelete(id);
    setConfirmDelete(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-bone via-stone-50 to-stone-100 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950">
      {/* Decorative Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gold/5 rounded-full blur-3xl" />
      </div>

      <div className="relative flex-1 flex flex-col items-center justify-center p-6">
        <div className="max-w-5xl w-full">
          {/* Header */}
          <div className="text-center mb-12 animate-fade-in">
            {/* Logout Button */}
            <button
              onClick={() => {
                if (confirm('¿Cerrar sesión de organización?')) {
                  localStorage.clear();
                  sessionStorage.clear();
                  window.location.reload();
                }
              }}
              className="absolute top-6 right-6 px-4 py-2 text-stone-500 hover:text-red-500 text-sm font-medium transition-all duration-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full"
            >
              Cerrar Sesión
            </button>

            {/* Organization Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary dark:bg-primary/20 rounded-full mb-6">
              <Sparkles size={16} className="animate-pulse-soft" />
              <span className="text-sm font-semibold tracking-wide">
                {organizationName || 'Organización'}
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-stone-900 dark:text-white mb-4 tracking-tight">
              ¿Quién está grabando?
            </h1>
            <p className="text-stone-600 dark:text-stone-400 text-lg max-w-md mx-auto">
              Selecciona tu perfil para acceder a tus grabaciones y documentos.
            </p>
          </div>

          {/* Profile Grid */}
          {!isCreating ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5 animate-slide-up">
              {profiles.map((profile, index) => (
                <div
                  key={profile.id}
                  className="relative group"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Delete Confirmation Overlay */}
                  {confirmDelete === profile.id && (
                    <div className="absolute inset-0 z-20 bg-white dark:bg-stone-900 rounded-2xl flex flex-col items-center justify-center p-4 shadow-2xl animate-scale-in">
                      <p className="text-sm text-stone-600 dark:text-stone-400 text-center mb-4">
                        ¿Eliminar perfil y todas sus grabaciones?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="p-2 rounded-full bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                        >
                          <X size={18} className="text-stone-600 dark:text-stone-400" />
                        </button>
                        <button
                          onClick={() => handleDeleteConfirm(profile.id)}
                          className="p-2 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors shadow-lg shadow-red-500/30"
                        >
                          <Check size={18} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Profile Card */}
                  <button
                    onClick={() => onSelect(profile)}
                    className="w-full flex flex-col items-center p-6 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm hover:shadow-2xl hover:border-primary/30 transition-all duration-400 group card-hover-lift focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {/* Avatar */}
                    <div className={`w-20 h-20 rounded-full ${profile.avatarColor} flex items-center justify-center text-white text-2xl font-bold mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300 avatar`}>
                      {profile.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Name */}
                    <h3 className="text-base font-bold text-stone-800 dark:text-stone-100 mb-1 truncate w-full text-center">
                      {profile.name}
                    </h3>

                    {/* Role */}
                    <p className="text-xs text-stone-500 dark:text-stone-400 font-medium truncate w-full text-center">
                      {profile.role}
                    </p>
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(profile.id);
                    }}
                    className="absolute -top-2 -right-2 delete-btn shadow-lg"
                    title="Eliminar perfil"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}

              {/* Add New Profile Button */}
              <button
                onClick={() => setIsCreating(true)}
                className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-stone-50 to-stone-100 dark:from-stone-800/50 dark:to-stone-800 rounded-2xl border-2 border-dashed border-stone-300 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:border-primary hover:text-primary transition-all duration-300 min-h-[180px] group focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <div className="w-16 h-16 rounded-full bg-white dark:bg-stone-700 flex items-center justify-center mb-4 shadow-sm group-hover:shadow-lg group-hover:scale-110 transition-all duration-300">
                  <UserPlus size={28} />
                </div>
                <span className="font-semibold text-sm">Nuevo Perfil</span>
              </button>
            </div>
          ) : (
            /* Create Profile Form */
            <div className="max-w-lg mx-auto animate-scale-in">
              <div className="bg-white dark:bg-stone-900 p-8 rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-stone-900 dark:text-white">
                    Crear Perfil
                  </h2>
                  <button
                    onClick={() => setIsCreating(false)}
                    className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleCreate} className="space-y-6">
                  {/* Avatar Color Selector */}
                  <div>
                    <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-3">
                      Color de Avatar
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {AVATAR_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setSelectedColor(color)}
                          className={`w-10 h-10 rounded-full ${color} transition-all duration-200 ${selectedColor === color
                              ? 'ring-4 ring-primary ring-offset-2 dark:ring-offset-stone-900 scale-110'
                              : 'hover:scale-110'
                            }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Name Input */}
                  <div>
                    <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-2">
                      Nombre
                    </label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Ej. María, Juan Carlos..."
                      className="input-field"
                      required
                      autoFocus
                    />
                  </div>

                  {/* Role Input with Suggestions */}
                  <div>
                    <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-2">
                      Rol / Cargo
                    </label>
                    <input
                      type="text"
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      placeholder="Ej. Abogada, Facilitador..."
                      className="input-field mb-3"
                    />
                    <div className="flex flex-wrap gap-2">
                      {ROLE_SUGGESTIONS.slice(0, 6).map((role) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setNewRole(role)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${newRole === role
                              ? 'bg-primary text-white'
                              : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-primary/10 hover:text-primary'
                            }`}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Preview */}
                  {newName && (
                    <div className="flex items-center gap-4 p-4 bg-stone-50 dark:bg-stone-800/50 rounded-xl animate-fade-in">
                      <div className={`w-14 h-14 rounded-full ${selectedColor} flex items-center justify-center text-white text-xl font-bold shadow-lg`}>
                        {newName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-stone-900 dark:text-white">{newName}</p>
                        <p className="text-sm text-stone-500 dark:text-stone-400">{newRole || 'Asesor'}</p>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsCreating(false)}
                      className="btn-secondary flex-1"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={!newName.trim()}
                      className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Crear Perfil
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Footer Info */}
          <p className="text-center text-stone-400 dark:text-stone-600 text-sm mt-12">
            {profiles.length} {profiles.length === 1 ? 'perfil' : 'perfiles'} en esta organización
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProfileSelector;
