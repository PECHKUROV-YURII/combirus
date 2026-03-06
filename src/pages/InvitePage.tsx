import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function InvitePage() {
  const { code } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const resolve = async () => {
      if (!code) {
        navigate("/home");
        return;
      }
      const { data } = await supabase
        .from("events")
        .select("id")
        .eq("private_invite_link", code)
        .single();

      if (data) {
        navigate(`/event/${data.id}`, { replace: true });
      } else {
        navigate("/home", { replace: true });
      }
    };
    resolve();
  }, [code, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
