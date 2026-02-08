import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Download, 
  Database, 
  Users, 
  History, 
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';

interface Stats {
  patients: number;
  sessions: number;
}

const DataManagement = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [stats, setStats] = useState<Stats>({ patients: 0, sessions: 0 });
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      
      // Count patients
      const { count: patientCount, error: pError } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true });
      
      // Count treatments
      const { count: treatmentCount, error: sError } = await supabase
        .from('treatments')
        .select('*', { count: 'exact', head: true });

      if (pError || sError) throw pError || sError;

      setStats({
        patients: patientCount || 0,
        sessions: treatmentCount || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const convertToCSV = (objArray: any[]) => {
    if (objArray.length === 0) return '';
    
    // Get all unique keys for headers
    const headers = Array.from(new Set(objArray.flatMap(obj => Object.keys(obj)))).join(',');
    const headerKeys = headers.split(',');
    
    let str = headers + '\r\n';

    for (let i = 0; i < objArray.length; i++) {
        let line = '';
        headerKeys.forEach((key, index) => {
            if (line !== '') line += ',';
            
            let value = objArray[i][key];
            if (typeof value === 'string') {
                value = `"${value.replace(/"/g, '""')}"`;
            } else if (value === null || value === undefined) {
                value = '';
            } else if (typeof value === 'object') {
                value = `"${JSON.stringify(value).replace(/"/g, '""')}"`;
            }
            
            line += value;
        });
        str += line + '\r\n';
    }
    return str;
};

  const downloadCSV = (csvContent: string, fileName: string) => {
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPatients = async () => {
    try {
      setExporting(true);
      setMessage(null);

      const { data, error } = await supabase
        .from('patients')
        .select(`
          full_name,
          curp,
          birth_date,
          gender,
          weight_kg,
          height_cm,
          phone,
          email,
          medical_notes,
          created_at
        `)
        .order('full_name');

      if (error) throw error;

      if (!data || data.length === 0) {
        alert('No hay pacientes para exportar');
        return;
      }

      const csv = convertToCSV(data);
      downloadCSV(csv, `pacientes_${new Date().toISOString().split('T')[0]}.csv`);
      
      setMessage({ type: 'success', text: 'Lista de pacientes exportada correctamente' });
    } catch (error) {
      console.error('Error exporting patients:', error);
      setMessage({ type: 'error', text: 'Error al exportar pacientes' });
    } finally {
      setExporting(false);
    }
  };

  const exportTreatments = async () => {
    try {
      setExporting(true);
      setMessage(null);

      const { data, error } = await supabase
        .from('treatments')
        .select(`
          date,
          product_name,
          total_units,
          dilution,
          notes,
          patients (full_name)
        `)
        .order('date', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        alert('No hay tratamientos para exportar');
        return;
      }

      const flattenedData = data.map((s: any) => ({
        fecha: s.date,
        paciente: s.patients?.full_name || 'Desconocido',
        producto: s.product_name,
        dosis_total: s.total_units,
        dilucion: s.dilution,
        notas: s.notes || ''
      }));

      const csv = convertToCSV(flattenedData);
      downloadCSV(csv, `historial_tratamientos_${new Date().toISOString().split('T')[0]}.csv`);
      
      setMessage({ type: 'success', text: 'Historial de tratamientos exportado correctamente' });
    } catch (error) {
      console.error('Error exporting treatments:', error);
      setMessage({ type: 'error', text: 'Error al exportar el historial' });
    } finally {
      setExporting(false);
    }
  };

  const exportTreatmentDetails = async () => {
    try {
      setExporting(true);
      setMessage(null);

      const { data, error } = await supabase
        .from('treatment_details')
        .select(`
          muscle_name,
          side,
          units,
          treatments (
            date,
            patients (full_name)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        alert('No hay detalles técnicos para exportar');
        return;
      }

      const flattenedData = data.map((d: any) => ({
        fecha: d.treatments?.date,
        paciente: d.treatments?.patients?.full_name || 'Desconocido',
        musculo: d.muscle_name,
        lado: d.side,
        unidades: d.units
      }));

      const csv = convertToCSV(flattenedData);
      downloadCSV(csv, `detalle_tecnico_musculos_${new Date().toISOString().split('T')[0]}.csv`);
      
      setMessage({ type: 'success', text: 'Detalle técnico exportado correctamente' });
    } catch (error) {
      console.error('Error exporting details:', error);
      setMessage({ type: 'error', text: 'Error al exportar el detalle técnico' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/settings')}
              className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gestión de Datos</h1>
              <p className="text-sm text-gray-500">Exporta y respalda tu información clínica</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Messages */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${
            message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
          }`}>
            {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            <span className="font-medium">{message.text}</span>
          </div>
        )}

        <div className="space-y-8">
          
          {/* Stats Section */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Database size={20} className="text-blue-600" />
              Resumen de Información
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition-all hover:shadow-md">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                  <Users size={24} />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Pacientes</p>
                  <p className="text-2xl font-bold text-gray-900">{loading ? '...' : stats.patients}</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition-all hover:shadow-md">
                <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
                  <History size={24} />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Tratamientos</p>
                  <p className="text-2xl font-bold text-gray-900">{loading ? '...' : stats.sessions}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Export Actions */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Download size={20} className="text-blue-600" />
              Herramientas de Exportación
            </h2>
            <div className="grid grid-cols-1 gap-4">
              
              <button
                onClick={exportPatients}
                disabled={exporting || loading}
                className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group hover:border-blue-200 hover:shadow-md transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-green-600 group-hover:bg-green-100 transition-colors">
                    <FileSpreadsheet size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">Exportar Pacientes (CSV)</h3>
                    <p className="text-sm text-gray-500">Datos personales, contacto y notas médicas</p>
                  </div>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg text-gray-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-all">
                  <Download size={20} />
                </div>
              </button>

              <button
                onClick={exportTreatments}
                disabled={exporting || loading}
                className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group hover:border-blue-200 hover:shadow-md transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 group-hover:bg-purple-100 transition-colors">
                    <History size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">Exportar Resumen de Historial (CSV)</h3>
                    <p className="text-sm text-gray-500">Lista cronológica de aplicaciones y dosis totales</p>
                  </div>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg text-gray-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-all">
                  <Download size={20} />
                </div>
              </button>

              <button
                onClick={exportTreatmentDetails}
                disabled={exporting || loading}
                className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group hover:border-blue-200 hover:shadow-md transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors">
                    <Database size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">Exportar Detalle Técnico (CSV)</h3>
                    <p className="text-sm text-gray-500">Desglose músculo por músculo de cada tratamiento</p>
                  </div>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg text-gray-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-all">
                  <Download size={20} />
                </div>
              </button>

            </div>
          </section>

          {/* Warning/Info */}
          <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex gap-4">
            <div className="flex-shrink-0 text-blue-600 mt-1">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h4 className="font-bold text-blue-900 mb-1">Nota de Seguridad</h4>
              <p className="text-sm text-blue-800 leading-relaxed">
                Los archivos exportados contienen información sensible de pacientes. 
                Asegúrate de almacenarlos en un lugar seguro y cumplir con las normativas locales de protección de datos (GDPR/ARCO). 
                La exportación se realiza localmente en tu navegador.
              </p>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default DataManagement;
