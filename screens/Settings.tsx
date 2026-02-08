
import React from 'react';
import { useNavigate } from 'react-router-dom';

interface SettingsProps {
  toggleDarkMode: () => void;
  isDarkMode: boolean;
}

import { supabase } from '../supabaseClient';
import { UserProfile, BucketListItem } from '../types';

const Settings: React.FC<SettingsProps> = ({ toggleDarkMode, isDarkMode }) => {
  const navigate = useNavigate();
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [bucketList, setBucketList] = React.useState<BucketListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [newBucketItem, setNewBucketItem] = React.useState('');
  const [showAddBucket, setShowAddBucket] = React.useState(false);

  React.useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Should not happen if protected, but handle it
        console.error('No user found in Settings');
        return;
      }

      // Default fallback using auth metadata
      const defaultProfile: UserProfile = {
        id: user.id,
        full_name: user.user_metadata?.full_name || 'Dr. Usuario',
        specialty: user.user_metadata?.specialty || 'Medicina Estética',
        avatar_url: user.user_metadata?.avatar_url || null,
        subscription_tier: 'Free'
      };

      // Fetch Profile
      let { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (profileError) {
         console.log('Profile fetch error or missing:', profileError.code);
         // If row missing (PGRST116), try to create it
         if (profileError.code === 'PGRST116') {
            const { data: newProfile, error: createError } = await supabase
              .from('user_profiles')
              .insert([{ 
                id: user.id, 
                full_name: defaultProfile.full_name,
                specialty: defaultProfile.specialty,
                subscription_tier: defaultProfile.subscription_tier
              }])
              .select()
              .single();
            
            if (newProfile && !createError) {
                profileData = newProfile;
            } else {
                profileData = defaultProfile;
            }
         } else {
             // For 42P01 (table missing) or connection errors, use default
             profileData = defaultProfile;
         }
      }

      // Ensure we have something
      setProfile(profileData || defaultProfile);

      // Fetch Bucket List
      // Wrap in try-catch specifically to avoid failing everything if this table is missing
      try {
        const { data: bucketData, error: bucketError } = await supabase
          .from('bucket_list')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
          
        if (!bucketError && bucketData) setBucketList(bucketData);
      } catch (err) {
        console.warn('Bucket list fetch failed', err);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      // Last resort fallback
      setProfile({
        id: 'error',
        full_name: 'Dr. Usuario',
        specialty: 'Medicina Estética',
        avatar_url: null,
        subscription_tier: 'Free'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Error logs out:', error);
      navigate('/login');
    }
  };

  const handleAddBucketItem = async () => {
    if (!newBucketItem.trim()) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('bucket_list')
        .insert([{ user_id: user.id, title: newBucketItem, status: 'pending' }])
        .select()
        .single();
        
      if (data && !error) {
        setBucketList([data, ...bucketList]);
        setNewBucketItem('');
        setShowAddBucket(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleBucketItem = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'pending' ? 'done' : 'pending';
    // Optimistic update
    setBucketList(bucketList.map(item => item.id === id ? { ...item, status: newStatus } : item));
    
    await supabase.from('bucket_list').update({ status: newStatus }).eq('id', id);
  };

  const sections = [
    {
      title: 'Cuenta',
      items: [
        { 
          id: 'profile', 
          name: profile?.full_name || 'Cargando...', 
          sub: profile?.specialty || 'Especialidad', 
          icon: 'person', 
          type: 'link',
          img: profile?.avatar_url 
        },
        { 
          id: 'sub', 
          name: 'Suscripción', 
          badge: profile?.subscription_tier === 'Pro' ? 'Pro Activo' : 'Básico', 
          icon: 'verified', 
          type: 'link', 
          badgeColor: profile?.subscription_tier === 'Pro' ? 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30' : 'text-slate-600 bg-slate-100' 
        }
      ]
    },
    {
       title: 'Configuración Médica',
       items: [
         { id: 'units', name: 'Preferencias de Unidades', val: 'Unidades Allergan', icon: 'straighten', type: 'link' },
         { id: 'doses', name: 'Dosis de Toxina', icon: 'science', type: 'link' },
         { id: 'print', name: 'Preferencias de Impresión', icon: 'print', type: 'link' }
       ]
    },
    {
       title: 'Personalización',
       items: [
         { id: 'colors', name: 'Colores de Marca', icon: 'palette', type: 'link' },
         { id: 'font-size', name: 'Tamaño de Fuente', icon: 'text_fields', type: 'link' },
         { id: 'templates', name: 'Plantillas', icon: 'description', type: 'link' },
         { id: 'data', name: 'Gestión de Datos', icon: 'database', type: 'link' },
         { id: 'lang', name: 'Idioma', val: 'Español', icon: 'language', type: 'link' },
         { id: 'dark', name: 'Modo Oscuro', icon: 'dark_mode', type: 'toggle', active: isDarkMode, action: toggleDarkMode }
       ]
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark pb-32 overflow-y-auto no-scrollbar">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-background-light/90 dark:bg-background-dark/90 px-5 pt-12 pb-4 backdrop-blur-md">
        <h1 className="text-3xl font-bold tracking-tight">Ajustes</h1>
        <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-white dark:border-slate-800 shadow-sm bg-slate-200">
           {profile?.avatar_url ? (
             <img src={profile.avatar_url} alt="Profile" className="h-full w-full object-cover" />
           ) : (
             <span className="material-symbols-outlined text-slate-400 h-full w-full flex items-center justify-center">person</span>
           )}
        </div>
      </header>

      <main className="flex-1 px-4 space-y-6">
        {/* Bucket List Section */}
        <section>
          <div className="flex items-center justify-between mb-2 px-1">
             <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400"> Mi perfil</h2>
             <button onClick={() => setShowAddBucket(!showAddBucket)} className="text-primary text-xs font-bold hover:underline">
               {showAddBucket ? 'Cancelar' : 'Agregar'}
             </button>
          </div>
          
          {showAddBucket && (
            <div className="mb-3 flex gap-2">
              <input 
                value={newBucketItem}
                onChange={(e) => setNewBucketItem(e.target.value)}
                placeholder="Nueva meta..."
                className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 text-sm"
              />
              <button 
                onClick={handleAddBucketItem}
                className="bg-primary text-white p-2 rounded-xl flex items-center justify-center disabled:opacity-50"
                disabled={!newBucketItem.trim()}
              >
                <span className="material-symbols-outlined text-sm">add</span>
              </button>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl bg-white dark:bg-surface-dark shadow-sm border border-slate-100 dark:border-slate-800">
            {bucketList.length === 0 ? (
               <div className="p-4 text-center text-sm text-text-muted italic">No hay elementos pendientes.</div>
            ) : (
               bucketList.map((item, idx) => (
                 <React.Fragment key={item.id}>
                   <div className="flex items-center p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <div 
                        onClick={() => toggleBucketItem(item.id, item.status)}
                        className={`size-5 rounded-full border flex items-center justify-center cursor-pointer mr-3 transition-colors ${
                          item.status === 'done' 
                            ? 'bg-green-500 border-green-500 text-white' 
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {item.status === 'done' && <span className="material-symbols-outlined text-xs">check</span>}
                      </div>
                      <span className={`text-sm font-medium flex-1 ${item.status === 'done' ? 'line-through text-slate-400' : ''}`}>
                        {item.title}
                      </span>
                   </div>
                   {idx < bucketList.length - 1 && <div className="ml-12 h-px bg-slate-50 dark:bg-slate-800" />}
                 </React.Fragment>
               ))
            )}
          </div>
        </section>

        {sections.map((section, sIdx) => (
          <section key={sIdx}>
            <h2 className="mb-2 px-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{section.title}</h2>
            <div className="overflow-hidden rounded-2xl bg-white dark:bg-surface-dark shadow-sm border border-slate-100 dark:border-slate-800">
              {section.items.map((item: any, iIdx) => (
                <React.Fragment key={iIdx}>
                  <div 
                    onClick={() => {
                      if (item.type !== 'link') return;
                      if (item.id === 'sub') navigate('/subscription');
                      else if (item.id === 'profile') navigate('/profile');
                      else if (item.id === 'print') navigate('/print-preferences');
                      else if (item.id === 'colors') navigate('/brand-colors');
                      else if (item.id === 'font-size') navigate('/font-size');
                      else if (item.id === 'templates') navigate('/templates');
                      else if (item.id === 'data') navigate('/data-management');
                    }}
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/5 text-primary overflow-hidden">
                        {item.img ? <img src={item.img} className="w-full h-full object-cover" /> : <span className="material-symbols-outlined">{item.icon}</span>}
                      </div>
                      <div>
                        <p className="font-bold text-sm">{item.name}</p>
                        {item.sub && <p className="text-xs text-text-muted">{item.sub}</p>}
                        {item.badge && <p className={`text-[10px] font-bold px-2 py-0.5 rounded-md inline-block mt-1 ${item.badgeColor}`}>{item.badge}</p>}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                       {item.val && <span className="text-xs text-text-muted font-medium">{item.val}</span>}
                       {item.type === 'link' ? (
                         <span className="material-symbols-outlined text-slate-300">chevron_right</span>
                       ) : (
                         <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
                           <input type="checkbox" className="sr-only peer" checked={item.active} onChange={item.action} />
                           <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                         </label>
                       )}
                    </div>
                  </div>
                  {iIdx < section.items.length - 1 && <div className="ml-14 h-px bg-slate-50 dark:bg-slate-800" />}
                </React.Fragment>
              ))}
            </div>
          </section>
        ))}

        <div className="py-4 text-center">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">Versión 1.0.3 - Dynamic</p>
        </div>

        <button 
          onClick={handleLogout}
          className="w-full p-4 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 text-center mb-6"
        >
          <span className="text-red-600 dark:text-red-400 font-bold text-sm">Cerrar Sesión</span>
        </button>
      </main>
    </div>
  );
};

export default Settings;
