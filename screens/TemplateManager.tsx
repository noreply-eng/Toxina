import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  Search, 
  FileText, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Save,
  AlertCircle 
} from 'lucide-react';

interface Template {
  id: string;
  title: string;
  type: 'note' | 'consent' | 'instruction' | 'budget';
  content: string;
  is_default: boolean;
  created_at: string;
}

const TemplateManager = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  
  // Editor State
  const [isEditing, setIsEditing] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<Partial<Template>>({
    title: '',
    type: 'note',
    content: '',
    is_default: false
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (!currentTemplate.title || !currentTemplate.content) {
        alert('Por favor completa el título y el contenido');
        return;
      }

      const templateData = {
        user_id: user.id,
        title: currentTemplate.title,
        type: currentTemplate.type,
        content: currentTemplate.content,
        is_default: currentTemplate.is_default,
        updated_at: new Date().toISOString()
      };

      let error;
      if (currentTemplate.id) {
        const { error: updateError } = await supabase
          .from('templates')
          .update(templateData)
          .eq('id', currentTemplate.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('templates')
          .insert([templateData]);
        error = insertError;
      }

      if (error) throw error;

      await fetchTemplates();
      setIsEditing(false);
      setCurrentTemplate({ title: '', type: 'note', content: '', is_default: false });
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Error al guardar la plantilla');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar esta plantilla?')) return;

    try {
      const { error } = await supabase
        .from('templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  const insertVariable = (variable: string) => {
    setCurrentTemplate(prev => ({
      ...prev,
      content: (prev.content || '') + variable
    }));
  };

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || t.type === selectedType;
    return matchesSearch && matchesType;
  });

  if (isEditing) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header - Editor */}
        <header className="bg-white shadow-sm border-b border-gray-100 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsEditing(false)}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                title="Cancelar"
              >
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-xl font-bold text-gray-900">
                {currentTemplate.id ? 'Editar Plantilla' : 'Nueva Plantilla'}
              </h1>
            </div>
            <button 
              onClick={handleSave}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Save size={18} />
              <span>Guardar</span>
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-4xl mx-auto w-full p-4 sm:p-6 lg:p-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
            
            {/* Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                <input
                  type="text"
                  value={currentTemplate.title}
                  onChange={e => setCurrentTemplate({...currentTemplate, title: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="Ej: Nota de Evolución Estándar"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Plantilla</label>
                <select
                  value={currentTemplate.type}
                  onChange={e => setCurrentTemplate({...currentTemplate, type: e.target.value as any})}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                >
                  <option value="note">Nota Médica</option>
                  <option value="consent">Consentimiento Informado</option>
                  <option value="instruction">Instrucciones Post-Tratamiento</option>
                  <option value="budget">Presupuesto</option>
                </select>
              </div>
            </div>

            {/* Variable Helpers */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Variables Dinámicas</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Paciente', val: '{paciente}' },
                  { label: 'Edad', val: '{edad}' },
                  { label: 'Fecha', val: '{fecha}' },
                  { label: 'Diagnóstico', val: '{diagnostico}' },
                  { label: 'Tratamiento', val: '{tratamiento}' },
                  { label: 'Dosis Total', val: '{dosis}' },
                  { label: 'Próxima Cita', val: '{proxima_cita}' },
                ].map((v) => (
                  <button
                    key={v.val}
                    onClick={() => insertVariable(v.val)}
                    className="px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-full text-xs font-medium border border-blue-100 transition-colors"
                  >
                    + {v.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Haz clic para insertar. Estas variables se reemplazarán automáticamente al usar la plantilla.
              </p>
            </div>

            {/* Content Editor */}
            <div className="flex-1 flex flex-col">
              <label className="block text-sm font-medium text-gray-700 mb-1">Contenido</label>
              <textarea
                value={currentTemplate.content}
                onChange={e => setCurrentTemplate({...currentTemplate, content: e.target.value})}
                className="w-full flex-1 min-h-[400px] p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-sm leading-relaxed"
                placeholder="Escribe el contenido de tu plantilla aquí..."
              />
            </div>

          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - List */}
      <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate('/settings')}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Plantillas</h1>
                <p className="text-sm text-gray-500">Gestiona tus formatos de notas y documentos</p>
              </div>
            </div>
            
            <button 
              onClick={() => {
                setCurrentTemplate({ title: '', type: 'note', content: '', is_default: false });
                setIsEditing(true);
              }}
              className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg active:scale-95"
            >
              <Plus size={20} />
              <span className="font-medium">Nueva Plantilla</span>
            </button>
          </div>

          {/* Filters */}
          <div className="mt-6 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Buscar plantillas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
              {[
                { id: 'all', label: 'Todas' },
                { id: 'note', label: 'Notas' },
                { id: 'consent', label: 'Consentimientos' },
                { id: 'instruction', label: 'Instrucciones' },
                { id: 'budget', label: 'Presupuesto' },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedType === type.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 mb-4">
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay plantillas</h3>
            <p className="text-gray-500 max-w-sm mx-auto mb-6">
              {searchTerm || selectedType !== 'all' 
                ? 'No se encontraron plantillas con los filtros actuales.'
                : 'Crea tu primera plantilla para agilizar tu documentación clínica.'}
            </p>
            {(searchTerm || selectedType !== 'all') && (
              <button
                onClick={() => {setSearchTerm(''); setSelectedType('all');}}
                className="text-blue-600 font-medium hover:text-blue-700"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => (
              <div 
                key={template.id}
                className="group bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-200 transition-all duration-200 flex flex-col"
              >
                <div className="p-5 flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`
                      inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                      ${template.type === 'note' ? 'bg-green-100 text-green-800' : 
                        template.type === 'consent' ? 'bg-purple-100 text-purple-800' :
                        template.type === 'instruction' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'}
                    `}>
                      {template.type === 'note' ? 'Nota Médica' : 
                       template.type === 'consent' ? 'Consentimiento' :
                       template.type === 'instruction' ? 'Instrucciones' : 
                       'Presupuesto'}
                    </div>
                    {template.is_default && (
                      <span className="text-xs text-blue-600 font-medium flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-full">
                        <Check size={12} />
                        Por defecto
                      </span>
                    )}
                  </div>
                  
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-1">
                    {template.title}
                  </h3>
                  
                  <p className="text-sm text-gray-500 line-clamp-3 mb-4 font-mono bg-gray-50 p-2 rounded border border-gray-100">
                    {template.content}
                  </p>
                  
                  <div className="text-xs text-gray-400">
                    Creada: {new Date(template.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="border-t border-gray-100 p-3 bg-gray-50 rounded-b-xl flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      setCurrentTemplate(template);
                      setIsEditing(true);
                    }}
                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-white rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-white rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default TemplateManager;
