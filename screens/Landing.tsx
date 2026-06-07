import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ConsentCheckbox from '../components/ConsentCheckbox';
import { LEGAL_DOCUMENT_META, ARCO_CONTACT_EMAIL } from '../constants/legalVersions';

const MODULES = [
  {
    id: '01',
    title: 'Registro métrico de dosis',
    description:
      'Herramienta digital para la cuantificación y registro de dosis aplicadas en protocolos clínicos.',
    icon: 'analytics',
  },
  {
    id: '02',
    title: 'Mapeo estandarizado',
    description:
      'Módulo de asistencia visual para el mapeo estandarizado de puntos de inyección.',
    icon: 'grid_on',
  },
  {
    id: '03',
    title: 'Seguimiento evolutivo',
    description:
      'Registro longitudinal de sesiones, metas GAS y evolución dentro de protocolos de investigación.',
    icon: 'timeline',
  },
  {
    id: '04',
    title: 'Formación médica',
    description:
      'Recursos de consulta para médicos residentes en formación: puntos motores, patologías, diluciones y cálculo de dosis.',
    icon: 'menu_book',
  },
  {
    id: '05',
    title: 'Validación clínica',
    description:
      'Software en fase de validación clínica creado por el Dr. Marcos Yocupicio para el sector HealthTech.',
    icon: 'verified_user',
  },
] as const;

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const [consentChecked, setConsentChecked] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');

    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const handleAccessRequest = () => {
    if (!consentChecked) return;
    navigate('/signup');
  };

  return (
    <div className="landing-page min-h-screen bg-[#F8FAFB] text-[#0F172A] font-landing-body selection:bg-[#0891B2]/15">
      {/* Protocol grid background */}
      <div className="landing-grid-bg pointer-events-none fixed inset-0 z-0" aria-hidden="true" />

      {/* Floating nav */}
      <header
        className={`fixed top-4 left-4 right-4 z-50 mx-auto max-w-6xl transition-all duration-300 ${
          scrolled
            ? 'rounded-2xl border border-slate-200/80 bg-white/90 shadow-lg shadow-slate-900/5 backdrop-blur-md'
            : 'rounded-2xl border border-transparent bg-transparent'
        }`}
      >
        <nav className="flex items-center justify-between gap-4 px-5 py-3.5">
          <a href="#inicio" className="flex items-center gap-2.5 group cursor-pointer">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0891B2] text-white shadow-md shadow-[#0891B2]/25 transition-colors group-hover:bg-[#0e7490]">
              <span className="material-symbols-outlined text-[20px]">vaccines</span>
            </div>
            <div className="leading-tight">
              <span className="block font-landing-display text-sm font-bold tracking-tight text-slate-900">
                DeepLux Med
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Toxina DLM
              </span>
            </div>
          </a>

          <div className="hidden items-center gap-6 md:flex">
            <a
              href="#formacion"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-[#0891B2] cursor-pointer"
            >
              Formación
            </a>
            <a
              href="#modulos"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-[#0891B2] cursor-pointer"
            >
              Módulos
            </a>
            <a
              href="#privacidad"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-[#0891B2] cursor-pointer"
            >
              Privacidad
            </a>
            <a
              href="#aviso-legal"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-[#0891B2] cursor-pointer"
            >
              Aviso legal
            </a>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="hidden rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 cursor-pointer sm:inline-flex"
            >
              Iniciar sesión
            </Link>
            <a
              href="#acceso"
              className="inline-flex items-center rounded-xl bg-[#0891B2] px-4 py-2 text-sm font-semibold text-white shadow-md shadow-[#0891B2]/20 transition-colors hover:bg-[#0e7490] cursor-pointer"
            >
              Registro gratuito
            </a>
          </div>
        </nav>
      </header>

      <main className="relative z-10">
        {/* ── Hero ── */}
        <section id="inicio" className="px-4 pb-16 pt-28 sm:px-6 lg:px-8 lg:pb-24 lg:pt-36">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
            <div>
              <div className="mb-6 flex flex-wrap items-center gap-2.5">
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/80 bg-amber-50 px-3.5 py-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60 motion-reduce:animate-none" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                    Versión Beta — Investigación Clínica
                  </span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/80 bg-emerald-50 px-3.5 py-1.5">
                  <span className="material-symbols-outlined text-[15px] text-emerald-700">volunteer_activism</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                    Uso gratuito
                  </span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-[#0891B2]/30 bg-[#0891B2]/5 px-3.5 py-1.5">
                  <span className="material-symbols-outlined text-[15px] text-[#0891B2]">school</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#0e7490]">
                    Formación de residentes
                  </span>
                </div>
              </div>

              <h1 className="font-landing-display text-[2rem] font-bold leading-[1.12] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.25rem]">
                Optimización y Registro Métrico en la Aplicación de{' '}
                <span className="text-[#0891B2]">Toxina Botulínica</span>
              </h1>

              <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
                Plataforma tecnológica de apoyo para profesionales de la salud y{' '}
                <strong className="font-semibold text-slate-800">médicos residentes en formación</strong>.
                Documentación estructurada, trazabilidad de dosis, mapeo asistido y material de consulta
                clínica — sin sustituir el juicio médico.{' '}
                <strong className="font-semibold text-emerald-700">Actualmente de uso gratuito.</strong>
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                    <span className="material-symbols-outlined text-[22px]">school</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Dirección clínica
                    </p>
                    <p className="text-sm font-semibold text-slate-800">
                      Dr. Marcos Yocupicio
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span className="material-symbols-outlined text-[18px] text-[#0891B2]">science</span>
                  Mérida, Yucatán · México
                </div>
              </div>
            </div>

            {/* Clinical report preview — real app output */}
            <div className="relative">
              <div className="landing-spec-panel overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
                <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[11px] font-medium uppercase tracking-widest text-slate-400">
                      Documento clínico · Ejemplo real
                    </span>
                    <span className="shrink-0 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                      Gratuito
                    </span>
                  </div>
                </div>
                <div className="p-4 sm:p-5">
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-inner">
                    <img
                      src="/landing/reporte-aplicacion-toxina.png"
                      alt="Reporte de aplicación de toxina botulínica generado por Toxina DLM, con dosis por músculo, volumen en ml y total aplicado"
                      className="w-full h-auto object-contain"
                      loading="eager"
                    />
                  </div>
                  <p className="mt-4 text-center text-xs leading-relaxed text-slate-500">
                    Reporte exportable con cálculo de dosis por músculo, volumen y patología —
                    útil en consulta clínica y formación de residentes.
                  </p>
                  <dl className="mt-4 space-y-2.5 border-t border-slate-100 pt-4">
                    {[
                      ['Función', 'Soporte de registro clínico'],
                      ['Acceso', 'Gratuito durante fase Beta'],
                      ['Clasificación', 'No es dispositivo médico comercial'],
                    ].map(([term, value]) => (
                      <div key={term} className="flex justify-between gap-4">
                        <dt className="text-xs font-medium text-slate-400">{term}</dt>
                        <dd className="text-right text-xs font-semibold text-slate-700">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
              <div
                className="absolute -bottom-3 -left-3 -z-10 h-full w-full rounded-3xl bg-[#0891B2]/8"
                aria-hidden="true"
              />
            </div>
          </div>
        </section>

        {/* ── Medical education ── */}
        <section id="formacion" className="px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="overflow-hidden rounded-3xl border border-[#0891B2]/20 bg-gradient-to-br from-white via-[#F0FDFA] to-white shadow-sm">
              <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_1.2fr] lg:items-center lg:gap-12">
                <div>
                  <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#0891B2]">
                    Formación médica
                  </p>
                  <h2 className="font-landing-display text-2xl font-bold text-slate-900 sm:text-3xl">
                    Herramienta de apoyo para residentes en formación
                  </h2>
                  <p className="mt-4 text-slate-600 leading-relaxed">
                    Toxina DLM también tiene fines educativos: consulta de anatomía funcional,
                    protocolos por patología y práctica guiada en el cálculo de dosis — siempre bajo
                    supervisión del médico adscrito y con fines formativos, no terapéuticos autónomos.
                  </p>
                  <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
                    <span className="material-symbols-outlined text-[20px] text-emerald-600">payments</span>
                    <span className="text-sm font-bold text-emerald-800">
                      Acceso completo gratuito en la fase Beta actual
                    </span>
                  </div>
                </div>

                <ul className="grid gap-3 sm:grid-cols-2">
                  {[
                    {
                      icon: 'biotech',
                      title: 'Puntos motores',
                      text: 'Atlas de músculos y zonas de inyección para estudio anatómico.',
                    },
                    {
                      icon: 'calculate',
                      title: 'Calculadora clínica',
                      text: 'Diluciones, unidades y volúmenes con trazabilidad del cálculo.',
                    },
                    {
                      icon: 'clinical_notes',
                      title: 'Patologías',
                      text: 'Esquemas de referencia por indicación clínica documentada.',
                    },
                    {
                      icon: 'picture_as_pdf',
                      title: 'Reportes',
                      text: 'Documentos exportables para bitácora formativa o expediente.',
                    },
                  ].map((item) => (
                    <li
                      key={item.icon}
                      className="flex gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
                    >
                      <span className="material-symbols-outlined mt-0.5 shrink-0 text-[22px] text-[#0891B2]">
                        {item.icon}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{item.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{item.text}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── Disclaimer ── */}
        <section id="aviso-legal" className="px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="landing-disclaimer rounded-2xl border-l-4 border-amber-500 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600">gavel</span>
                <h2 className="font-landing-display text-lg font-bold text-slate-900">
                  Aviso de Uso Clínico e Investigación
                </h2>
              </div>
              <p className="text-sm leading-relaxed text-slate-700 sm:text-base">
                Esta plataforma es una herramienta tecnológica de asistencia en fase Beta, diseñada
                exclusivamente como soporte para el registro y análisis en protocolos de investigación
                clínica. <strong>No sustituye, bajo ninguna circunstancia</strong>, el juicio clínico,
                diagnóstico o decisión terapéutica del profesional de la salud legalmente facultado. El
                usuario es el único responsable de la verificación de las dosis, planos anatómicos y
                esquemas aplicados al paciente.
              </p>
            </div>
          </div>
        </section>

        {/* ── Modules bento ── */}
        <section id="modulos" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 max-w-2xl">
              <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#0891B2]">
                Capacidades técnicas
              </p>
              <h2 className="font-landing-display text-2xl font-bold text-slate-900 sm:text-3xl">
                Módulos de la plataforma
              </h2>
              <p className="mt-3 text-slate-600">
                Descripción funcional orientada al registro y análisis en investigación clínica — no
                constituye promesa terapéutica ni publicidad de servicios médicos.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {MODULES.map((mod) => (
                <article
                  key={mod.id}
                  className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-[#0891B2]/30 hover:shadow-md cursor-default"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[#0891B2]">{mod.id}</span>
                    <span className="material-symbols-outlined text-[22px] text-slate-400 transition-colors group-hover:text-[#0891B2]">
                      {mod.icon}
                    </span>
                  </div>
                  <h3 className="font-landing-display mb-2 text-base font-bold text-slate-900">
                    {mod.title}
                  </h3>
                  <p className="flex-1 text-sm leading-relaxed text-slate-600">{mod.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Privacy / LFPDPPP ── */}
        <section id="privacidad" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
              <div>
                <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#0891B2]">
                  LFPDPPP · Datos sensibles
                </p>
                <h2 className="font-landing-display text-2xl font-bold text-slate-900 sm:text-3xl">
                  Motor de datos y privacidad
                </h2>
                <p className="mt-4 text-slate-600 leading-relaxed">
                  Al registrar esquemas de toxina botulínica, los médicos ingresan datos de salud de
                  sus pacientes — mapeo facial, dosis, evolutivos. Estos son{' '}
                  <strong>datos personales sensibles</strong> ante la legislación mexicana.
                </p>

                <ul className="mt-6 space-y-4">
                  {[
                    {
                      icon: 'shield',
                      text: 'Consentimiento expreso digital requerido — casilla desmarcada por defecto.',
                    },
                    {
                      icon: 'description',
                      text: 'Aviso de Privacidad Integral con identidad del responsable y derechos ARCO.',
                    },
                    {
                      icon: 'lock',
                      text: 'El profesional actúa como responsable del tratamiento frente a datos de pacientes.',
                    },
                  ].map((item) => (
                    <li key={item.icon} className="flex gap-3">
                      <span className="material-symbols-outlined mt-0.5 text-[20px] text-[#0891B2]">
                        {item.icon}
                      </span>
                      <span className="text-sm text-slate-700">{item.text}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  to={LEGAL_DOCUMENT_META.privacy.route}
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-[#0891B2] transition-colors hover:text-[#0e7490] hover:underline cursor-pointer"
                >
                  Leer Aviso de Privacidad Integral
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </Link>
              </div>

              <div id="acceso" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-900/5 sm:p-8">
                <div className="mb-1 inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
                  <span className="material-symbols-outlined text-[14px]">volunteer_activism</span>
                  Gratuito
                </div>
                <h3 className="font-landing-display mt-2 text-xl font-bold text-slate-900">
                  Acceso para investigadores y residentes
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Cree su cuenta sin costo durante la fase Beta. El registro requiere consentimiento
                  expreso para el tratamiento de datos conforme al aviso vigente.
                </p>

                <div className="mt-6">
                  <ConsentCheckbox
                    id="landing-privacy-consent"
                    checked={consentChecked}
                    onChange={setConsentChecked}
                    linkHref={LEGAL_DOCUMENT_META.privacy.route}
                    linkLabel="Aviso de Privacidad Integral"
                  >
                    He leído el Aviso de Privacidad Integral y otorgo mi consentimiento expreso para
                    el tratamiento de mis datos y de los datos clínicos sensibles bajo los términos
                    especificados.
                  </ConsentCheckbox>
                </div>

                <button
                  type="button"
                  onClick={handleAccessRequest}
                  disabled={!consentChecked}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0891B2] py-4 text-base font-bold text-white shadow-lg shadow-[#0891B2]/20 transition-all duration-200 hover:bg-[#0e7490] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none cursor-pointer"
                >
                  Crear cuenta gratuita
                  <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                </button>

                <p className="mt-4 text-center text-xs text-slate-500">
                  ¿Ya tiene cuenta?{' '}
                  <Link to="/login" className="font-bold text-[#0891B2] hover:underline cursor-pointer">
                    Iniciar sesión
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer legal ── */}
      <footer className="relative z-10 border-t border-slate-200 bg-white px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0891B2] text-white">
                  <span className="material-symbols-outlined text-[18px]">vaccines</span>
                </div>
                <span className="font-landing-display font-bold text-slate-900">DeepLux Med</span>
              </div>
              <p className="text-sm leading-relaxed text-slate-600">
                Plataforma Toxina DLM — soporte tecnológico para investigación clínica, formación de
                residentes y registro en toxina botulínica. Uso gratuito en fase Beta.
              </p>
            </div>

            <div>
              <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">
                Documentos legales
              </h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    to={LEGAL_DOCUMENT_META.privacy.route}
                    className="font-medium text-slate-700 transition-colors hover:text-[#0891B2] cursor-pointer"
                  >
                    Aviso de Privacidad Integral
                  </Link>
                </li>
                <li>
                  <Link
                    to={LEGAL_DOCUMENT_META.terms.route}
                    className="font-medium text-slate-700 transition-colors hover:text-[#0891B2] cursor-pointer"
                  >
                    Términos y Condiciones de Uso
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">
                Datos de la empresa
              </h4>
              <address className="not-italic text-sm leading-relaxed text-slate-600">
                <strong className="text-slate-800">Juan Marcos Yocupicio Robles</strong>
                <br />
                Marca comercial: DeepLux Med / Toxina DLM
                <br />
                Calle 34 x 41, No. 439, Col. Industrial
                <br />
                C.P. 97150, Mérida, Yucatán, México
                <br />
                <a
                  href={`mailto:${ARCO_CONTACT_EMAIL}`}
                  className="text-[#0891B2] font-medium hover:underline cursor-pointer"
                >
                  {ARCO_CONTACT_EMAIL}
                </a>
              </address>
            </div>
          </div>

          <div className="mt-10 rounded-xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs leading-relaxed text-slate-600">
              <strong className="text-slate-800">Leyenda de no suministro:</strong> DeepLux no
              comercializa, distribuye ni prescribe sustancias farmacológicas ni toxinas botulínicas de
              ninguna marca comercial. La app es estrictamente un soporte de información en salud,
              proporcionada &ldquo;tal cual&rdquo; (as-is) durante su periodo de prueba de
              investigación.
            </p>
          </div>

          <p className="mt-8 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} DeepLux Med · Toxina DLM · Todos los derechos reservados
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
