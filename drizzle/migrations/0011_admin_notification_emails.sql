create or replace function public.queue_admin_notification_email()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.email_outbox (recipient, event, payload)
  values (
    'rentreadyng@gmail.com',
    'admin_notification',
    to_jsonb(new)
  );
  return new;
end;
$$;

drop trigger if exists admin_notification_email_trigger on public.admin_notifications;

create trigger admin_notification_email_trigger
after insert on public.admin_notifications
for each row execute function public.queue_admin_notification_email();