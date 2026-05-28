"use client";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";

export function CalendarGrid({ units, staff, assignments, leaveList, currentMonth, onMonthChange, onAssign, onDelete, onLock }) {
  const eventsByUnit = {};
  units.forEach(function(unit) { eventsByUnit[unit.code] = []; });
  assignments.forEach(function(a) {
    if (eventsByUnit[a.unit]) {
      const c = a.shift_code === "N" ? "#818cf8" : a.shift_code === "PA" ? "#f59e0b" : "#22c55e";
      const title = (a.locked ? "[L] " : "") + a.staff_name + " " + a.shift_code;
      eventsByUnit[a.unit].push({
        title: title,
        start: a.shift_date,
        allDay: true,
        backgroundColor: c + "CC",
        borderColor: c,
        textColor: "#fff",
        extendedProps: { id: a.id, staff_id: a.staff_id, unit: a.unit, locked: a.locked, staff_name: a.staff_name, shift_code: a.shift_code, shift_date: a.shift_date },
      });
    }
  });

  return (
    <>
      <style>{".fc{background:transparent!important;color:#a1a1aa!important}.fc-toolbar-title{font-size:0}.fc-header-toolbar{display:none}.fc-col-header-cell{background:#27272a;border-color:#3f3f46;padding:3px 0;font-size:10px}.fc-daygrid-day{background:#18181b;border-color:#27272a}.fc-day-today{background:#1e1b4b!important}.fc-daygrid-day-number{color:#71717a;font-size:10px;padding:2px 4px}.fc-daygrid-event{border-radius:4px;margin:1px 2px;padding:1px 3px;font-size:9px;border:none;cursor:pointer}.fc-daygrid-event:hover{filter:brightness(1.2)}.fc-daygrid-day-frame{min-height:40px}.fc-scrollgrid{border-color:#27272a!important}.fc-scrollgrid-section-header{border:none!important}"}</style>
      <div className="space-y-2">
        {units.map(function(unit) {
          return (
            <div key={unit.code} className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800 bg-zinc-800/30">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: unit.color }} />
                <span className="text-xs font-semibold text-zinc-300">{unit.name}</span>
                <span className="text-[10px] text-zinc-600 ml-auto">
                  {(eventsByUnit[unit.code] || []).length} shifts
                </span>
              </div>
              <div className="p-2">
                <FullCalendar
                  plugins={[dayGridPlugin, interactionPlugin]}
                  initialView="dayGridMonth"
                  initialDate={currentMonth + "-01"}
                  events={eventsByUnit[unit.code] || []}
                  height="auto"
                  headerToolbar={{ left: "", center: "", right: "" }}
                  datesSet={function(info) { onMonthChange(info.start.toISOString().slice(0, 7)); }}
                  dateClick={function(info) {
                    const s = staff[0];
                    if (s) onAssign(s.id, info.dateStr, unit.code);
                  }}
                  eventClick={function(info) {
                    const ep = info.event.extendedProps;
                    if (ep && ep.id) {
                      if (ep.locked) onLock(ep);
                      else onDelete(ep.id, ep.staff_name, info.event.startStr, ep.unit, ep.staff_id);
                    }
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
