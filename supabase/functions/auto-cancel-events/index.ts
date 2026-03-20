import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find published events starting within the next 2 hours
    const now = new Date();
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

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

    if (!events || events.length === 0) {
      return new Response(JSON.stringify({ message: "No events to check", cancelled: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cancelledIds: string[] = [];

    for (const event of events) {
      // Count confirmed participants
      const { count } = await supabase
        .from("event_participants")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id)
        .eq("status", "confirmed");

      const confirmedCount = count || 0;

      if (confirmedCount < event.min_participants) {
        // Not enough participants — cancel (set to unpublished)
        // If there are participants, they'll see it as "cancelled"
        // If no participants, it just gets hidden
        const newStatus = confirmedCount > 0 ? "unpublished" : "cancelled";

        await supabase
          .from("events")
          .update({ status: newStatus })
          .eq("id", event.id);

        cancelledIds.push(event.id);
        console.log(
          `Event "${event.title}" (${event.id}) auto-cancelled: ${confirmedCount}/${event.min_participants} participants, status → ${newStatus}`
        );
      }
    }

    return new Response(
      JSON.stringify({
        message: `Checked ${events.length} events, cancelled ${cancelledIds.length}`,
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
