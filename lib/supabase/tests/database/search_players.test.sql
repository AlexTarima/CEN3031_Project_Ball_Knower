begin;
set local search_path = public, extensions;
select plan(4);

insert into public.players (id, atp_id, first_name, last_name)
    overriding system value
values (900001, 'TEST112', 'Testy', 'McTestface'),
       (900002, 'TEST113', 'Testy', 'Otherson');

select results_eq(
               $$ select id::bigint from public.search_players('testy', 'mctest') $$,
               $$ values (900001::bigint) $$,
               'first + last name narrows to one player'
       );

select is(
    (select count(*)::int from public.search_players('testy', '')),
    2,
    'first name only returns every match'
    );

select is_empty(
               $$ select * from public.search_players('zzzzzz', 'zzzzzz') $$,
               'unknown name returns no rows'
       );

select is_empty(
               $$ select * from public.search_players('', '') $$,
               'empty search returns no rows'
       );

select * from finish();
rollback;