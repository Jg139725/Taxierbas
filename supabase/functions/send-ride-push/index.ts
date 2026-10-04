import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  try{
    const auth=req.headers.get("Authorization")||"";
    const url=Deno.env.get("SUPABASE_URL")!;
    const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
    const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const caller=createClient(url,anon,{global:{headers:{Authorization:auth}}});
    const {data:{user},error:userError}=await caller.auth.getUser();
    if(userError||!user)return new Response("Unauthorized",{status:401,headers:cors});
    const admin=createClient(url,service);
    const {data:me}=await admin.from("profiles").select("role,active").eq("id",user.id).single();
    if(!me?.active||!["admin","dispatcher"].includes(me.role))return new Response("Forbidden",{status:403,headers:cors});
    const {ride_id}=await req.json();
    const {data:ride,error:rideError}=await admin.from("rides").select("id,ride_time,pickup,destination,assigned_driver,assigned_drivers").eq("id",ride_id).single();
    if(rideError||!ride)return new Response("Ride not found",{status:404,headers:cors});
    const ids=[...new Set([...(ride.assigned_drivers||[]),ride.assigned_driver].filter(Boolean))];
    if(!ids.length)return Response.json({sent:0},{headers:cors});
    const {data:subs}=await admin.from("push_subscriptions").select("id,endpoint,p256dh,auth").in("user_id",ids);
    webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT")||"mailto:info@taxi-erbas.de",Deno.env.get("VAPID_PUBLIC_KEY")!,Deno.env.get("VAPID_PRIVATE_KEY")!);
    const payload=JSON.stringify({title:"Taxi Erbas – Neue/aktualisierte Fahrt",body:`${String(ride.ride_time||"").slice(0,5)} Uhr · ${ride.pickup||"Abholung"} → ${ride.destination||"Ziel"}`,ride_id:ride.id,url:"portal.html"});
    let sent=0;
    for(const sub of subs||[]){
      try{await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},payload);sent++}
      catch(e){if(e?.statusCode===404||e?.statusCode===410)await admin.from("push_subscriptions").delete().eq("id",sub.id);else console.error(e)}
    }
    return Response.json({sent},{headers:cors});
  }catch(e){console.error(e);return new Response("Push error",{status:500,headers:cors})}
});
