import React from 'react';
import { useNavigate } from 'react-router-dom';

const EmailConfirmation: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="relative flex h-screen w-full flex-col items-center justify-between bg-background-light dark:bg-background-dark p-6 overflow-hidden">
      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-5">
        <span className="material-symbols-outlined absolute -top-10 -right-10 text-[400px]">mark_email_unread</span>
        <span className="material-symbols-outlined absolute -bottom-10 -left-10 text-[350px]">hub</span>
      </div>

      <div className="flex flex-col items-center justify-center w-full max-w-lg flex-1 z-10 gap-8 text-center">
        
        <div className="bg-white dark:bg-surface-dark rounded-3xl shadow-xl p-8 md:p-12 w-full ring-1 ring-slate-100 dark:ring-slate-800 flex flex-col items-center animate-fade-in-up">
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-primary text-[48px]">mail</span>
            </div>
            
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-4">
                ¡Revisa tu correo!
            </h1>
            
            <p className="text-slate-500 dark:text-slate-400 text-lg mb-8 leading-relaxed">
                Hemos enviado un enlace de confirmación a tu dirección de correo electrónico. <br/>
                Por favor, haz clic en el enlace para activar tu cuenta e iniciar sesión.
            </p>

            <div className="w-full space-y-4">
                <button 
                    onClick={() => navigate('/login')}
                    className="w-full bg-primary hover:bg-primary-dark text-white font-bold h-14 rounded-2xl text-lg shadow-lg shadow-primary/25 transition-all transform active:scale-[0.98] outline-none focus:ring-4 focus:ring-primary/20"
                >
                    Volver a Iniciar Sesión
                </button>
            </div>
        </div>

        <p className="text-slate-400 text-sm">
            ¿No recibiste el correo? <span className="font-bold">Revisa tu carpeta de Spam</span>
        </p>

      </div>
      
      <div className="w-full text-center py-6 z-10">
        <p className="text-text-muted font-bold text-xs uppercase tracking-widest opacity-50">Toxina DLM</p>
      </div>
    </div>
  );
};

export default EmailConfirmation;
