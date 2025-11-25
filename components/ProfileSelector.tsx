import React, { useState } from 'react';
import { User, Plus, ArrowRight, Trash2 } from 'lucide-react';
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

const COLORS = ['bg-red-600', 'bg-amber-600', 'bg-green-700', 'bg-blue-600', 'bg-indigo-600', 'bg-stone-600'];

const ProfileSelector: React.FC<ProfileSelectorProps> = ({ profiles, onSelect, onCreate, onDelete, organizationName }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newProfile: UserProfile = {
      id: generateId(),
      name: newName,
      role: newRole || 'Asesor',
      avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)],
      organizationId: db.getDemoOrgId()
    };

    onCreate(newProfile);
    setIsCreating(false);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('¿Estás seguro de que quieres eliminar este perfil? Se borrarán todas sus grabaciones.')) {
      onDelete(id);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bone dark:bg-stone-950 p-6">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12 relative">
          <button
            onClick={() => {
              if (confirm('¿Cerrar sesión de organización?')) {
                localStorage.clear();
                sessionStorage.clear();
                window.location.reload();
              }
            }}
            className="absolute top-0 right-0 text-stone-400 hover:text-red-500 text-sm font-medium transition-colors"
          >
            Cerrar Sesión
          </button>
          <h1 className="text-4xl font-bold text-stone-900 dark:text-white mb-4 tracking-tight">
            <span className="text-[#D4AF37] drop-shadow-sm">{organizationName || 'Asesorías Étnicas'}</span>
          </h1>
          <p className="text-stone-600 dark:text-stone-400 text-lg">
            Selecciona tu perfil para acceder a tus documentos y grabaciones.
          </p>
        </div>

        {!isCreating ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 animate-fade-in">
            {/* Existing Profiles */}
            {profiles.map((profile) => (
              <div key={profile.id} className="relative group">
                <button
                  onClick={() => onSelect(profile)}
                  className="w-full flex flex-col items-center p-8 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm hover:shadow-xl hover:border-primary/50 transition-all duration-300"
                >
                  <div className={`w-20 h-20 rounded-full ${profile.avatarColor} flex items-center justify-center text-white text-2xl font-bold mb-4 shadow-inner group-hover:scale-110 transition-transform`}>
                    {profile.name.charAt(0).toUpperCase()}
                  </div>
                  <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100">{profile.name}</h3>
                  <p className="text-sm text-stone-500 dark:text-stone-400 font-medium">{profile.role}</p>
                </button>
                <button
                  onClick={(e) => handleDelete(e, profile.id)}
                  className="absolute top-2 right-2 p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                  title="Eliminar perfil"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}

            {/* Add New Profile Button */}
            <button
              onClick={() => setIsCreating(true)}
              className="flex flex-col items-center justify-center p-8 bg-stone-100 dark:bg-stone-800/50 rounded-2xl border-2 border-dashed border-stone-300 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:bg-white dark:hover:bg-stone-800 hover:text-primary hover:border-primary transition-all"
            >
              <div className="w-16 h-16 rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center mb-4">
                <Plus size={32} />
              </div>
              <span className="font-medium">Nuevo Asesor</span>
            </button>
          </div>
        ) : (
          <div className="max-w-md mx-auto bg-white dark:bg-stone-900 p-8 rounded-2xl shadow-xl border border-stone-200 dark:border-stone-800 animate-fade-in">
            <h2 className="text-2xl font-bold text-stone-800 dark:text-white mb-6">Crear Perfil</h2>
            <form onSubmit={handleCreate} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-stone-600 dark:text-stone-300 mb-2">Nombre</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej. Rayen, Nahuel..."
                  className="w-full px-4 py-3 rounded-lg bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 focus:ring-2 focus:ring-primary focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600 dark:text-stone-300 mb-2">Rol / Cargo</label>
                <input
                  type="text"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  placeholder="Ej. Abogada, Facilitador..."
                  className="w-full px-4 py-3 rounded-lg bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="flex-1 px-4 py-3 text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium shadow-lg shadow-primary/20 transition-all"
                >
                  Crear <ArrowRight size={18} />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileSelector;
