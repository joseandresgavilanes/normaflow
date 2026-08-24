"use client";
import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Building2, LogOut, Mail, Palette, RotateCcw, Shield, SlidersHorizontal, UserRound, UserRoundCheck, Camera, KeyRound, MonitorSmartphone } from "lucide-react";
import type { ReactNode } from "react";
import PageHeader from "@/components/layout/PageHeader";
import PageTabs from "@/components/ui/PageTabs";
import Avatar from "@/components/ui/Avatar";
import InfoTip from "@/components/ui/InfoTip";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { useModuleSection } from "@/hooks/useModuleSection";
import { useWorkspace } from "@/context/WorkspaceStore";
import { removeProfilePhoto, updateCurrentProfile, updateProfilePhoto } from "@/lib/actions/account";
import { updateNotificationEmailPreference } from "@/lib/actions/notifications";
import { setDateDisplayPreference, setHomePreference, setMotionPreference } from "@/lib/actions/preferences";
import { createDelegation, revokeDelegation } from "@/lib/actions/delegation";
import { requestPasswordReset } from "@/lib/actions/security";
import { revokeSession } from "@/lib/actions/sessions";
import { describeDevice } from "@/lib/device-label";
import {
  DEFAULT_HOME, HOME_COOKIE, HOME_OPTIONS,
  NAV_OPEN_GROUPS_STORAGE_KEY, NAV_PINNED_STORAGE_KEY, readHomePreference,
} from "@/lib/preferences/config";
import {
  DATE_FORMAT_OPTIONS, SYSTEM_TIME_ZONE, deviceTimeZone, formatDate, formatDateTime,
  readDateFormat, supportedTimeZones, timeZoneLabel, type DateFormatStyle,
} from "@/lib/format/datetime";
import type { NotificationType } from "@prisma/client";
import PersonPicker from "@/components/ui/PersonPicker";
import Picker from "@/components/ui/Picker";
import FileImportArea from "@/components/ui/FileImportArea";
import DateField from "@/components/ui/DateField";

type AccountSection = "profile" | "appearance" | "workspace" | "notifications" | "absence" | "security";

const SECTION_META: Record<AccountSection, { title: string; description: string }> = {
  profile: { title: "Perfil", description: "Cómo te ve el resto del equipo y cómo te identifica el sistema." },
  appearance: { title: "Apariencia", description: "Tema, idioma y formato con el que se te muestran los datos." },
  workspace: { title: "Espacio de trabajo", description: "Dónde entras, cómo se comporta la interfaz y el estado de tu navegación." },
  notifications: { title: "Avisos", description: "Qué te llega al buzón de correo y qué se queda solo en la campana." },
  absence: { title: "Ausencia", description: "Quién recibe tus avisos mientras no estás." },
  security: { title: "Seguridad", description: "Contraseña, sesiones abiertas y cierre de sesión." },
};

/**
 * Avisos y ausencia se guardan contra el usuario autenticado: en la sesión demo
 * no existen. Sus pestañas se pintaban igualmente y abrían una pantalla en
 * blanco —ni contenido, ni aviso, ni salida—, que es la peor respuesta posible
 * a un clic.
 */
const SOLO_LIVE: AccountSection[] = ["notifications", "absence"];

function tabsFor(live: boolean) {
  return (Object.keys(SECTION_META) as AccountSection[])
    .filter((id) => live || !SOLO_LIVE.includes(id))
    .map((id) => ({ id, label: SECTION_META[id].title }));
}

type ServerProfile = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  organizationId: string;
  organizationName: string;
  role: string;
  notifications: { emailEnabled: boolean; disabledTypes: NotificationType[] };
  delegations: {
    id: string; startsAt: string; endsAt: string; reason: string | null; revokedAt: string | null;
    toUser: { id: string; name: string; email: string };
  }[];
  colleagues: { id: string; name: string; email: string }[];
  sessions: {
    id: string; createdAt: string; lastSeenAt: string | null;
    ip: string | null; userAgent: string | null; aal: string | null; current: boolean;
  }[];
};

/**
 * Los cuatro tipos que emite el sistema, descritos por lo que provocan y no
 * por su nombre en el enum: «WARNING» no le dice nada a nadie.
 */
const NOTIFICATION_TYPES: { value: NotificationType; label: string; description: string }[] = [
  { value: "ALERT", label: "Críticos", description: "No conformidades graves, riesgos que superan el umbral, incidentes." },
  { value: "WARNING", label: "Requieren atención", description: "Vencimientos, cambios regulatorios, umbrales incumplidos." },
  { value: "INFO", label: "Asignaciones", description: "Te asignan una obligación, un documento o una acción." },
  { value: "SUCCESS", label: "Confirmaciones", description: "Aprobaciones y cierres que te afectan." },
];

/**
 * Cuenta y preferencias.
 *
 * Antes esta pantalla era un único campo —el nombre visible— mientras que el
 * tema y el idioma vivían sueltos en la barra superior, sin explicación ni
 * sitio donde encontrarlos. Aquí están juntos y contados: qué hace cada ajuste
 * y hasta dónde llega.
 *
 * Solo aparecen ajustes que existen de verdad. Un conmutador que no persiste
 * nada es peor que su ausencia: promete una preferencia que se pierde al
 * recargar.
 *
 * Lo que sí se ha quitado de la vista es la explicación permanente. La pantalla
 * decía cuatro veces lo mismo: el `<h1>`, la pestaña, el encabezado de la
 * tarjeta y su descripción repetían «Espacio de trabajo» y su definición
 * palabra por palabra, y bajo cada control había dos líneas más. Ahora el
 * nombre lo pone la pestaña, la tarjeta solo se encabeza cuando aporta un
 * asunto nuevo, y toda explicación vive detrás del icono de ayuda de su propio
 * control.
 */
export default function ProfileSettingsModule({ serverProfile }: { serverProfile?: ServerProfile }) {
  const { state, dispatch, showToast } = useWorkspace();
  /* Diez tarjetas en una sola rejilla se leían como un muro. Se reparten en
     secciones. La cuenta no es una norma y no cuelga del sidebar, así que su
     navegación vive aquí dentro. */
  const [sectionRaw, setSection] = useModuleSection<AccountSection>("profile");
  const { session } = state;
  const live = serverProfile !== undefined;
  const tabs = tabsFor(live);
  // Una sección que ya no existe (enlace guardado, vuelta desde live a demo)
  // vuelve al perfil en vez de dejar la página sin ninguna pestaña marcada.
  const section = tabs.some((tab) => tab.id === sectionRaw) ? sectionRaw : "profile";
  const profile = serverProfile ?? { name: session.name, email: session.email, organizationName: session.orgName, role: session.roleLabel };
  const uid = useId();
  const [savedName, setSavedName] = useState(profile.name);
  const [name, setName] = useState(profile.name);
  const [pending, startTransition] = useTransition();
  const dirty = name.trim() !== savedName && name.trim().length > 0;

  useEffect(() => {
    setName(profile.name);
    setSavedName(profile.name);
  }, [profile.name]);

  function save() {
    if (!name.trim()) {
      showToast("El nombre no puede estar vacío");
      return;
    }
    if (!live) {
      dispatch({ type: "updateSession", patch: { name: name.trim() } });
      setSavedName(name.trim());
      showToast("Perfil actualizado en esta sesión demo");
      return;
    }
    startTransition(async () => {
      try {
        const result = await updateCurrentProfile({ name });
        setSavedName(result.name);
        setName(result.name);
        showToast("Perfil actualizado");
      } catch (error) {
        showToast(error instanceof Error ? error.message : "No se pudo actualizar el perfil");
      }
    });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    /* Navegación dura: el router del cliente guarda 30 s de payloads RSC
       (`staleTimes.dynamic` en next.config.ts), así que un `push` pintaba
       primero los de la cuenta anterior y el `refresh` llegaba después. Al
       cambiar de identidad se descarta todo el estado del cliente. */
    window.location.assign("/login");
  }

  return (
    <div className="nf-account">
      <PageHeader
        title={SECTION_META[section].title}
        subtitle={live
          ? SECTION_META[section].description
          : "Sesión demo del navegador: los cambios no salen de este dispositivo."}
      />

      <section className="nf-account__identity">
        <Avatar name={savedName} size={64} src={serverProfile?.avatarUrl} />
        <div className="nf-account__identity-text">
          <h2 className="nf-account__name">{savedName}</h2>
          <p className="nf-account__meta">
            <Mail size={14} strokeWidth={2} aria-hidden />
            <span title={profile.email}>{profile.email}</span>
          </p>
          <div className="nf-account__chips">
            <span className="nf-account__chip"><Building2 size={13} strokeWidth={2} aria-hidden />{profile.organizationName}</span>
            <span className="nf-account__chip"><Shield size={13} strokeWidth={2} aria-hidden />{profile.role.replaceAll("_", " ")}</span>
          </div>
        </div>
      </section>

      <PageTabs
        tabs={tabs}
        active={section}
        onChange={setSection}
        label="Secciones de la cuenta"
      />

      <div className="nf-account__grid">
        {/* La tarjeta de perfil no se encabeza: la pestaña activa y el `<h1>`
            ya dicen «Perfil», y repetirlo un tercer nivel más abajo solo
            empujaba los campos hacia abajo. */}
        {section === "profile" && <SettingsCard>
          <Campo
            label="Nombre visible"
            id={`${uid}-nombre`}
            help="Aparece en la barra superior, en el registro de actividad y en las firmas de aprobación."
          >
            <input
              id={`${uid}-nombre`}
              className="nf-app-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Tu nombre"
            />
          </Campo>

          <Campo
            label="Correo"
            id={`${uid}-correo`}
            help={live
              ? "Viene de tu identidad autenticada: identifica la cuenta y no se edita aquí."
              : "Cuenta de la sesión demo. Los cambios no salen de este navegador."}
          >
            <input id={`${uid}-correo`} className="nf-app-input" value={profile.email} readOnly aria-readonly />
          </Campo>

          <button
            type="button"
            className="nf-app-btn-primary"
            onClick={save}
            /* Deshabilitado sin cambios: sin esto el botón invita a guardar algo
               que ya está guardado y devuelve un aviso de éxito vacío. */
            disabled={pending || !dirty}
          >
            {pending ? "Guardando…" : "Guardar cambios"}
          </button>
        </SettingsCard>}

        {section === "appearance" && <SettingsCard
          icon={<Palette size={16} strokeWidth={2} aria-hidden />}
          title="Tema"
          description="Claro, oscuro o el que use tu sistema operativo. Con «Sistema» la aplicación sigue al dispositivo, así que cambia sola al anochecer si tu equipo lo hace. La elección se recuerda en este navegador."
        >
          <ThemeSwitcher />
        </SettingsCard>}

        {section === "appearance" && <SettingsCard
          icon={<Building2 size={16} strokeWidth={2} aria-hidden />}
          title="Idioma"
          description="Traduce la interfaz: menús, botones y mensajes. No traduce el contenido que escribe tu organización —documentos, hallazgos, nombres de proceso—, que se guarda tal cual se introdujo."
        >
          <LanguageSwitcher />
        </SettingsCard>}

        {section === "workspace" && <WorkspacePreferencesCard onToast={showToast} />}

        {/* Solo en live: la preferencia se guarda contra la organización y el
            usuario autenticados, y en la sesión demo no hay ni buzón ni envío
            que silenciar. */}
        {section === "notifications" && serverProfile && <NotificationPreferencesCard initial={serverProfile.notifications} onToast={showToast} />}

        {section === "absence" && serverProfile && (
          <DelegationCard
            delegations={serverProfile.delegations}
            colleagues={serverProfile.colleagues}
            onToast={showToast}
          />
        )}

        {section === "profile" && serverProfile && <PhotoCard current={serverProfile.avatarUrl} onToast={showToast} />}

        {section === "security" && serverProfile && <SecurityCard email={serverProfile.email} onToast={showToast} />}

        {section === "security" && serverProfile && <SessionsCard sessions={serverProfile.sessions} onToast={showToast} />}

        {/* Sin encabezado: el botón se nombra a sí mismo, y la organización de
            la sesión ya está en la ficha de identidad de arriba. */}
        {section === "security" && <SettingsCard>
          <button type="button" className="nf-app-btn-outline" onClick={() => void logout()} data-nf-no-action-icon>
            <LogOut size={14} strokeWidth={2} aria-hidden /> Cerrar sesión
          </button>
        </SettingsCard>}
      </div>
    </div>
  );
}

/**
 * Preferencias del espacio de trabajo.
 *
 * Las tres se guardan en cookie y el servidor las aplica antes de pintar, así
 * que se leen del DOM al montar en vez de arrastrarlas por el layout: el mismo
 * criterio que usa `ThemeSwitcher` con `data-theme`.
 */
function WorkspacePreferencesCard({ onToast }: { onToast: (message: string) => void }) {
  const router = useRouter();
  const uid = useId();
  const [home, setHome] = useState<string>(DEFAULT_HOME);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [timeZone, setTimeZone] = useState<string>(SYSTEM_TIME_ZONE);
  const [dateStyle, setDateStyle] = useState<DateFormatStyle>("dmy");
  const [deviceZone, setDeviceZone] = useState("UTC");
  const [zones, setZones] = useState<string[]>([]);
  const [, startTransition] = useTransition();

  /* La vista previa se calcula con la elección en curso, no con la guardada:
     el efecto de un formato de fecha no se entiende hasta que se ve escrito. */
  const preview = {
    date: formatDate(new Date(), { timeZone, style: dateStyle }),
    dateTime: formatDateTime(new Date(), { timeZone }),
    zone: timeZoneLabel({ timeZone }),
  };

  useEffect(() => {
    /* `document.cookie` devuelve el valor percent-encoded: sin descodificar,
       «/app/audits» llega como «%2Fapp%2Faudits», no coincide con ningún
       destino de la lista y el desplegable volvía al panel en cada recarga.
       En el servidor no pasa: `cookies()` ya lo descodifica. */
    const cookies = Object.fromEntries(
      document.cookie.split("; ").filter(Boolean).map((entry) => {
        const index = entry.indexOf("=");
        return [entry.slice(0, index), decodeURIComponent(entry.slice(index + 1))];
      }),
    );
    setHome(readHomePreference(cookies[HOME_COOKIE]));
    setReducedMotion(document.documentElement.dataset.reducedMotion === "true");
    setTimeZone(document.documentElement.dataset.timezone ?? SYSTEM_TIME_ZONE);
    setDateStyle(readDateFormat(document.documentElement.dataset.datefmt));
    setDeviceZone(deviceTimeZone());
    setZones(supportedTimeZones());
  }, []);

  function chooseDates(zone: string, style: DateFormatStyle) {
    setTimeZone(zone);
    setDateStyle(style);
    // Se aplican al vuelo para que el resto de la pantalla se reformatee sin
    // esperar al servidor; el refresco confirma con la cookie ya escrita.
    document.documentElement.dataset.timezone = zone;
    document.documentElement.dataset.datefmt = style;
    startTransition(async () => {
      await setDateDisplayPreference({ timeZone: zone, dateFormat: style });
      router.refresh();
    });
  }

  function chooseHome(value: string) {
    setHome(value);
    startTransition(async () => {
      await setHomePreference(value);
      onToast("Página de inicio actualizada");
    });
  }

  function chooseMotion(reduced: boolean) {
    setReducedMotion(reduced);
    // Igual que el tema: se aplica en el manejador para que el efecto sea
    // inmediato, y el servidor lo confirma al refrescar.
    if (reduced) document.documentElement.setAttribute("data-reduced-motion", "true");
    else document.documentElement.removeAttribute("data-reduced-motion");
    startTransition(async () => {
      await setMotionPreference(reduced ? "reduced" : "system");
      router.refresh();
    });
  }

  function resetNavigation() {
    try {
      window.localStorage.removeItem(NAV_PINNED_STORAGE_KEY);
      window.localStorage.removeItem(NAV_OPEN_GROUPS_STORAGE_KEY);
    } catch {
      /* almacenamiento no disponible: no hay nada que limpiar */
    }
    onToast("Navegación restablecida");
    // Recarga completa: el sidebar lee `localStorage` una sola vez al montar.
    window.location.reload();
  }

  return (
    <SettingsCard>
      <Campo
        label="Página de inicio"
        id={`${uid}-inicio`}
        help="La pantalla que se abre al iniciar sesión."
      >
        <Picker id={`${uid}-inicio`} aria-label="Página de inicio" className="nf-app-input" value={home} onChange={(event) => chooseHome(event.target.value)}>
          {HOME_OPTIONS.map((option) => (
            <option key={option.href} value={option.href}>{option.label}</option>
          ))}
        </Picker>
      </Campo>

      <Conmutador
        label="Reducir animaciones"
        help="Quita transiciones y desplazamientos suaves. Si ya lo tienes activado en tu sistema operativo, la aplicación lo respeta sin necesidad de marcarlo aquí."
        checked={reducedMotion}
        onChange={chooseMotion}
      />

      <Campo
        label="Zona horaria"
        id={`${uid}-zona`}
        help="Con qué zona se muestran las fechas y horas de la aplicación. No cambia la hora a la que ocurrieron los hechos: cambia cómo se leen."
      >
        <Picker id={`${uid}-zona`} aria-label="Zona horaria" className="nf-app-input" value={timeZone} onChange={(event) => chooseDates(event.target.value, dateStyle)}>
          <option value={SYSTEM_TIME_ZONE}>Sistema ({deviceZone})</option>
          {zones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
        </Picker>
      </Campo>

      <Campo label="Formato de fecha" id={`${uid}-formato`}>
        <Picker id={`${uid}-formato`} aria-label="Formato de fecha" className="nf-app-input" value={dateStyle} onChange={(event) => chooseDates(timeZone, event.target.value as DateFormatStyle)}>
          {DATE_FORMAT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label} · {option.sample}</option>
          ))}
        </Picker>
        {/* Esta sí se queda a la vista: no explica el ajuste, enseña su
            resultado. Es el único modo de entender un formato de fecha. */}
        <span className="nf-account__hint nf-account__preview">
          Ahora mismo: <strong>{preview.date}</strong> · <strong>{preview.dateTime}</strong> {preview.zone}
        </span>
      </Campo>

      <div className="nf-account__field">
        <div className="nf-account__field-head">
          <span className="nf-account__field-label">Navegación</span>
          <InfoTip
            label="Navegación"
            text="Olvida los elementos fijados y los grupos plegados del menú lateral en este navegador."
          />
        </div>
        <button type="button" className="nf-app-btn-outline" onClick={resetNavigation} data-nf-no-action-icon>
          <RotateCcw size={14} strokeWidth={2} aria-hidden /> Restablecer la navegación
        </button>
      </div>
    </SettingsCard>
  );
}

/**
 * Avisos por correo.
 *
 * El modelo, la server action y el filtro de envío existían desde hace tiempo
 * —`notification-delivery.ts` descarta el correo si la preferencia lo dice—,
 * pero no había pantalla: nadie podía dejar de recibir correos.
 */
function NotificationPreferencesCard({ initial, onToast }: {
  initial: { emailEnabled: boolean; disabledTypes: NotificationType[] };
  onToast: (message: string) => void;
}) {
  const [emailEnabled, setEmailEnabled] = useState(initial.emailEnabled);
  const [disabled, setDisabled] = useState<NotificationType[]>(initial.disabledTypes);
  const [saved, setSaved] = useState(initial);
  const [pending, startTransition] = useTransition();

  const dirty = emailEnabled !== saved.emailEnabled
    || disabled.length !== saved.disabledTypes.length
    || disabled.some((type) => !saved.disabledTypes.includes(type));

  function toggleType(type: NotificationType, receive: boolean) {
    setDisabled((current) => (receive ? current.filter((item) => item !== type) : [...current, type]));
  }

  function save() {
    startTransition(async () => {
      try {
        await updateNotificationEmailPreference({ emailEnabled, disabledTypes: disabled });
        setSaved({ emailEnabled, disabledTypes: disabled });
        onToast("Preferencia de avisos guardada");
      } catch (error) {
        onToast(error instanceof Error ? error.message : "No se pudo guardar la preferencia");
      }
    });
  }

  return (
    <SettingsCard
      icon={<BellRing size={16} strokeWidth={2} aria-hidden />}
      title="Avisos por correo"
      description="Qué te llega al buzón. Los avisos siguen apareciendo en la campana aunque apagues el correo."
    >
      <Conmutador
        label="Recibir avisos por correo"
        help="Al apagarlo no se envía ningún correo, de ningún tipo."
        checked={emailEnabled}
        onChange={setEmailEnabled}
      />

      {/* El `disabled` va casilla por casilla, no en el `fieldset`: un fieldset
          deshabilitado apaga TODOS sus controles, incluidos los botones de
          ayuda, y entonces con el correo apagado no habría manera de leer qué
          es cada tipo antes de volver a encenderlo. */}
      <fieldset className="nf-account__fieldset" data-disabled={!emailEnabled || undefined}>
        <legend className="nf-account__field-label">Tipos que quieres recibir</legend>
        {NOTIFICATION_TYPES.map((type) => (
          <Conmutador
            key={type.value}
            label={type.label}
            help={type.description}
            checked={!disabled.includes(type.value)}
            disabled={!emailEnabled}
            onChange={(receive) => toggleType(type.value, receive)}
          />
        ))}
      </fieldset>

      <button type="button" className="nf-app-btn-primary" onClick={save} disabled={pending || !dirty}>
        {pending ? "Guardando…" : "Guardar preferencia"}
      </button>
    </SettingsCard>
  );
}

/**
 * Ausencia y suplencia.
 *
 * Reenvía los avisos, no los permisos: el suplente ve lo que hay pendiente y
 * actúa con lo que su propio rol le permite. Concederse capacidad de
 * aprobación desde un ajuste de cuenta rompería la segregación de funciones
 * que la norma exige, así que la pantalla lo dice en voz alta.
 */
function DelegationCard({ delegations, colleagues, onToast }: {
  delegations: ServerProfile["delegations"];
  colleagues: ServerProfile["colleagues"];
  onToast: (message: string) => void;
}) {
  const router = useRouter();
  const uid = useId();
  const [toUserId, setToUserId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const now = Date.now();
  const active = delegations.find(
    (row) => !row.revokedAt && new Date(row.startsAt).getTime() <= now && new Date(row.endsAt).getTime() >= now,
  );
  const upcoming = delegations.filter((row) => !row.revokedAt && new Date(row.startsAt).getTime() > now);

  function submit() {
    if (!toUserId || !startsAt || !endsAt) {
      onToast("Elige suplente y fechas");
      return;
    }
    startTransition(async () => {
      try {
        await createDelegation({ toUserId, startsAt, endsAt, reason });
        setToUserId(""); setStartsAt(""); setEndsAt(""); setReason("");
        onToast("Ausencia declarada");
        router.refresh();
      } catch (error) {
        onToast(error instanceof Error ? error.message : "No se pudo declarar la ausencia");
      }
    });
  }

  function revoke(id: string) {
    startTransition(async () => {
      try {
        await revokeDelegation(id);
        onToast("Suplencia cerrada");
        router.refresh();
      } catch (error) {
        onToast(error instanceof Error ? error.message : "No se pudo cerrar la suplencia");
      }
    });
  }

  return (
    <SettingsCard
      icon={<UserRoundCheck size={16} strokeWidth={2} aria-hidden />}
      title="Ausencia y suplencia"
      description="Quién recibe tus avisos mientras no estás. Reenvía los avisos, no tus permisos: tu suplente actúa con los que ya tiene su rol."
    >
      {active && (
        <div className="nf-account__delegation nf-account__delegation--active">
          <span>
            <strong>{active.toUser.name}</strong> te cubre hasta el {formatDate(active.endsAt)}.
          </span>
          <button type="button" className="nf-app-btn-outline nf-app-btn-sm" disabled={pending} onClick={() => revoke(active.id)} data-nf-no-action-icon>
            Cerrar ahora
          </button>
        </div>
      )}

      {upcoming.map((row) => (
        <div key={row.id} className="nf-account__delegation">
          <span>
            {formatDate(row.startsAt)} – {formatDate(row.endsAt)} · <strong>{row.toUser.name}</strong>
          </span>
          <button type="button" className="nf-app-btn-outline nf-app-btn-sm" disabled={pending} onClick={() => revoke(row.id)} data-nf-no-action-icon>
            Cancelar
          </button>
        </div>
      ))}

      <label className="nf-account__field">
        <span className="nf-account__field-label">Suplente</span>
        <PersonPicker people={colleagues} value={toUserId} onValueChange={(personId) => setToUserId(personId)} placeholder="Elige a alguien de tu organización" />
      </label>

      <div className="nf-account__field nf-account__dates">
        <label>
          <span className="nf-account__field-label">Desde</span>
          <DateField className="nf-app-input" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
        </label>
        <label>
          <span className="nf-account__field-label">Hasta</span>
          <DateField className="nf-app-input" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
        </label>
      </div>

      <Campo
        label="Motivo (opcional)"
        id={`${uid}-motivo`}
        help="Queda registrado en la traza de auditoría: quién delegó en quién y durante cuánto tiempo."
      >
        <input id={`${uid}-motivo`} className="nf-app-input" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Vacaciones, baja, viaje…" />
      </Campo>

      <button type="button" className="nf-app-btn-primary" onClick={submit} disabled={pending || !toUserId || !startsAt || !endsAt}>
        {pending ? "Guardando…" : "Declarar ausencia"}
      </button>
    </SettingsCard>
  );
}

/**
 * Foto de perfil.
 *
 * `avatarUrl` existía en el modelo y llegaba al payload, pero nada lo escribía:
 * siempre se veían las iniciales. La imagen se guarda en su propio bucket, bajo
 * el prefijo de la organización, y se entrega con URL firmada.
 */
function PhotoCard({ current, onToast }: { current: string | null; onToast: (message: string) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // La foto sube al elegirla; el estado solo sirve para enseñar la miniatura
  // mientras el servidor la guarda y refresca la que ya estaba.
  const [elegida, setElegida] = useState<File | null>(null);

  function upload(file: File | undefined) {
    if (!file) return;
    const data = new FormData();
    data.set("photo", file);
    startTransition(async () => {
      try {
        await updateProfilePhoto(data);
        onToast("Foto actualizada");
        setElegida(null);
        router.refresh();
      } catch (error) {
        onToast(error instanceof Error ? error.message : "No se pudo subir la foto");
      }
    });
  }

  function remove() {
    startTransition(async () => {
      try {
        await removeProfilePhoto();
        onToast("Foto eliminada");
        router.refresh();
      } catch (error) {
        onToast(error instanceof Error ? error.message : "No se pudo quitar la foto");
      }
    });
  }

  return (
    <SettingsCard
      icon={<Camera size={16} strokeWidth={2} aria-hidden />}
      title="Foto de perfil"
      description="Sustituye a tus iniciales en la barra superior, el menú lateral y la traza de actividad. Se recorta en círculo: encuadra la cara en el centro."
    >
      <FileImportArea
        label="Subir imagen"
        accept="image/png,image/jpeg,image/webp"
        maxSizeMB={2}
        disabled={pending}
        file={elegida}
        onFileChange={(archivo) => { setElegida(archivo); if (archivo) upload(archivo); }}
        compact
      />
      {current && (
        <button type="button" className="nf-app-btn-outline" onClick={remove} disabled={pending} data-nf-no-action-icon>
          Quitar foto
        </button>
      )}
    </SettingsCard>
  );
}

/**
 * Seguridad de la cuenta.
 *
 * La aplicación no toca la contraseña: pide a Supabase que envíe su correo de
 * restablecimiento. La contraseña nueva se escribe en el flujo de Supabase y no
 * pasa por este servidor ni por sus registros.
 */
function SecurityCard({ email, onToast }: { email: string; onToast: (message: string) => void }) {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  function request() {
    startTransition(async () => {
      try {
        const result = await requestPasswordReset();
        setSent(true);
        onToast(`Correo enviado a ${result.sentTo}`);
      } catch (error) {
        onToast(error instanceof Error ? error.message : "No se pudo enviar el correo");
      }
    });
  }

  return (
    <SettingsCard
      icon={<KeyRound size={16} strokeWidth={2} aria-hidden />}
      title="Contraseña"
      description="Se cambia desde el correo de restablecimiento, no desde esta pantalla: la aplicación nunca ve tu contraseña. La verificación en dos pasos todavía no está disponible."
    >
      <button type="button" className="nf-app-btn-outline" onClick={request} disabled={pending} data-nf-no-action-icon>
        {pending ? "Enviando…" : "Enviar enlace para cambiar la contraseña"}
      </button>
      {/* Esta línea sí se queda: dice a qué dirección ha salido el correo y
          cuánto dura el enlace. Es el resultado de la acción, no su manual. */}
      <p className="nf-account__hint">
        {sent
          ? `Te hemos enviado un enlace a ${email}. Caduca en una hora.`
          : `Se enviará a ${email}, la dirección de tu cuenta.`}
      </p>
    </SettingsCard>
  );
}

/**
 * Sesiones activas.
 *
 * Los datos salen de `auth.sessions`, que es donde Supabase las guarda: su SDK
 * no ofrece «lista mis sesiones». La consulta vive aislada en `lib/sessions.ts`
 * para que la dependencia de ese esquema interno esté en un solo sitio.
 */
function SessionsCard({ sessions, onToast }: {
  sessions: ServerProfile["sessions"];
  onToast: (message: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function close(session: ServerProfile["sessions"][number]) {
    startTransition(async () => {
      try {
        await revokeSession(session.id);
        onToast(session.current ? "Sesión cerrada" : "Se cerró la sesión de ese dispositivo");
        // Cerrar la propia sesión deja la página sin credencial: se va al login
        // en vez de quedarse en una pantalla que ya no puede recargar datos.
        if (session.current) window.location.href = "/login";
        else router.refresh();
      } catch (error) {
        onToast(error instanceof Error ? error.message : "No se pudo cerrar la sesión");
      }
    });
  }

  return (
    <SettingsCard
      icon={<MonitorSmartphone size={16} strokeWidth={2} aria-hidden />}
      title="Sesiones activas"
      description="Dónde está abierta tu cuenta ahora mismo. Si no reconoces un dispositivo, ciérralo y cambia la contraseña: cerrar una sesión invalida su acceso de inmediato."
    >
      {sessions.length === 0 ? (
        <p className="nf-account__hint">No se pudieron leer las sesiones de esta cuenta.</p>
      ) : sessions.map((session) => (
        <div key={session.id} className={`nf-account__delegation${session.current ? " nf-account__delegation--active" : ""}`}>
          <span>
            <strong>{describeDevice(session.userAgent)}</strong>
            {session.current && " · esta sesión"}
            <br />
            {session.ip ?? "IP desconocida"} · visto {formatDateTime(session.lastSeenAt ?? session.createdAt)}
            {session.aal === "aal2" && " · con doble factor"}
          </span>
          <button
            type="button"
            className="nf-app-btn-outline nf-app-btn-sm"
            disabled={pending}
            onClick={() => close(session)}
            data-nf-no-action-icon
          >
            {session.current ? "Cerrar aquí" : "Cerrar"}
          </button>
        </div>
      ))}
    </SettingsCard>
  );
}

/**
 * Tarjeta de ajustes.
 *
 * `title` es opcional a propósito: cuando la tarjeta ES la sección —una sola
 * por pestaña— encabezarla repite por tercera vez el mismo nombre. La
 * descripción nunca se pinta: se pide con el icono de ayuda.
 */
function SettingsCard({ icon, title, description, children }: {
  icon?: ReactNode;
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="nf-account__card">
      {title && (
        <header className="nf-account__card-head">
          {icon && <span className="nf-account__card-icon" aria-hidden>{icon}</span>}
          <div className="nf-heading-row">
            <h2 className="nf-account__card-title">{title}</h2>
            {description && <InfoTip text={description} label={title} />}
          </div>
        </header>
      )}
      <div className="nf-account__card-body">{children}</div>
    </section>
  );
}

/**
 * Campo con etiqueta y ayuda a demanda.
 *
 * El icono queda FUERA del `<label>`: dentro, el clic en la ayuda se reenvía al
 * control asociado —y en una casilla eso significa conmutarla sin querer.
 */
function Campo({ label, help, id, children }: {
  label: string;
  help?: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <div className="nf-account__field">
      <div className="nf-account__field-head">
        <label className="nf-account__field-label" htmlFor={id}>{label}</label>
        {help && <InfoTip text={help} label={label} />}
      </div>
      {children}
    </div>
  );
}

/** Casilla de preferencia con su ayuda al lado, no debajo. */
function Conmutador({ label, help, checked, disabled, onChange }: {
  label: string;
  help?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="nf-account__toggle">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <label className="nf-account__toggle-label" htmlFor={id}>{label}</label>
      {help && <InfoTip text={help} label={label} />}
    </div>
  );
}
