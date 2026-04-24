import { Topbar } from "@/components/layout/topbar";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { InteractionType } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Lịch tương tác | CRM Pro",
};

const COLOR_MAP: Record<string, string> = {
  call: "bg-[#e0eaff] text-[#2563eb] border border-[#bfdbfe]/50",
  email: "bg-[#ffedd5] text-[#ea580c] border border-[#fed7aa]/50",
  meeting: "bg-[#f3e8ff] text-[#9333ea] border border-[#e9d5ff]/50",
  chat: "bg-[#dcfce7] text-[#16a34a] border border-[#bbf7d0]/50",
};

const ICON_MAP: Record<string, string> = {
  call: "call",
  email: "mail",
  meeting: "groups",
  chat: "chat",
};

// Type definition for the query result
type InteractionWithLead = {
  id: string;
  type: InteractionType;
  occurred_at: string;
  leads: {
    id: string;
    full_name: string;
  } | null;
};

// --- Native JS Date Helpers ---
const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getStartDayOfWeek = (year: number, month: number) => new Date(year, month, 1).getDay(); // 0 = Sunday
const isSameDay = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
const formatTime = (d: Date) => `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { year: yearParam, month: monthParam } = await searchParams;
  const me = await getCurrentUser();
  const supabase = await createSupabaseServerClient();

  const today = new Date();
  
  // Parse year and month from params, default to today
  let viewYear = today.getFullYear();
  let viewMonth = today.getMonth(); // 0-indexed
  
  if (yearParam && monthParam) {
    const y = parseInt(yearParam, 10);
    const m = parseInt(monthParam, 10);
    if (!isNaN(y) && !isNaN(m)) {
      viewYear = y;
      viewMonth = m - 1; 
    }
  }

  const startDate = new Date(viewYear, viewMonth, 1);
  const endDate = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59, 999);
  
  // Fetch interactions for the viewed month
  const { data: interactionsData } = await supabase
    .from("interactions")
    .select(`
      id,
      type,
      occurred_at,
      leads (
        id,
        full_name
      )
    `)
    .gte("occurred_at", startDate.toISOString())
    .lte("occurred_at", endDate.toISOString());

  const interactions = (interactionsData as unknown as InteractionWithLead[]) || [];

  // Prepare events
  const events = interactions.map(row => {
    const oc = new Date(row.occurred_at);
    return {
      id: row.id,
      date: oc.getDate(), // day of month
      time: formatTime(oc),
      name: row.leads?.full_name || "Unknown Lead",
      lead_id: row.leads?.id,
      type: row.type || "call",
      color: row.type || "call",
      fullDate: oc
    };
  });

  // Calculate calendar grid
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const startDayOfWeek = getStartDayOfWeek(viewYear, viewMonth); 
  
  // Total cells: startDayOfWeek empty cells + daysInMonth + remaining to fill rows of 7
  const totalCells = Math.ceil((startDayOfWeek + daysInMonth) / 7) * 7;
  
  const allCells = Array.from({ length: totalCells }, (_, i) => {
    const dayIndex = i - startDayOfWeek;
    if (dayIndex < 0 || dayIndex >= daysInMonth) return null;
    return dayIndex + 1;
  });

  const title = `Tháng ${viewMonth + 1} ${viewYear}`;
  
  // Pagination helpers (months are 1-indexed for the URL)
  const prevMonth = viewMonth === 0 ? 12 : viewMonth;
  const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
  
  const nextMonth = viewMonth === 11 ? 1 : viewMonth + 2;
  const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;

  return (
    <>
      <Topbar
        title="Lịch tương tác"
        userEmail={me.email}
        userName={me.fullName}
        avatarUrl={me.avatarUrl}
      />
      
      <div className="p-6 md:p-8 bg-parchment min-h-[calc(100vh-64px)]">
        <div className="max-w-[1200px] mx-auto bg-white rounded-3xl shadow-whisper border border-border-cream overflow-hidden">
          
          {/* Header */}
          <div className="p-6 md:px-8 md:pt-8 md:pb-6 flex items-center justify-between">
            <h1 className="text-[28px] font-headline font-bold text-near-black tracking-tight">{title}</h1>
            <div className="flex items-center gap-3">
              <Link 
                href="/calendar"
                className="px-5 py-2.5 bg-warm-sand text-near-black text-sm font-medium rounded-xl hover:bg-[#dcdacc] transition-colors shadow-sm"
              >
                Hôm nay
              </Link>
              <div className="flex bg-white border border-border-cream rounded-xl overflow-hidden shadow-sm">
                <Link 
                  href={`/calendar?year=${prevYear}&month=${prevMonth}`}
                  className="px-3 py-2.5 hover:bg-parchment transition-colors border-r border-border-cream text-olive-gray hover:text-near-black flex items-center"
                >
                  <span className="material-symbols-outlined !text-[20px] block">chevron_left</span>
                </Link>
                <Link 
                  href={`/calendar?year=${nextYear}&month=${nextMonth}`}
                  className="px-3 py-2.5 hover:bg-parchment transition-colors text-olive-gray hover:text-near-black flex items-center"
                >
                  <span className="material-symbols-outlined !text-[20px] block">chevron_right</span>
                </Link>
              </div>
            </div>
          </div>
          
          {/* Calendar Grid */}
          <div className="flex flex-col">
            {/* Weekdays */}
            <div className="grid grid-cols-7 border-t border-b border-border-cream bg-[#faf9f5]">
              {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map(day => (
                <div key={day} className="py-3 text-center text-[12px] font-bold text-stone-gray uppercase tracking-wider">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Days Grid */}
            <div className="grid grid-cols-7 border-b border-border-cream last:border-b-0">
              {allCells.map((day, i) => {
                const isCurrentDay = day && isSameDay(new Date(viewYear, viewMonth, day), today);
                const dayEvents = day ? events.filter(e => e.date === day) : [];
                // Sort events by time
                dayEvents.sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime());
                const isLastInRow = i % 7 === 6;
                const isLastRow = i >= totalCells - 7; 
                
                return (
                  <div 
                    key={i} 
                    className={`min-h-[140px] p-2 ${!isLastInRow ? 'border-r border-border-cream' : ''} ${!isLastRow ? 'border-b border-border-cream' : ''} ${!day ? 'bg-parchment/40' : 'hover:bg-ivory/60'} transition-colors flex flex-col group`}
                  >
                    {day && (
                      <div className="flex justify-start mb-1.5 ml-1 mt-1">
                        <span className={`text-[14px] font-semibold w-8 h-8 flex items-center justify-center rounded-full ${isCurrentDay ? 'bg-terracotta text-ivory shadow-md' : 'text-olive-gray group-hover:text-near-black group-hover:bg-warm-sand/50'}`}>
                          {day}
                        </span>
                      </div>
                    )}
                    
                    {day && dayEvents.length > 0 && (
                      <div className="flex flex-col gap-1.5 flex-1 overflow-hidden mt-1">
                        {dayEvents.map((event, idx) => (
                          <Link 
                            key={event.id || idx}
                            href={event.lead_id ? `/leads/${event.lead_id}` : '#'}
                            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-transform hover:scale-[1.02] hover:shadow-sm whitespace-nowrap overflow-hidden ${COLOR_MAP[event.color] || COLOR_MAP.call}`}
                            title={`${event.time} - ${event.name} (${event.type})`}
                          >
                            <span className="material-symbols-outlined !text-[14px]" style={{ fontVariationSettings: "'FILL' 0, 'wght' 500" }}>
                              {ICON_MAP[event.type] || ICON_MAP.call}
                            </span>
                            <span className="font-bold opacity-90">{event.time}</span>
                            <span className="truncate font-medium">{event.name}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
        </div>
      </div>
    </>
  );
}
