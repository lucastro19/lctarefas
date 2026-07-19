const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

/**
 * Cria um evento no Google Calendar com link do Google Meet.
 * @param {string} accessToken - provider_token da sessão Supabase
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.date        - "YYYY-MM-DD"
 * @param {string} opts.time        - "HH:MM" (horário local)
 * @param {number} opts.duration    - minutos (padrão 60)
 * @param {string[]} opts.attendees - lista de emails
 * @param {string} [opts.notes]     - descrição do evento
 * @returns {{ meetLink: string, eventId: string, htmlLink: string }}
 */
export async function createMeetingEvent(accessToken, { title, date, time, duration = 60, attendees = [], notes = "" }) {
  const startLocal = new Date(`${date}T${time}:00`);
  const endLocal = new Date(startLocal.getTime() + duration * 60_000);

  const toRFC3339 = (d) => d.toISOString();

  const body = {
    summary: title,
    description: notes,
    start: { dateTime: toRFC3339(startLocal), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    end: { dateTime: toRFC3339(endLocal), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    attendees: attendees.filter(Boolean).map((email) => ({ email: email.trim() })),
    conferenceData: {
      createRequest: {
        requestId: `lctarefas-${Date.now()}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
    reminders: { useDefault: true },
  };

  const res = await fetch(
    `${CALENDAR_API}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Google Calendar API error ${res.status}`);
  }

  const event = await res.json();
  const meetLink = event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ?? null;

  return { meetLink, eventId: event.id, htmlLink: event.htmlLink };
}

/**
 * Atualiza um evento existente (ex: muda horário ou participantes).
 */
export async function updateMeetingEvent(accessToken, eventId, { title, date, time, duration = 60, attendees = [], notes = "" }) {
  const startLocal = new Date(`${date}T${time}:00`);
  const endLocal = new Date(startLocal.getTime() + duration * 60_000);
  const toRFC3339 = (d) => d.toISOString();

  const body = {
    summary: title,
    description: notes,
    start: { dateTime: toRFC3339(startLocal), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    end: { dateTime: toRFC3339(endLocal), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    attendees: attendees.filter(Boolean).map((email) => ({ email: email.trim() })),
  };

  const res = await fetch(
    `${CALENDAR_API}/calendars/primary/events/${eventId}?sendUpdates=all`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Google Calendar API error ${res.status}`);
  }

  return await res.json();
}

/**
 * Cancela/deleta um evento do Google Calendar.
 */
export async function deleteMeetingEvent(accessToken, eventId) {
  const res = await fetch(
    `${CALENDAR_API}/calendars/primary/events/${eventId}?sendUpdates=all`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok && res.status !== 410) {
    throw new Error(`Google Calendar API error ${res.status}`);
  }
}
