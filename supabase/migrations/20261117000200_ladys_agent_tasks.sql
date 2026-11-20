-- LadyS:LINE 一對一「work + 內容」派工給 agent(/agent-tasks)
create table if not exists public.ladys_agent_tasks (
  id uuid primary key default gen_random_uuid(),
  ladys_agent text check (ladys_agent in ('marketing', 'editor', 'coach')),
  ladys_content text not null,
  ladys_status text not null default '待處理' check (ladys_status in ('待指派', '待處理', '處理中', '完成', '取消')),
  ladys_route text not null check (ladys_route in ('explicit', 'keyword', 'ai', 'user')),
  ladys_result text not null default '',
  ladys_line_msg_id text unique,
  ladys_created_at timestamptz not null default now(),
  ladys_updated_at timestamptz not null default now(),
  ladys_done_at timestamptz,
  check (ladys_agent is not null or ladys_status in ('待指派', '取消'))
);
create index if not exists ladys_agent_tasks_agent_status_idx on public.ladys_agent_tasks (ladys_agent, ladys_status, ladys_created_at);
alter table public.ladys_agent_tasks enable row level security;
revoke all on public.ladys_agent_tasks from anon, authenticated;
