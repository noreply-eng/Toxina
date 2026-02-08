
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { UserProfile } from '../types';

const EditProfile: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setFullName(data.full_name || '');
        setSpecialty(data.specialty || '');
        setAvatarUrl(data.avatar_url);
        setImagePreview(data.avatar_url);
      } else {
        // Fallback to metadata if no profile row yet
        setFullName(user.user_metadata?.full_name || '');
        setSpecialty(user.user_metadata?.specialty || '');
      }
    } catch (err) {
      console.error(err);
      setError('Error al cargar perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      const file = event.target.files[0];
      
      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('La imagen debe ser menor a 5MB');
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      setError(null);
    } catch (err: any) {
      console.error(err);
      setError('Error al seleccionar imagen');
    }
  };

  const uploadAvatar = async (file: File): Promise<string | null> => {
    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Delete old avatar if exists
      if (avatarUrl) {
        const oldPath = avatarUrl.split('/').slice(-2).join('/');
        await supabase.storage.from('avatars').remove([oldPath]);
      }

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      return data.publicUrl;
    } catch (err: any) {
      console.error(err);
      setError('Error al subir imagen');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user');

      let newAvatarUrl = avatarUrl;

      // Upload new image if selected
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput?.files && fileInput.files.length > 0) {
        newAvatarUrl = await uploadAvatar(fileInput.files[0]);
      }

      const updates = {
        id: user.id,
        full_name: fullName,
        specialty: specialty,
        avatar_url: newAvatarUrl,
        updated_at: new Date(),
      };

      const { error } = await supabase
        .from('user_profiles')
        .upsert(updates);

      if (error) throw error;

      navigate('/settings');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark pb-32">
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-surface-dark/90 px-4 py-3 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <button onClick={() => navigate('/settings')} className="flex size-10 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-base font-bold leading-tight flex-1 text-center truncate px-2">Editar Perfil</h1>
        <div className="size-10" />
      </header>

      <main className="p-6 space-y-6 max-w-md mx-auto w-full">
        <div className="flex flex-col items-center mb-6">
            <div className="relative">
              {imagePreview ? (
                <div 
                  className="size-24 rounded-full bg-slate-200 dark:bg-slate-700 border-4 border-white dark:border-slate-800 shadow-md bg-cover bg-center"
                  style={{ backgroundImage: `url(${imagePreview})` }}
                />
              ) : (
                <div className="size-24 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center border-4 border-white dark:border-slate-800 shadow-md">
                  <span className="material-symbols-outlined text-4xl text-slate-400">person</span>
                </div>
              )}
              <label className="absolute bottom-0 right-0 size-8 bg-primary rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:bg-primary-dark transition-colors">
                <span className="material-symbols-outlined text-white text-lg">photo_camera</span>
                <input 
                  type="file" 
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </label>
            </div>
            {!imagePreview && <p className="text-xs text-primary font-bold mt-2">Añadir foto</p>}
        </div>

        <div className="space-y-4">
            <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1 ml-1">Nombre Completo</label>
                <input 
                    type="text" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="Dr. Nombre Apellido"
                />
            </div>

            <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1 ml-1">Especialidad</label>
                <input 
                    type="text" 
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    className="w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="Medicina Estética"
                />
            </div>
        </div>

        {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium text-center">
                {error}
            </div>
        )}

        <button 
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/30 active:scale-95 transition-all disabled:opacity-70 disabled:active:scale-100 mt-8"
        >
            {saving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </main>
    </div>
  );
};

export default EditProfile;
