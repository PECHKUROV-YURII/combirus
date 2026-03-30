import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    // 1. Mark past published events as "completed" and send chat warning
    const { data: pastEvents, error: pastError } = await supabase
      .from("events")
      .select("id, title, end_datetime, start_datetime")
      .eq("status", "published")
      .lte("start_datetime", now.toISOString());

    if (!pastError && pastEvents) {
      for (const ev of pastEvents) {
        const endTime = ev.end_datetime ? new Date(ev.end_datetime) : new Date(ev.start_datetime);
        if (endTime <= now) {
          await supabase.from("events").update({ status: "completed" }).eq("id", ev.id);
          console.log(`Event "${ev.title}" (${ev.id}) marked as completed`);

          // Send auto-delete warning message to event chat
          const { data: existingWarning } = await supabase
            .from("event_chat_messages")
            .select("id")
            .eq("event_id", ev.id)
            .eq("sender_user_id", SYSTEM_USER_ID)
            .ilike("message_text", "%автоматически удалён%")
            .limit(1);

          if (!existingWarning || existingWarning.length === 0) {
            await supabase.from("event_chat_messages").insert({
              event_id: ev.id,
              sender_user_id: SYSTEM_USER_ID,
              message_text: "Событие завершено. Чат события будет автоматически удалён через 24 часа.",
            });
            console.log(`Sent chat deletion warning for event "${ev.title}"`);
          }
        }
      }
    }

    // 2. Delete chats of events completed more than 24 hours ago
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const { data: oldCompleted } = await supabase
      .from("events")
      .select("id, title, end_datetime, start_datetime")
      .eq("status", "completed");

    if (oldCompleted) {
      for (const ev of oldCompleted) {
        const endTime = ev.end_datetime ? new Date(ev.end_datetime) : new Date(ev.start_datetime);
        if (endTime <= twentyFourHoursAgo) {
          // Delete chat messages
          const { error: delMsgError } = await supabase
            .from("event_chat_messages")
            .delete()
            .eq("event_id", ev.id);

          if (!delMsgError) {
            console.log(`Deleted chat messages for completed event "${ev.title}" (${ev.id})`);
          } else {
            console.error(`Error deleting chat for event ${ev.id}:`, delMsgError);
          }

          // Remove participant records so chat disappears from lists
          const { error: delPartError } = await supabase
            .from("event_participants")
            .delete()
            .eq("event_id", ev.id);

          if (!delPartError) {
            console.log(`Deleted participants for completed event "${ev.title}" (${ev.id})`);
          } else {
            console.error(`Error deleting participants for event ${ev.id}:`, delPartError);
          }
        }
      }
    }

    // 3. Auto-cancel published events starting within 2 hours with insufficient participants
    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("id, title, min_participants, organizer_user_id")
      .eq("status", "published")
      .lte("start_datetime", twoHoursFromNow.toISOString())
      .gte("start_datetime", now.toISOString());

    if (eventsError) {
      console.error("Error fetching events:", eventsError);
      return new Response(JSON.stringify({ error: eventsError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cancelledIds: string[] = [];

    if (events) {
      for (const event of events) {
        const { count } = await supabase
          .from("event_participants")
          .select("id", { count: "exact", head: true })
          .eq("event_id", event.id)
          .eq("status", "confirmed");

        const confirmedCount = count || 0;

        if (confirmedCount < event.min_participants) {
          const newStatus = confirmedCount > 0 ? "unpublished" : "cancelled";
          await supabase.from("events").update({ status: newStatus }).eq("id", event.id);
          cancelledIds.push(event.id);
          console.log(
            `Event "${event.title}" (${event.id}) auto-cancelled: ${confirmedCount}/${event.min_participants} participants, status → ${newStatus}`
          );
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: `Checked events, cancelled ${cancelledIds.length}`,
        cancelled: cancelledIds.length,
        cancelledIds,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
