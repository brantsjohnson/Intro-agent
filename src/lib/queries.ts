import { supabase } from "@/integrations/supabase/client";

export async function listProjects() {
  const { data, error } = await supabase.from("projects").select("*").order("name");
  if (error) throw error;
  return data;
}
export async function listTasks() {
  const { data, error } = await supabase.from("tasks").select("*, projects(name,color)").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
export async function listNotes() {
  const { data, error } = await supabase.from("source_notes").select("*, projects(name,color)").order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return data;
}
export async function listContacts() {
  const { data, error } = await supabase.from("contacts").select("*, projects(name,color)").order("name");
  if (error) throw error;
  return data;
}
export async function listDrafts() {
  const { data, error } = await supabase.from("content_drafts").select("*, content_channels(name,kind), projects(name)").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
export async function listChannels() {
  const { data, error } = await supabase.from("content_channels").select("*").order("kind");
  if (error) throw error;
  return data;
}
export async function listMemory() {
  const { data, error } = await supabase.from("project_memory").select("*, projects(name,color)").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
export async function todayChecklist() {
  const today = new Date().toISOString().slice(0,10);
  const { data } = await supabase.from("daily_checklists").select("*").eq("date", today).maybeSingle();
  return data;
}
